@echo off
title DEVPRO Wall Builder
echo ========================================
echo   DEVPRO Wall Builder - Starting...
echo ========================================
echo.

:: Change to the repo directory (update this path to match your machine)
cd /d "%~dp0"
cd ..

echo Pulling latest code from GitHub...
:: Auto-detect the current branch
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
echo Current branch: %BRANCH%
git pull origin %BRANCH%
echo.

echo Installing dependencies...
cd devpro-wall-builder
call npm install --silent
echo.

echo Starting dev server on port 5174...
echo Opening browser in 3 seconds...

:: Open browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5174"

:: Start the dev server (this blocks until you close the window)
call npx vite --port 5174
