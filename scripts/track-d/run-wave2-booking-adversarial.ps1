param(
    [string]$Repo = (Get-Location).Path,
    [string]$Baseline = '3201e32',
    [switch]$SkipIntegration
)

$ErrorActionPreference = 'Stop'
Set-Location $Repo

function Invoke-Checked {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host "`n=== $Label ===" -ForegroundColor Cyan
    & $Action

    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

Write-Host "`n=== TRACK D / WAVE 2 BOOKING ADVERSARIAL VERIFICATION ===" -ForegroundColor Cyan

git merge-base --is-ancestor $Baseline HEAD
if ($LASTEXITCODE -ne 0) {
    throw "Current checkout does not descend from stabilized M1 baseline $Baseline."
}

Write-Host "Baseline ancestry: PASS ($Baseline)" -ForegroundColor Green
git status --short --branch
git log -1 --oneline

Invoke-Checked 'PRISMA GENERATE' {
    npm run db:generate
}

Invoke-Checked 'PRISMA VALIDATE' {
    npm run db:validate
}

Write-Host "`n=== ARCHITECTURAL CONTRACT CHECKS ===" -ForegroundColor Cyan

$policy =
    Get-Content `
        '.\lib\domain\booking-policy.ts' `
        -Raw

if (
    $policy -notmatch
    'BOOKING_OPERATIONAL_TIMEZONE\s*=\s*\r?\n?\s*"Asia/Tehran"'
) {
    throw 'Track D blocker: booking timezone authority is not Asia/Tehran.'
}

Write-Host '[PASS] Asia/Tehran remains the scheduling authority.' -ForegroundColor Green

$timeContract =
    Get-Content `
        '.\tests\unit\booking\iran-booking-time-contract.test.ts' `
        -Raw

if (
    $timeContract -notmatch 'Intl\.DateTimeFormat' -or
    $timeContract -notmatch 'BOOKING_OPERATIONAL_TIMEZONE'
) {
    throw 'Track D blocker: Tehran contract is not independently checked against IANA/Intl semantics.'
}

Write-Host '[PASS] Existing M1 time contract derives expectations through IANA/Intl.' -ForegroundColor Green

$cancellationService =
    Get-Content `
        '.\lib\services\session-cancellation.service.ts' `
        -Raw

if (
    $cancellationService -match
    '\.delete(Many)?\s*\('
) {
    throw 'Track D blocker: cancellation service contains a physical delete path.'
}

Write-Host '[PASS] No physical speaking-session delete path in cancellation service.' -ForegroundColor Green

$wave2Services =
    @(
        '.\lib\services\speaking-session-read.service.ts',
        '.\lib\services\booking.service.ts',
        '.\lib\services\session-cancellation.service.ts'
    ) |
    ForEach-Object {
        Get-Content $_ -Raw
    } |
    Out-String

if (
    $wave2Services -match
    '(?is)update(Many)?\s*\([^)]*COMPLETED'
) {
    throw 'Track D blocker: possible Wave 2 durable COMPLETED mutation detected.'
}

Write-Host '[PASS] No obvious Wave 2 time-derived COMPLETED mutation path.' -ForegroundColor Green

$publicSlots =
    Get-Content `
        '.\lib\services\bookable-slots.service.ts' `
        -Raw

if (
    $publicSlots -notmatch
    'publicTeacherSelect'
) {
    throw 'Track D blocker: public teacher availability path lost its explicit select boundary.'
}

Write-Host '[PASS] Existing public teacher eligibility read remains allowlisted.' -ForegroundColor Green

Invoke-Checked 'TRACK D STALE DISCOVERY ELIGIBILITY ATTACK' {
    npx vitest run `
        tests/unit/security/wave2-stale-discovery-eligibility-adversarial.test.ts
}

$timezoneFiles = @(
    'tests/unit/booking/iran-booking-time-contract.test.ts',
    'tests/unit/booking/availability-projection.test.ts'
)

$originalTZ =
    $env:TZ

try {
    foreach (
        $runtimeTZ
        in @(
            'UTC',
            'Europe/Helsinki',
            'America/New_York'
        )
    ) {
        $env:TZ =
            $runtimeTZ

        Invoke-Checked "RUNTIME TZ = $runtimeTZ / ASIA-TEHRAN CONTRACT" {
            npx vitest run $timezoneFiles
        }
    }
}
finally {
    if ($null -eq $originalTZ) {
        Remove-Item Env:TZ -ErrorAction SilentlyContinue
    }
    else {
        $env:TZ =
            $originalTZ
    }
}

Invoke-Checked 'BOOKING / PRIVACY / CANCELLATION UNIT ATTACK SET' {
    npx vitest run `
        tests/unit/booking/booking-validation.test.ts `
        tests/unit/booking/booking.service.test.ts `
        tests/unit/booking/session-cancellation.service.test.ts `
        tests/unit/booking/session-cancellation-routes.test.ts `
        tests/unit/booking/session-read-routes.test.ts `
        tests/unit/booking/speaking-session-elapsed-contract.test.ts `
        tests/unit/booking/public-teacher-privacy-contract.test.ts `
        tests/unit/security/wave2-stale-discovery-eligibility-adversarial.test.ts
}

if (-not $SkipIntegration) {
    $integrationFiles =
        @(
            'tests/integration/wave2-booking-constraints.test.ts',
            'tests/integration/wave2-booking-service.test.ts',
            'tests/integration/wave2-session-cancellation.test.ts',
            'tests/integration/wave2-cancellation-constraints.test.ts',
            'tests/integration/wave2-session-read.test.ts',
            'tests/integration/test-prisma-timezone.test.ts'
        )

    foreach (
        $file
        in $integrationFiles
    ) {
        if (
            -not
            (Test-Path -LiteralPath $file)
        ) {
            throw "Required Track D integration evidence is missing: $file"
        }
    }

    Invoke-Checked 'REAL POSTGRES BOOKING / RACE / OWNERSHIP ATTACK SET' {
        npx vitest run `
            --config vitest.integration.config.ts `
            @integrationFiles
    }
}
else {
    Write-Host "`n[INFO] Integration attack set skipped by caller." -ForegroundColor Yellow
}

Invoke-Checked 'DIFF HYGIENE' {
    git diff --check
}

Write-Host "`n=== TRACK D RESULT ===" -ForegroundColor Cyan
git status --short --branch

Write-Host @'

PASS means:
- Track D stale-eligibility attack is green.
- Asia/Tehran behavior survived multiple runtime TZ processes.
- existing real-Postgres booking/cancellation/read adversarial evidence is green (unless explicitly skipped).
- no Track D foundational domain/schema rule was changed.

Discovery M3 endpoint binding remains intentionally deferred.
'@ -ForegroundColor Green
