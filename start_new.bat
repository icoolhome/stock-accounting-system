@echo off
chcp 65001 > nul
cd /d "%~dp0"

REM Load language strings
if exist "%~dp0load_language.bat" (
    call "%~dp0load_language.bat" 2>nul
)

REM Set default values if not loaded
if not defined BATCH_START_TITLE set BATCH_START_TITLE=股票記帳系統 - 啟動

node start-node.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause
