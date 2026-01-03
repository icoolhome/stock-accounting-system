@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Stock Accounting System - Setup
echo ========================================
echo.

echo [1/5] Checking Node.js installation...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo [OK] Node.js is installed
echo.

echo [2/5] Installing root dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install root dependencies
    pause
    exit /b 1
)
echo [OK] Root dependencies installed
echo.

echo [3/5] Installing server dependencies...
cd /d server
call npm install
if errorlevel 1 (
    cd /d ..
    echo [ERROR] Failed to install server dependencies
    pause
    exit /b 1
)
cd /d ..
echo [OK] Server dependencies installed
echo.

echo [4/5] Installing client dependencies...
cd /d client
call npm install
if errorlevel 1 (
    cd /d ..
    echo [ERROR] Failed to install client dependencies
    pause
    exit /b 1
)
cd /d ..
echo [OK] Client dependencies installed
echo.

echo [5/5] Building project...
echo Building server...
cd /d server
call npm run build
if errorlevel 1 (
    cd /d ..
    echo [ERROR] Failed to build server
    pause
    exit /b 1
)
cd /d ..
echo [OK] Server build completed
echo.

echo Building client...
cd /d client
call npm run build
if errorlevel 1 (
    cd /d ..
    echo [ERROR] Failed to build client
    pause
    exit /b 1
)
cd /d ..
echo [OK] Client build completed
echo.

echo ========================================
echo   Setup completed!
echo ========================================
echo.
echo You can now run start.bat to start the system
echo.
pause
exit /b 0