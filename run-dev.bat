@echo off
cd /d "%~dp0"
if not exist "app\main.py" (
  echo ERROR: Run from audit-shield repo root (folder with app\ and this file).
  exit /b 1
)
set PORT=8101
if exist "%~dp0..\scripts\print-share-urls.ps1" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\print-share-urls.ps1" -Port %PORT%
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %PORT%
