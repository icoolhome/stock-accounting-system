@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   ?∠巨閮董蝟餌絞 - ??隡箸???
echo ========================================
echo.

REM ???啗?祆??函??
cd /d "%~dp0"
echo [隤輯岫] ?嗅??桅?: %CD%
echo.

REM 瑼Ｘ Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [?航炊] ?曆???Node.js嚗???鋆?Node.js
    echo 銝??啣?: https://nodejs.org/
    pause
    exit /b 1
)

REM 瑼Ｘ敹???隞嗡蒂瘙箏??臬?閬遣蝵?
set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [霅血?] server\dist\index.js 銝??剁?撠脰?撱箇蔭
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [霅血?] client\dist 銝??剁?撠脰?撱箇蔭
    set NEED_BUILD_CLIENT=1
)

REM 撱箇蔭隡箸???
if %NEED_BUILD_SERVER%==1 (
    echo [鞈?] 甇?撱箇蔭隡箸???..
    cd /d "%~dp0server"
    if not exist "package.json" (
        echo [?航炊] ?曆???server\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [?航炊] 隡箸??典遣蝵桀仃??
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [OK] 隡箸??典遣蝵桀???
)

REM 撱箇蔭摰Ｘ蝡?
if %NEED_BUILD_CLIENT%==1 (
    echo [鞈?] 甇?撱箇蔭摰Ｘ蝡?..
    cd /d "%~dp0client"
    if not exist "package.json" (
        echo [?航炊] ?曆???client\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [?航炊] 摰Ｘ蝡臬遣蝵桀仃??
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [OK] 摰Ｘ蝡臬遣蝵桀???
)

REM ????
echo.
echo [鞈?] ??隡箸??剁?敺垢 API嚗?..
start "?∠巨閮董蝟餌絞 - 隡箸??? cmd /k "cd /d %~dp0server && npm start"

timeout /t 3 /nobreak >nul

echo [鞈?] ??摰Ｘ蝡荔??垢嚗?..
start "?∠巨閮董蝟餌絞 - 摰Ｘ蝡? cmd /k "cd /d %~dp0client && npm run preview"

timeout /t 5 /nobreak >nul

echo [鞈?] ???汗??..
start http://localhost:3000

echo.
echo ========================================
echo   蝟餌絞撌脣???
echo ========================================
echo.
echo 隡箸??券?銵: http://localhost:3001
echo 摰Ｘ蝡舫?銵: http://localhost:3000
echo.
echo ?汗?典歇?芸???
echo ?遙???甇斤???????典?蝜潛???嚗?
echo.
pause >nul
exit /b 0





