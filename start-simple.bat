@echo off
chcp 65001 >nul 2>&1
cls
echo ========================================
echo   ?∠巨閮董蝟餌絞 - ??隡箸???
echo ========================================
echo.

cd /d "%~dp0"

REM 瑼Ｘ撱箇蔭?辣
if not exist "server\dist\index.js" (
    echo [撱箇蔭] 甇?撱箇蔭隡箸???..
    cd server
    call npm run build
    if errorlevel 1 (
        echo [?航炊] 隡箸??典遣蝵桀仃??
        pause
        exit /b 1
    )
    cd ..
)

if not exist "client\dist" (
    echo [撱箇蔭] 甇?撱箇蔭摰Ｘ蝡?..
    cd client
    call npm run build
    if errorlevel 1 (
        echo [?航炊] 摰Ｘ蝡臬遣蝵桀仃??
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo [??] 甇???????..
echo.

REM ??敺垢
cd server
start "敺垢???? cmd /k "npm start"
cd ..

timeout /t 3 /nobreak >nul

REM ???垢
cd client
start "?垢???? cmd /k "npm run preview"
cd ..

timeout /t 5 /nobreak >nul

echo [??] 甇????汗??..
start http://localhost:3000

echo.
echo ========================================
echo   蝟餌絞撌脣???
echo ========================================
echo.
echo 敺垢: http://localhost:3001
echo ?垢: http://localhost:3000
echo.
echo ?遙???甇斤???
pause >nul





