@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
call setup.bat
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)

