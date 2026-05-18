@echo off
REM Run from app\ — sets PYTHONPATH to repo root so `app.main` imports correctly.
cd /d "%~dp0"
set "PYTHONPATH=%~dp0.."
if not exist "%~dp0main.py" (
  echo ERROR: main.py not found next to this script.
  exit /b 1
)
if not defined PORT set PORT=8101
echo PYTHONPATH=%PYTHONPATH%
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %PORT%
