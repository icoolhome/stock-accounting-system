@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Stock Accounting System - Start (Background)
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found, please install Node.js
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [WARN] server\dist\index.js not found, will build
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [WARN] client\dist not found, will build
    set NEED_BUILD_CLIENT=1
)

if %NEED_BUILD_SERVER%==1 (
    echo [INFO] Building server...
    cd /d "%~dp0server"
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Server build failed
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

if %NEED_BUILD_CLIENT%==1 (
    echo [INFO] Building client...
    cd /d "%~dp0client"
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Client build failed
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

echo [INFO] Starting services in background windows...
echo [INFO] Server: http://localhost:3001
echo [INFO] Client: http://localhost:3000
echo.
echo Services are running in separate windows.
echo You can close this window, services will continue running.
echo Use stop.bat to stop all services.
echo.

timeout /t 2 /nobreak >nul

start "Stock Accounting System - Server" cmd /k "cd /d %~dp0server && npm start"
timeout /t 2 /nobreak >nul
start "Stock Accounting System - Client" cmd /k "cd /d %~dp0client && npm run preview"
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo [OK] Services started!
echo.
pause
exit /b 0





