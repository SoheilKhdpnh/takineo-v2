param(
    [string]$Repo = (Get-Location).Path,
    [string[]]$Path = @(
        '.\app\api\teachers\route.ts',
        '.\lib\services\teacher-discovery.service.ts',
        '.\lib\services\bookable-slots.service.ts'
    )
)

$ErrorActionPreference = 'Stop'
Set-Location $Repo

Write-Host "`n=== TRACK D DISCOVERY ARCHITECTURE SCAN ===" -ForegroundColor Cyan

$resolved = @()

foreach ($candidate in $Path) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "Discovery architecture scan target is missing: $candidate"
    }

    $item = Get-Item -LiteralPath $candidate

    $resolved += $item.FullName
    Write-Host "SCAN  $($item.FullName)"
}

function Fail-Blocker {
    param(
        [string]$Name,
        [string]$Evidence
    )

    Write-Host "`n[BLOCKER] $Name" -ForegroundColor Red

    if ($Evidence) {
        Write-Host $Evidence
    }

    throw "ARCHITECTURAL BLOCKER: $Name"
}

$combined =
    ($resolved |
        ForEach-Object {
            Get-Content -LiteralPath $_ -Raw
        }) -join "`n"

if ($combined -match '(?im)\bSELECT\s+\*\b') {
    Fail-Blocker `
        -Name 'SELECT * on discovery/public surface' `
        -Evidence 'Raw SELECT * signature found.'
}

Write-Host '[PASS] No obvious SELECT * on discovery/public surface signature.' -ForegroundColor Green

if (
    $combined -match '(?im)\bOFFSET\b' -or
    $combined -match '(?im)\bskip\s*:'
) {
    Fail-Blocker `
        -Name 'deep OFFSET/Prisma skip pagination on discovery surface' `
        -Evidence 'OFFSET/skip signature found.'
}

Write-Host '[PASS] No obvious deep OFFSET/Prisma skip pagination on discovery surface signature.' -ForegroundColor Green

$discoveryService =
    Get-Content `
        -LiteralPath '.\lib\services\teacher-discovery.service.ts' `
        -Raw

if (
    $discoveryService -match
    '\bgetBookableSlotsForTeacher\s*\('
) {
    Fail-Blocker `
        -Name 'N+1 single-teacher availability call from discovery service' `
        -Evidence 'teacher-discovery.service.ts directly calls getBookableSlotsForTeacher().'
}

Write-Host '[PASS] Discovery caller does not invoke single-teacher availability projection.' -ForegroundColor Green

if (
    $discoveryService -notmatch
    '\bgetNextBookableAvailabilityForTeachers\s*\('
) {
    Fail-Blocker `
        -Name 'missing batched next-availability projection' `
        -Evidence 'Discovery caller does not invoke getNextBookableAvailabilityForTeachers().'
}

Write-Host '[PASS] Discovery caller uses batched next-availability projection.' -ForegroundColor Green

if (
    $discoveryService -notmatch
    'TEACHER_DISCOVERY_MAX_PAGE_SIZE\s*=\s*\r?\n?\s*40'
) {
    Fail-Blocker `
        -Name 'unverified discovery page-size ceiling' `
        -Evidence 'Expected M3 page-size ceiling of 40 was not found.'
}

if (
    $discoveryService -notmatch
    'take\s*:\s*\r?\n?\s*input\.limit\s*\+\s*\r?\n?\s*1'
) {
    Fail-Blocker `
        -Name 'page query not bounded by limit + lookahead' `
        -Evidence 'Expected take: input.limit + 1 shape was not found.'
}

Write-Host '[PASS] Discovery query is capped at 40 and uses one-row lookahead.' -ForegroundColor Green

if (
    $discoveryService -notmatch
    'id\s*:\s*\{\s*\r?\n?\s*gt\s*:'
) {
    Fail-Blocker `
        -Name 'missing explicit id keyset boundary' `
        -Evidence 'Expected id > cursor boundary was not found.'
}

if (
    $discoveryService -notmatch
    'orderBy\s*:\s*\{\s*\r?\n?\s*id\s*:\s*\r?\n?\s*"asc"'
) {
    Fail-Blocker `
        -Name 'missing deterministic discovery id ordering' `
        -Evidence 'Expected orderBy id asc was not found.'
}

Write-Host '[PASS] Discovery pagination is explicit id keyset ordering.' -ForegroundColor Green

$batchService =
    Get-Content `
        -LiteralPath '.\lib\services\bookable-slots.service.ts' `
        -Raw

if (
    $batchService -notmatch
    'export\s+async\s+function\s+getNextBookableAvailabilityForTeachers'
) {
    Fail-Blocker `
        -Name 'missing batch availability implementation' `
        -Evidence 'Batch next-availability export is absent.'
}

foreach (
    $tableSignature
    in @(
        '\.teacherAvailabilityRule\s*\r?\n?\s*\.findMany\s*\(',
        '\.teacherAvailabilityException\s*\r?\n?\s*\.findMany\s*\(',
        '\.speakingSession\s*\r?\n?\s*\.findMany\s*\('
    )
) {
    if (
        $batchService -notmatch
        $tableSignature
    ) {
        Fail-Blocker `
            -Name 'missing expected batched discovery read' `
            -Evidence "Missing signature: $tableSignature"
    }
}

Write-Host '[PASS] Batch projection contains recurring-rule, exception, and speaking-session reads.' -ForegroundColor Green

if (
    $batchService -notmatch
    'teacherProfileId\s*:\s*\{\s*\r?\n?\s*in\s*:'
) {
    Fail-Blocker `
        -Name 'batch projection does not use candidate-ID IN filtering' `
        -Evidence 'Expected teacherProfileId: { in: ... } was not found.'
}

Write-Host '[PASS] Batch projection scopes database reads to candidate teacher IDs.' -ForegroundColor Green

if (
    $batchService -notmatch
    'startAt\s*:\s*\{\s*\r?\n?\s*gte\s*:'
) {
    Fail-Blocker `
        -Name 'speaking-session read lacks lower time bound' `
        -Evidence 'Expected startAt.gte bound was not found.'
}

if (
    $batchService -notmatch
    '\blt\s*:\s*\r?\n?\s*rangeEndExclusive'
) {
    Fail-Blocker `
        -Name 'speaking-session read lacks exclusive upper time bound' `
        -Evidence 'Expected startAt.lt rangeEndExclusive bound was not found.'
}

Write-Host '[PASS] Discovery occupied-session query is bounded to the requested Tehran date window.' -ForegroundColor Green

Write-Host "`nTRACK D DISCOVERY ARCHITECTURE STATIC GATE: PASS" -ForegroundColor Green
