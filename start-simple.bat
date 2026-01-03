@echo off
chcp 65001 >nul 2>&1
cls
echo ========================================
echo   股票記帳系統 - 啟動伺服器
echo ========================================
echo.

cd /d "%~dp0"

REM 檢查建置文件
if not exist "server\dist\index.js" (
    echo [建置] 正在建置伺服器...
    cd server
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 伺服器建置失敗
        pause
        exit /b 1
    )
    cd ..
)

if not exist "client\dist" (
    echo [建置] 正在建置客戶端...
    cd client
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 客戶端建置失敗
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo [啟動] 正在啟動服務器...
echo.

REM 啟動後端
cd server
start "後端服務器" cmd /k "npm start"
cd ..

timeout /t 3 /nobreak >nul

REM 啟動前端
cd client
start "前端服務器" cmd /k "npm run preview"
cd ..

timeout /t 5 /nobreak >nul

echo [開啟] 正在開啟瀏覽器...
start http://localhost:3000

echo.
echo ========================================
echo   系統已啟動！
echo ========================================
echo.
echo 後端: http://localhost:3001
echo 前端: http://localhost:3000
echo.
echo 按任意鍵關閉此窗口
pause >nul

