@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version from https://nodejs.org, then try again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with the npm package manager enabled.
  pause
  exit /b 1
)

node.exe -e "const [major] = process.versions.node.split('.').map(Number); if (major < 22) { console.error('CUSTOM CLANS needs Node.js 22 or newer. Installed version: ' + process.version); process.exit(1); }"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Installing CUSTOM CLANS dependencies. This may take a few minutes the first time...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

curl.exe --connect-timeout 2 --max-time 4 -fsS -o NUL http://127.0.0.1:5173/api/health >nul 2>nul
if not errorlevel 1 goto open_site

curl.exe --connect-timeout 2 --max-time 4 -fsS -o NUL http://127.0.0.1:5173/ >nul 2>nul
if not errorlevel 1 (
  echo Port 5173 is occupied by a server that is not CUSTOM CLANS.
  echo Close the other app using port 5173, then double-click this launcher again.
  pause
  exit /b 1
)

echo Building the website...
call npm.cmd run build
if errorlevel 1 (
  echo The site build failed. Fix the error above, then try again.
  pause
  exit /b 1
)

echo Starting the CUSTOM CLANS server...
start "CUSTOM CLANS server" /D "%~dp0" "%ComSpec%" /k "call run-server.bat"

echo Waiting for the website to become ready...
for /L %%i in (1,1,30) do (
  curl.exe --connect-timeout 1 --max-time 2 -fsS -o NUL http://127.0.0.1:5173/api/health >nul 2>nul
  if not errorlevel 1 goto open_site
  ping.exe 127.0.0.1 -n 2 -w 1000 >nul
)

echo The website did not start. Check the CUSTOM CLANS server window for the error.
echo You can also visit http://127.0.0.1:5173 after the server reports it is available.
pause
exit /b 1

:open_site
echo CUSTOM CLANS is ready. Opening http://127.0.0.1:5173
start "" "http://127.0.0.1:5173/"
if errorlevel 1 (
  echo The server is running, but Windows could not open your browser automatically.
  echo Copy and paste this address into your browser: http://127.0.0.1:5173
  pause
)
exit /b 0
