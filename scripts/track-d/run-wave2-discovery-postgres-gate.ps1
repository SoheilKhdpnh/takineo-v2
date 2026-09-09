param(
    [string]$Repo = 'C:\Users\sohei\takineo-v2-wave2-track-d',
    [int[]]$Scales = @(1000),
    [switch]$SkipQuality
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

Write-Host "`n=== TRACK D / WAVE 2 M3 POSTGRES + SCALE GATE ===" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($env:TEST_DATABASE_URL)) {
    throw @'
TEST_DATABASE_URL is not set in this PowerShell process.

Load the existing dedicated takineo_test credential first.
Do not point this gate at DATABASE_URL, DIRECT_URL, Neon, or takineo_e2e.
'@
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

Write-Host '[PASS] Dedicated local takineo_test identity is selected.' -ForegroundColor Green

git status --short --branch

Invoke-Checked 'REAL POSTGRES DISCOVERY ADVERSARIAL ACCEPTANCE' {
    npx vitest run `
        --config vitest.integration.config.ts `
        tests/integration/wave2-discovery-postgres-adversarial.test.ts
}

foreach ($scale in $Scales) {
    if ($scale -notin @(1000, 10000, 50000)) {
        throw "Unsupported synthetic scale: $scale"
    }

    $env:TRACK_D_DISCOVERY_SCALE = [string]$scale

    try {
        Invoke-Checked "SYNTHETIC POSTGRES DISCOVERY SCALE = $scale" {
            npx vitest run `
                --config vitest.integration.config.ts `
                tests/integration/wave2-discovery-synthetic-scale.test.ts
        }
    }
    finally {
        Remove-Item Env:TRACK_D_DISCOVERY_SCALE -ErrorAction SilentlyContinue
    }
}

if (-not $SkipQuality) {
    Invoke-Checked 'M3 UNIT / SECURITY REGRESSION' {
        npx vitest run `
            tests/unit/security/wave2-discovery-service-adversarial.test.ts `
            tests/unit/security/wave2-discovery-route-adversarial.test.ts `
            tests/unit/security/wave2-stale-discovery-eligibility-adversarial.test.ts `
            tests/unit/booking/teacher-discovery.service.test.ts `
            tests/unit/booking/teacher-discovery-route.test.ts `
            tests/unit/booking/batch-bookable-availability.service.test.ts
    }

    Invoke-Checked 'LINT' {
        npm run lint
    }

    Invoke-Checked 'TYPECHECK' {
        npm run typecheck
    }
}

Invoke-Checked 'DIFF HYGIENE' {
    git diff --check
}

Write-Host "`n=== TRACK D M3 POSTGRES GATE STATE ===" -ForegroundColor Cyan
git status --short --branch
git diff --stat

Write-Host @'

Interpretation rule:
- correctness/privacy/query-shape failures are Track D findings;
- N+1, unbounded scans/horizons/page size, O(all-teachers) page work,
  or OFFSET/skip are architectural blockers;
- p50/p95/p99 numbers alone are observations, not Wave 2 launch SLAs.

The line beginning TRACK_D_DISCOVERY_SCALE_METRIC is the machine-readable
evidence record for each requested scale.
'@ -ForegroundColor Green
