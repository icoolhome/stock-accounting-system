@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Load language strings
call "%~dp0load_language.bat" 2>nul

REM Set default values if not loaded
if not defined BATCH_START_TITLE set BATCH_START_TITLE=股票記帳系統 - 啟動
if not defined BATCH_START_NODEJS_NOT_FOUND set BATCH_START_NODEJS_NOT_FOUND=Node.js not found
if not defined BATCH_START_RUN_SETUP set BATCH_START_RUN_SETUP=Please run setup.bat first to install Node.js
if not defined BATCH_START_SELECT_MODE set BATCH_START_SELECT_MODE=請選擇啟動模式
if not defined BATCH_START_MODE_NORMAL set BATCH_START_MODE_NORMAL=正常模式（顯示視窗）
if not defined BATCH_START_MODE_BACKGROUND set BATCH_START_MODE_BACKGROUND=後台模式（隱藏視窗）
if not defined BATCH_START_STARTING_NORMAL set BATCH_START_STARTING_NORMAL=Starting in normal mode...
if not defined BATCH_START_STARTING_BACKGROUND set BATCH_START_STARTING_BACKGROUND=Starting in background mode...
if not defined BATCH_START_BACKEND set BATCH_START_BACKEND=Backend
if not defined BATCH_START_FRONTEND set BATCH_START_FRONTEND=Frontend
if not defined BATCH_START_OPENING_BROWSER set BATCH_START_OPENING_BROWSER=Opening browser in
if not defined BATCH_START_OPENING_NOW set BATCH_START_OPENING_NOW=Opening browser now...
if not defined BATCH_START_SERVICES_RUNNING set BATCH_START_SERVICES_RUNNING=Services are running
if not defined BATCH_START_USE_STOP set BATCH_START_USE_STOP=Use stop.bat to stop all services
if not defined BATCH_START_SELECT_MODE_PROMPT set BATCH_START_SELECT_MODE_PROMPT=請選擇模式（1或2，預設1）：
if not defined BATCH_COMMON_ERROR set BATCH_COMMON_ERROR=ERROR
if not defined BATCH_COMMON_INFO set BATCH_COMMON_INFO=INFO
if not defined BATCH_COMMON_SUCCESS set BATCH_COMMON_SUCCESS=SUCCESS
if not defined BATCH_COMMON_WARN set BATCH_COMMON_WARN=WARN

echo ========================================
echo   %BATCH_START_TITLE%
echo ========================================
echo.

cd /d "%~dp0"

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [%BATCH_COMMON_ERROR%] %BATCH_START_NODEJS_NOT_FOUND%
    echo [%BATCH_COMMON_INFO%] %BATCH_START_RUN_SETUP%
    pause
    exit /b 1
)

