@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Load language strings
call "%~dp0load_language.bat" 2>nul

REM Set default values if not loaded
if not defined BATCH_STOP_TITLE set BATCH_STOP_TITLE=Stock Accounting System - Stop
if not defined BATCH_STOP_STOPPING set BATCH_STOP_STOPPING=Stopping all Node.js processes...
if not defined BATCH_STOP_SUCCESS set BATCH_STOP_SUCCESS=All services stopped
if not defined BATCH_STOP_WARN set BATCH_STOP_WARN=Some services may still be running
if not defined BATCH_COMMON_ERROR set BATCH_COMMON_ERROR=ERROR
if not defined BATCH_COMMON_INFO set BATCH_COMMON_INFO=INFO
if not defined BATCH_COMMON_SUCCESS set BATCH_COMMON_SUCCESS=SUCCESS
if not defined BATCH_COMMON_WARN set BATCH_COMMON_WARN=WARN

echo ========================================
echo   %BATCH_STOP_TITLE%
echo ========================================
echo.

echo [%BATCH_COMMON_INFO%] %BATCH_STOP_STOPPING%
echo.

REM Kill all node.exe processes related to this project
for /f "tokens=2" %%a in ('netstat -ano ^| findstr ":3000\|:3001" ^| findstr "LISTENING"') do (
    for /f "tokens=5" %%b in ('tasklist /FI "PID eq %%a" /FO CSV ^| findstr "node.exe"') do (
        echo [%BATCH_COMMON_INFO%] Stopping process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Kill all node.exe processes (more aggressive)
taskkill /F /IM node.exe >nul 2>&1

REM Clean up VBS files
if exist "%TEMP%\stock_backend_vbs.txt" (
    for /f %%f in (%TEMP%\stock_backend_vbs.txt) do (
        if exist "%%f" del "%%f" >nul 2>&1
    )
    del "%TEMP%\stock_backend_vbs.txt" >nul 2>&1
)

if exist "%TEMP%\stock_frontend_vbs.txt" (
    for /f %%f in (%TEMP%\stock_frontend_vbs.txt) do (
        if exist "%%f" del "%%f" >nul 2>&1
    )
    del "%TEMP%\stock_frontend_vbs.txt" >nul 2>&1
)

REM Clean up any remaining VBS files
del "%TEMP%\start_backend_*.vbs" >nul 2>&1
del "%TEMP%\start_frontend_*.vbs" >nul 2>&1

REM Wait a moment
timeout /t 1 /nobreak >nul

REM Verify services are stopped
netstat -ano | findstr ":3000\|:3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [%BATCH_COMMON_SUCCESS%] %BATCH_STOP_SUCCESS%
) else (
    echo [%BATCH_COMMON_WARN%] %BATCH_STOP_WARN%
    echo [%BATCH_COMMON_INFO%] Please check Task Manager for remaining node.exe processes
)

echo.
pause
