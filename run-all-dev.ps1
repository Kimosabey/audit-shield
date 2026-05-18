# Start AuditShield API (new window) + Vite dev server (this window).
# Fixes Vite proxy ECONNREFUSED when the API was not running on :8101.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

if (-not (Test-Path (Join-Path $Root "app\main.py"))) {
    Write-Error "Run from audit-shield repo root (folder containing app/ and web/)."
}

$SuiteRoot = Split-Path $Root -Parent
$ShareScript = Join-Path $SuiteRoot "scripts\print-share-urls.ps1"
$apiCmd = @"
Set-Location -LiteralPath '$Root'
if (Test-Path '$ShareScript') { & '$ShareScript' -Port 8101 }
Write-Host 'AuditShield API (port 8101) — Ctrl+C to stop' -ForegroundColor Cyan
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8101
"@

Start-Process powershell -WorkingDirectory $Root -ArgumentList @(
    "-NoProfile",
    "-NoExit",
    "-Command",
    $apiCmd
)

Write-Host "Opened API in a new window; waiting 2s before Vite..." -ForegroundColor DarkGray
Write-Host "Vite will listen on all interfaces — use the Network URL it prints for phones / other PCs." -ForegroundColor DarkGray
Start-Sleep -Seconds 2

Set-Location -LiteralPath (Join-Path $Root "web")
if (-not (Test-Path "node_modules")) {
    npm install
}
npm run dev
