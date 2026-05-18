# Run API from inside app/ without ModuleNotFoundError.
# Sets PYTHONPATH to the audit-shield repo root so `app` resolves as a package.
# Usage: .\run-uvicorn.ps1   (from this folder)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:PYTHONPATH = $RepoRoot
Set-Location $PSScriptRoot

$port = if ($env:PORT) { $env:PORT } else { "8101" }
Write-Host "PYTHONPATH=$RepoRoot — starting AuditShield API on port $port" -ForegroundColor Cyan
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
