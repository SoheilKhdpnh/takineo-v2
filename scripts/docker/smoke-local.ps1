#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "takineo docker smoke — root=$root"

function Assert-Pass([string]$name, [scriptblock]$test) {
  try {
    & $test | Out-Null
    Write-Host "PASS  $name"
    return $true
  } catch {
    Write-Host "FAIL  $name — $($_.Exception.Message)"
    return $false
  }
}

$compose = @(
  "docker", "compose", "up", "-d", "postgres", "livekit"
)
& $compose[0] $compose[1..($compose.Length - 1)]
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAIL  docker compose up"
  exit 1
}

$ok = $true
$deadline = (Get-Date).AddSeconds(90)

$ok = (Assert-Pass "postgres-ready" {
  while ((Get-Date) -lt $deadline) {
    docker compose exec -T postgres pg_isready -U takineo -d takineo 2>$null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw "postgres did not become ready within 90s"
}) -and $ok

$ok = (Assert-Pass "livekit-http" {
  $deadlineLk = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadlineLk) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:7880/" -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      # LiveKit may return connection errors while starting.
    }
    Start-Sleep -Seconds 2
  }
  throw "livekit did not respond on :7880 within 90s"
}) -and $ok

$ok = (Assert-Pass "compose-ps" {
  $ps = docker compose ps --format json 2>$null
  if (-not $ps) { throw "docker compose ps returned empty" }
}) -and $ok

if ($ok) {
  Write-Host "SMOKE PASS — postgres + livekit are up"
  exit 0
}

Write-Host "SMOKE FAIL"
exit 1
