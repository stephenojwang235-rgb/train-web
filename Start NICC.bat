@echo off
REM ============================================
REM   NICC Campus Ministry - One-Click Launcher
REM ============================================
title NICC Campus Ministry
set "PROJECT_DIR=%~dp0"
set "LOG_DIR=%PROJECT_DIR%.local-logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo   Starting NICC Campus Ministry...
echo.

REM --- Start Backend (port 5000) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$b=[Environment]::GetEnvironmentVariable('PROJECT_DIR'); $log=[Environment]::GetEnvironmentVariable('LOG_DIR'); $busy=Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue; if (-not $busy) { Start-Process node -ArgumentList 'backend/server.js' -WorkingDirectory $b -RedirectStandardOutput (Join-Path $log 'backend.log') -RedirectStandardError (Join-Path $log 'backend-error.log'); Write-Host '  [1/2] Starting backend server...' } else { Write-Host '  [1/2] Backend already running.' }"

REM --- Start Frontend (port 5173) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$b=[Environment]::GetEnvironmentVariable('PROJECT_DIR'); $log=[Environment]::GetEnvironmentVariable('LOG_DIR'); $busy=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if (-not $busy) { Start-Process node -ArgumentList 'node_modules/vite/bin/vite.js','--host','--port','5173' -WorkingDirectory $b -RedirectStandardOutput (Join-Path $log 'frontend.log') -RedirectStandardError (Join-Path $log 'frontend-error.log'); Write-Host '  [2/2] Starting frontend server...' } else { Write-Host '  [2/2] Frontend already running.' }"

REM --- Wait for the site, then open the canonical login route ---
echo   Waiting for the website to be ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ready=$false; 1..30 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173/login' -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ready=$true; break } } catch {}; Start-Sleep -Milliseconds 500 }; if (-not $ready) { Write-Host 'Website did not start. Check .local-logs\backend-error.log and frontend-error.log.' -ForegroundColor Red; exit 1 }"
if errorlevel 1 goto :failed

start http://localhost:5173/login
echo.
echo ============================================
echo   Website: http://localhost:5173/login
echo   Backend: http://localhost:5000
echo ============================================
echo.
pause
exit /b 0

:failed
echo.
echo Startup failed. See logs in "%LOG_DIR%".
pause
exit /b 1

