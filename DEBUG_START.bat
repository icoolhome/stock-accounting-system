@echo off
echo ========================================
echo   Debug Start.bat
echo ========================================
echo.

echo 當前目錄: %CD%
echo 腳本目錄: %~dp0
echo.

cd /d "%~dp0"
echo 切換後目錄: %CD%
echo.

echo 檢查 server\dist\index.js...
if exist "server\dist\index.js" (
    echo [OK] server\dist\index.js 存在
) else (
    echo [X] server\dist\index.js 不存在
)
echo.

echo 檢查 client\dist...
if exist "client\dist" (
    echo [OK] client\dist 存在
) else (
    echo [X] client\dist 不存在
)
echo.

echo 檢查 Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js 未安裝
) else (
    echo [OK] Node.js 已安裝
    node --version
)
echo.

echo 檢查 server\package.json...
if exist "server\package.json" (
    echo [OK] server\package.json 存在
) else (
    echo [X] server\package.json 不存在
)
echo.

echo 檢查 client\package.json...
if exist "client\package.json" (
    echo [OK] client\package.json 存在
) else (
    echo [X] client\package.json 不存在
)
echo.

pause


