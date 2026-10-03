#Requires -Version 5.1
# Start Next.js against local Docker Postgres/LiveKit.
# Clears session DATABASE_URL/DIRECT_URL so .env.docker wins over a stale :5432 shell export.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$envFile = Join-Path $root ".env.docker"
if (-not (Test-Path $envFile)) {
  $example = Join-Path $root ".env.docker.example"
  if (Test-Path $example) {
    Copy-Item $example $envFile
    Write-Host "Created .env.docker from example"
  } else {
    throw "Missing .env.docker - copy .env.docker.example first."
  }
}

# Internal job routes fail closed without a secret; generate a local one once.
$envLines = @(Get-Content $envFile)
if (-not ($envLines | Where-Object { $_ -match '^INTERNAL_JOB_SECRET=.{32,}$' })) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = ([Convert]::ToBase64String($bytes)) -replace '[+/=]', ''
  $envLines = @($envLines | Where-Object { $_ -notmatch '^INTERNAL_JOB_SECRET=' })
  $envLines += "INTERNAL_JOB_SECRET=$secret"
  Set-Content -Path $envFile -Value $envLines
  Write-Host "Generated INTERNAL_JOB_SECRET in .env.docker"
}

Copy-Item $envFile (Join-Path $root ".env.local") -Force

# Stale PowerShell exports override Next.js .env.local - clear them first.
@(
  "DATABASE_URL",
  "DIRECT_URL",
  "PRISMA_DATABASE_ADAPTER",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "LIVE_SESSION_PROVIDER",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_WS_URL",
  "LIVEKIT_HTTP_URL"
) | ForEach-Object {
  Remove-Item "Env:$_" -ErrorAction SilentlyContinue
}

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
  Set-Item -Path "Env:$name" -Value $value
}

$dbHost = ([Uri]$env:DATABASE_URL).Authority
Write-Host "dev-local DATABASE=$dbHost adapter=$env:PRISMA_DATABASE_ADAPTER"

docker compose up -d postgres livekit jobs | Out-Host

npm run dev
