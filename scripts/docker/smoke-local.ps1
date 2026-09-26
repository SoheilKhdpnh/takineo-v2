#Requires -Version 5.1
$ErrorActionPreference = "Continue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "takineo docker smoke root=$root"

docker compose up -d postgres livekit
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL docker compose up"
  exit 1
}

$failed = 0

$pgReady = $false
for ($i = 0; $i -lt 45; $i++) {
  docker compose exec -T postgres pg_isready -U takineo -d takineo 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $pgReady = $true
    break
  }
  Start-Sleep -Seconds 2
}

if ($pgReady) {
  Write-Host "PASS postgres-ready"
} else {
  Write-Host "FAIL postgres-ready"
  $failed = 1
}

$lkReady = $false
for ($i = 0; $i -lt 45; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:7880/" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $lkReady = $true
      break
    }
  } catch {
    # still starting
  }
  Start-Sleep -Seconds 2
}

if ($lkReady) {
  Write-Host "PASS livekit-http"
} else {
  Write-Host "FAIL livekit-http"
  $failed = 1
}

docker compose ps
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL compose-ps"
  $failed = 1
} else {
  Write-Host "PASS compose-ps"
}

if ($failed -eq 0) {
  Write-Host "SMOKE PASS postgres + livekit are up"
  exit 0
}

Write-Host "SMOKE FAIL"
exit 1
