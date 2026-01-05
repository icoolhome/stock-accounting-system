@echo off
echo ========================================
echo   Debug Start.bat
echo ========================================
echo.

echo ?嗅??桅?: %CD%
echo ?單?桅?: %~dp0
echo.

cd /d "%~dp0"
echo ??敺?? %CD%
echo.

echo 瑼Ｘ server\dist\index.js...
if exist "server\dist\index.js" (
    echo [OK] server\dist\index.js 摮
) else (
    echo [X] server\dist\index.js 銝???
)
echo.

echo 瑼Ｘ client\dist...
if exist "client\dist" (
    echo [OK] client\dist 摮
) else (
    echo [X] client\dist 銝???
)
echo.

echo 瑼Ｘ Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js ?芸?鋆?
) else (
    echo [OK] Node.js 撌脣?鋆?
    node --version
)
echo.

echo 瑼Ｘ server\package.json...
if exist "server\package.json" (
    echo [OK] server\package.json 摮
) else (
    echo [X] server\package.json 銝???
)
echo.

echo 瑼Ｘ client\package.json...
if exist "client\package.json" (
    echo [OK] client\package.json 摮
) else (
    echo [X] client\package.json 銝???
)
echo.

pause





