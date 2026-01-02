@echo off
chcp 65001 >nul
echo ========================================
echo   股票記帳系統 - 啟動伺服器
echo ========================================
echo.

REM 檢查是否已建置
if not exist "server\dist\index.js" (
    echo [警告] 伺服器尚未建置，正在建置...
    cd server
    call npm run build
    if %errorlevel% neq 0 (
        echo [錯誤] 伺服器建置失敗
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

if not exist "client\dist" (
    echo [警告] 客戶端尚未建置，正在建置...
    cd client
    call npm run build
    if %errorlevel% neq 0 (
        echo [錯誤] 客戶端建置失敗
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

echo [資訊] 啟動伺服器（後端 API）...
start "股票記帳系統 - 伺服器" cmd /k "cd server && npm start"

REM 等待伺服器啟動
timeout /t 3 /nobreak >nul

echo [資訊] 啟動客戶端（前端）...
start "股票記帳系統 - 客戶端" cmd /k "cd client && npm run preview"

REM 等待客戶端啟動
timeout /t 5 /nobreak >nul

echo [資訊] 開啟瀏覽器...
start http://localhost:4173

echo.
echo ========================================
echo   系統已啟動！
echo ========================================
echo.
echo 伺服器運行在: http://localhost:3001
echo 客戶端運行在: http://localhost:4173
echo.
echo 瀏覽器已自動開啟
echo 按 Ctrl+C 可停止伺服器
echo.
pause

