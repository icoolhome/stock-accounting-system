@echo off
chcp 65001 > nul
cd /d "%~dp0"
node start-node.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause
