@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   啟動後端服務器
echo ========================================
echo.

cd /d server
npm start

pause


