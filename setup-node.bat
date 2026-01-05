@echo off
cd /d "%~dp0"
node setup.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause

