param(
    [Parameter(Mandatory = $true)]
    [string[]]$Path
)

$ErrorActionPreference = 'Stop'

$resolved =
    @()

foreach (
    $candidate
    in $Path
) {
    if (
        -not
        (Test-Path -LiteralPath $candidate)
    ) {
        throw "Discovery implementation file not found: $candidate"
    }

    $resolved +=
        (Resolve-Path -LiteralPath $candidate).Path
}

Write-Host "`n=== TRACK D DISCOVERY ARCHITECTURE SCAN ===" -ForegroundColor Cyan
$resolved |
    ForEach-Object {
        Write-Host "SCAN  $_"
    }

function Block-OnMatch {
    param(
        [string]$Name,
        [string]$Pattern
    )

    $match =
        Select-String `
            -LiteralPath $resolved `
            -Pattern $Pattern `
            -CaseSensitive:$false

    if ($match) {
        $match |
            Select-Object Path, LineNumber, Line |
            Format-Table -AutoSize

        throw "ARCHITECTURAL BLOCKER: $Name"
    }

    Write-Host "[PASS] No obvious $Name signature." -ForegroundColor Green
}

Block-OnMatch `
    'SELECT * on discovery/public surface' `
    'SELECT\s+\*'

Block-OnMatch `
    'deep OFFSET/Prisma skip pagination on discovery surface' `
    '\bOFFSET\b|\bskip\s*:'

Block-OnMatch `
    'per-teacher reuse of single-teacher availability service' `
    'getBookableSlotsForTeacher\s*\('

Write-Host @'

Static scan is intentionally narrow. It does NOT prove:
- absence of N+1 through indirect calls;
- bounded recurrence expansion;
- bounded page size;
- bounded historical-session scope;
- DTO allowlisting;
- O(page) rather than O(all teachers).

Those remain executable Track D tests using query spies, payload guards,
hostile pagination values, and database/query-plan evidence after M3 binding.
'@ -ForegroundColor Yellow
