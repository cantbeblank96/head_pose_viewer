@echo off
setlocal

cd /d "%~dp0"
set "PORT=8000"
if not "%~1"=="" set "PORT=%~1"

echo Starting Head Pose Viewer at http://localhost:%PORT%/
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1" -Port %PORT%

pause
