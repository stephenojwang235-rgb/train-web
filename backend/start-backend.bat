@echo off
REM NICC Campus Ministry - persistent backend host launcher.
REM Starts server.js in the background (no console window) ONLY if port 5000 is free,
REM so the API stays served on :5000 after reboot / idle sessions (idempotent).
set "BACKEND_DIR=%~dp0"
cd /d "%BACKEND_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "$b = '%BACKEND_DIR%'; $inUse = $false; try { $tcp = New-Object Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1',5000); $tcp.Close(); $inUse = $true } catch { $inUse = $false }; if (-not $inUse) { Start-Process node -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $b -WindowStyle Hidden }"
echo NICC backend host launcher fired (port 5000 checked; server.js started if it was free).