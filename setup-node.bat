@echo off
chcp 65001 > nul
cd /d "%~dp0"
node setup.js
if errorlevel 1 (
    echo.
    echo ?瑁???銝剔?隤歹??航炊隞?Ⅳ: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause