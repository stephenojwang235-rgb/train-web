@echo off
REM NICC Campus Ministry - full-site launcher (backend + frontend).
REM Idempotent: only starts each server if its port is free.
echo ============================================
echo   NICC Campus Ministry - Starting Servers
echo ============================================

REM --- 1. Backend (port 5000) ---
set "BACKEND_DIR=%~dp0backend"
cd /d "%BACKEND_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "$b = '%BACKEND_DIR%'; $inUse = $false; try { $tcp = New-Object Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1',5000); $tcp.Close(); $inUse = $true } catch { $inUse = $false }; if (-not $inUse) { Start-Process node -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $b -WindowStyle Hidden; Write-Host 'Backend started' } else { Write-Host 'Backend already running on :5000' }"

REM --- 2. Frontend (port 5173) ---
set "FRONTEND_DIR=%~dp0"
cd /d "%FRONTEND_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "$b = '%FRONTEND_DIR%'; $inUse = $false; try { $tcp = New-Object Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1',5173); $tcp.Close(); $inUse = $true } catch { $inUse = $false }; if (-not $inUse) { Start-Process node -FilePath 'node' -ArgumentList 'node_modules/vite/bin/vite.js','--host','--port','5173' -WorkingDirectory $b -WindowStyle Hidden; Write-Host 'Frontend started' } else { Write-Host 'Frontend already running on :5173' }"

echo.
echo Both servers checked. Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173/login
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo ============================================