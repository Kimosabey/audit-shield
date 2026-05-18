# Run API from repo root (fixes "No module named 'app'" if you were inside app/).
# Or use run-all-dev.ps1 to start this plus Vite in one go (new PowerShell window for the API).
# Usage: .\run-dev.ps1   OR   from repo root: powershell -ExecutionPolicy Bypass -File .\run-dev.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\app\main.py")) {
    Write-Error "Run this script from the audit-shield repository root (folder that contains app/ and this file)."
}

$port = if ($env:PORT) { $env:PORT } else { "8101" }
Write-Host "Starting AuditShield API on port $port (cwd: $(Get-Location))" -ForegroundColor Cyan
$shareScript = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\print-share-urls.ps1"
if (Test-Path $shareScript) { & $shareScript -Port $port } else { Write-Host "(Tip: open the suite folder so ..\scripts\print-share-urls.ps1 exists.)" -ForegroundColor DarkGray }
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
