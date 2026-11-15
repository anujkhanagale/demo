@echo off
setlocal
cd /d "%~dp0"
set "PORT=5173"
set "NODE_ENV=development"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required. Install Node.js, then start the site again.
  exit /b 1
)

call npm.cmd start
if errorlevel 1 (
  echo.
  echo CUSTOM CLANS stopped because the server failed to start. Check the error above.
  pause
  exit /b 1
)