REM Check dependencies
if not exist "node_modules" (
    echo [%BATCH_COMMON_WARN%] Dependencies not installed
    echo [%BATCH_COMMON_INFO%] Running npm install...
    call npm install
    if errorlevel 1 (
        echo [%BATCH_COMMON_ERROR%] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check build
set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [%BATCH_COMMON_INFO%] Building server...
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [%BATCH_COMMON_INFO%] Building client...
    set NEED_BUILD_CLIENT=1
)

if !NEED_BUILD_SERVER! equ 1 (
    cd /d "%~dp0server"
    call npm run build
    if errorlevel 1 (
        echo [%BATCH_COMMON_ERROR%] Server build failed
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

if !NEED_BUILD_CLIENT! equ 1 (
    cd /d "%~dp0client"
    call npm run build
    if errorlevel 1 (
        echo [%BATCH_COMMON_ERROR%] Client build failed
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

echo.
echo ========================================
echo   %BATCH_START_SELECT_MODE%
echo ========================================
echo   1. %BATCH_START_MODE_NORMAL%
echo   2. %BATCH_START_MODE_BACKGROUND%
echo ========================================
echo.
set /p MODE=%BATCH_START_SELECT_MODE_PROMPT%

if "%MODE%"=="" set MODE=1

if "%MODE%"=="2" goto background_mode
if "%MODE%"=="1" goto normal_mode
goto normal_mode

:normal_mode
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_STARTING_NORMAL%
echo [%BATCH_COMMON_INFO%] %BATCH_START_BACKEND%: http://localhost:3001
echo [%BATCH_COMMON_INFO%] %BATCH_START_FRONTEND%: http://localhost:3000
echo.

REM Start services using concurrently in new window
cd /d "%~dp0"
start "Stock Accounting System - Services" cmd /k "npm start"

REM Display countdown while services start
echo.
echo ========================================
echo   %BATCH_START_SERVICES_RUNNING%...
echo ========================================
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_OPENING_BROWSER% 5 seconds...
echo.
for /l %%i in (5,-1,1) do (
    echo [%%i] %BATCH_START_OPENING_BROWSER% %%i seconds...
    timeout /t 1 /nobreak >nul
    if %%i gtr 1 (
        echo.
    )
)
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_OPENING_NOW%
start http://localhost:3000
echo.
echo [%BATCH_COMMON_SUCCESS%] Browser opened
echo [%BATCH_COMMON_INFO%] Services are running in a separate window
echo [%BATCH_COMMON_INFO%] You can close this window if you want
echo.
pause

goto end

:background_mode
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_STARTING_BACKGROUND%
echo [%BATCH_COMMON_INFO%] %BATCH_START_BACKEND%: http://localhost:3001
echo [%BATCH_COMMON_INFO%] %BATCH_START_FRONTEND%: http://localhost:3000
echo.

REM Create VBS scripts to run in background
set VBS_BACKEND=%TEMP%\start_backend_%RANDOM%.vbs
set VBS_FRONTEND=%TEMP%\start_frontend_%RANDOM%.vbs

REM Backend VBS
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_BACKEND!"
echo WshShell.CurrentDirectory = "%~dp0server" >> "!VBS_BACKEND!"
echo WshShell.Run "cmd /c npm start", 0, False >> "!VBS_BACKEND!"

REM Frontend VBS
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_FRONTEND!"
echo WshShell.CurrentDirectory = "%~dp0" >> "!VBS_FRONTEND!"
echo WshShell.Run "cmd /c npm run start:client", 0, False >> "!VBS_FRONTEND!"

REM Start backend
echo [%BATCH_COMMON_INFO%] Starting %BATCH_START_BACKEND%...
cscript //nologo "!VBS_BACKEND!" >nul 2>&1

REM Wait for backend
echo [%BATCH_COMMON_INFO%] Waiting for %BATCH_START_BACKEND% to start...
timeout /t 5 /nobreak >nul

:check_backend
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_backend
)

echo [%BATCH_COMMON_SUCCESS%] %BATCH_START_BACKEND% started

REM Start frontend
echo [%BATCH_COMMON_INFO%] Starting %BATCH_START_FRONTEND%...
cscript //nologo "!VBS_FRONTEND!" >nul 2>&1

REM Wait for frontend
echo [%BATCH_COMMON_INFO%] Waiting for %BATCH_START_FRONTEND% to start...
timeout /t 8 /nobreak >nul

:check_frontend
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_frontend
)

echo [%BATCH_COMMON_SUCCESS%] %BATCH_START_FRONTEND% started

REM Open browser with countdown
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_OPENING_BROWSER% 5 seconds...
echo.
for /l %%i in (5,-1,1) do (
    echo [%%i] %BATCH_START_OPENING_BROWSER% %%i seconds...
    timeout /t 1 /nobreak >nul
)
echo.
echo [%BATCH_COMMON_INFO%] %BATCH_START_OPENING_NOW%
start http://localhost:3000

REM Save VBS file paths for stop.bat
echo !VBS_BACKEND! > "%TEMP%\stock_backend_vbs.txt"
echo !VBS_FRONTEND! > "%TEMP%\stock_frontend_vbs.txt"

echo.
echo [%BATCH_COMMON_SUCCESS%] Services started in background
echo [%BATCH_COMMON_INFO%] %BATCH_START_USE_STOP%
echo.
pause

:end
exit /b 0
