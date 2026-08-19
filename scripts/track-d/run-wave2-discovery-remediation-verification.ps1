param(
    [string]$Repo = 'C:\Users\sohei\takineo-v2-wave2-track-d',
    [string]$Candidate = '087d55da6d0a403048fc83208c1407c09382039a'
)

$ErrorActionPreference = 'Stop'
Set-Location $Repo

function Invoke-Checked {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "=== $Label ===" -ForegroundColor Cyan

    & $Action

    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

Write-Host ""
Write-Host "=== TRACK D PUBLIC DISCOVERY REMEDIATION CANDIDATE VERIFICATION ===" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($env:TEST_DATABASE_URL)) {
    throw "TEST_DATABASE_URL is not set. Use only the existing isolated local takineo_test credential."
}

$parsed = [System.Uri]$env:TEST_DATABASE_URL

if (
    $parsed.Host -ne '127.0.0.1' -or
    $parsed.Port -ne 5432 -or
    $parsed.AbsolutePath.TrimStart('/') -ne 'takineo_test' -or
    $parsed.UserInfo.Split(':', 2)[0] -ne 'takineo_test'
) {
    throw 'Refusing noncanonical TEST_DATABASE_URL identity.'
}

Write-Host '[PASS] Dedicated local takineo_test identity selected.' -ForegroundColor Green

git cat-file -e "$Candidate^{commit}"
if ($LASTEXITCODE -ne 0) {
    throw "Candidate commit is not available locally: $Candidate"
}

$sourceIsAncestor = $false

git merge-base --is-ancestor $Candidate HEAD 2>$null
if ($LASTEXITCODE -eq 0) {
    $sourceIsAncestor = $true
}

$trailerPattern = "(cherry picked from commit $Candidate)"

$cherryPickCommit = @(
    git log `
        --format='%H' `
        --fixed-strings `
        --grep="$trailerPattern" `
        -n 1 `
        HEAD
) | Select-Object -First 1

if (
    -not $sourceIsAncestor -and
    [string]::IsNullOrWhiteSpace($cherryPickCommit)
) {
    throw "Exact candidate $Candidate is neither directly in ancestry nor present through an -x cherry-pick."
}

if (-not $sourceIsAncestor) {
    $sourcePatch = @(
        git show `
            --pretty=format: `
            $Candidate |
        git patch-id --stable
    )

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to compute source candidate patch-id.'
    }

    $importedPatch = @(
        git show `
            --pretty=format: `
            $cherryPickCommit |
        git patch-id --stable
    )

    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to compute imported candidate patch-id.'
    }

    $sourcePatchId =
        (($sourcePatch -join "`n") -split '\s+')[0]

    $importedPatchId =
        (($importedPatch -join "`n") -split '\s+')[0]

    if (
        [string]::IsNullOrWhiteSpace($sourcePatchId) -or
        [string]::IsNullOrWhiteSpace($importedPatchId) -or
        $sourcePatchId -ne $importedPatchId
    ) {
        throw "Cherry-picked candidate patch-id does not match source $Candidate."
    }

    Write-Host "[PASS] Exact source candidate verified through -x cherry-pick $cherryPickCommit." -ForegroundColor Green
}
else {
    Write-Host '[PASS] Exact source candidate is directly present in ancestry.' -ForegroundColor Green
}

Write-Host ""
Write-Host "=== CANDIDATE IDENTITY ==="
git show --no-patch --format='%H%n%P%n%s%n%B' $Candidate

Invoke-Checked 'PRISMA GENERATE' {
    npm run db:generate
}

Invoke-Checked 'PRISMA VALIDATE' {
    npm run db:validate
}

Write-Host ""
Write-Host "=== APPLY CANDIDATE MIGRATIONS TO ISOLATED TEST DATABASE ===" -ForegroundColor Cyan

$hadDirectUrl =
    Test-Path Env:DIRECT_URL

$previousDirectUrl =
    $env:DIRECT_URL

try {
    $env:DIRECT_URL =
        $env:TEST_DATABASE_URL

    npm run db:migrate:deploy

    if ($LASTEXITCODE -ne 0) {
        throw "Prisma migrate deploy failed with exit code $LASTEXITCODE."
    }
}
finally {
    if ($hadDirectUrl) {
        $env:DIRECT_URL =
            $previousDirectUrl
    }
    else {
        Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
    }
}

Write-Host '[PASS] Candidate migrations applied to isolated takineo_test.' -ForegroundColor Green

foreach ($scale in @(1000, 10000)) {
    $env:TRACK_D_DISCOVERY_REMEDIATION_SCALE =
        [string]$scale

    try {
        Invoke-Checked "ORIGINAL ADVERSARIAL DISTRIBUTION - SCALE $scale" {
            npx vitest run `
                --config vitest.integration.config.ts `
                tests/integration/wave2-discovery-remediation-candidate.test.ts
        }
    }
    finally {
        Remove-Item Env:TRACK_D_DISCOVERY_REMEDIATION_SCALE -ErrorAction SilentlyContinue
    }
}

Invoke-Checked 'TRACK A PROJECTION INVARIANT REGRESSION' {
    npx vitest run `
        --config vitest.integration.config.ts `
        tests/integration/wave2-public-teacher-discovery-projection.test.ts
}

Invoke-Checked 'TRACK D M3 UNIT / SECURITY REGRESSION' {
    npx vitest run `
        tests/unit/security/wave2-discovery-service-adversarial.test.ts `
        tests/unit/security/wave2-discovery-route-adversarial.test.ts `
        tests/unit/security/wave2-stale-discovery-eligibility-adversarial.test.ts `
        tests/unit/booking/teacher-discovery.service.test.ts `
        tests/unit/booking/teacher-discovery-route.test.ts `
        tests/unit/booking/batch-bookable-availability.service.test.ts `
        tests/unit/booking/public-teacher-discovery-eligibility.service.test.ts
}

Invoke-Checked 'TYPECHECK' {
    npm run typecheck
}

Invoke-Checked 'LINT' {
    npm run lint
}

Invoke-Checked 'DIFF HYGIENE' {
    git diff --check
}

Write-Host ""
Write-Host "=== RELIABILITY FOLLOW-UP - NON-BLOCKING ===" -ForegroundColor Yellow
Write-Host 'Continue tracking: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.'
Write-Host 'This warning does NOT affect the discovery architectural-blocker verdict.'

Write-Host ""
Write-Host "=== FINAL TRACK D CANDIDATE VERIFICATION STATE ===" -ForegroundColor Cyan
git status --short --branch

Write-Host ""
Write-Host 'DO NOT RUN 50K.' -ForegroundColor Yellow
Write-Host 'Return both TRACK_D_DISCOVERY_REMEDIATION_METRIC lines and the final summaries.'
Write-Host ''
Write-Host 'Closure requires at BOTH 1k and 10k:' -ForegroundColor Cyan
Write-Host '  projectionCandidateRowsExamined <= 41'
Write-Host '  teacherProfileRowsFetched = O(40), population-independent'
Write-Host '  eligibilityUserLookups = 0'
Write-Host '  eligibilityIntroVideoLookups = 0'
Write-Host '  availabilityQueryCount = 3 and page-bounded'
Write-Host '  returnedTeacherCount = 40'
Write-Host '  deterministicAscending = true'
Write-Host '  duplicateAcrossPages = false'
Write-Host '  positiveOffsetObserved = false'
Write-Host ''
Write-Host 'Latency values are observations only.'
