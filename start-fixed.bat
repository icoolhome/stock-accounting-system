@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   股票記帳系統 - 啟動伺服器
echo ========================================
echo.

REM 切換到腳本所在目錄
cd /d "%~dp0"
echo [調試] 當前目錄: %CD%
echo.

REM 檢查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js，請先安裝 Node.js
    echo 下載地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 檢查必要的文件並決定是否需要建置
set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [警告] server\dist\index.js 不存在，將進行建置
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [警告] client\dist 不存在，將進行建置
    set NEED_BUILD_CLIENT=1
)

REM 建置伺服器
if %NEED_BUILD_SERVER%==1 (
    echo [資訊] 正在建置伺服器...
    cd /d "%~dp0server"
    if not exist "package.json" (
        echo [錯誤] 找不到 server\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 伺服器建置失敗
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [OK] 伺服器建置完成
)

REM 建置客戶端
if %NEED_BUILD_CLIENT%==1 (
    echo [資訊] 正在建置客戶端...
    cd /d "%~dp0client"
    if not exist "package.json" (
        echo [錯誤] 找不到 client\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 客戶端建置失敗
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [OK] 客戶端建置完成
)

REM 啟動服務
echo.
echo [資訊] 啟動伺服器（後端 API）...
start "股票記帳系統 - 伺服器" cmd /k "cd /d %~dp0server && npm start"

timeout /t 3 /nobreak >nul

echo [資訊] 啟動客戶端（前端）...
start "股票記帳系統 - 客戶端" cmd /k "cd /d %~dp0client && npm run preview"

timeout /t 5 /nobreak >nul

echo [資訊] 開啟瀏覽器...
start http://localhost:3000

echo.
echo ========================================
echo   系統已啟動！
echo ========================================
echo.
echo 伺服器運行在: http://localhost:3001
echo 客戶端運行在: http://localhost:3000
echo.
echo 瀏覽器已自動開啟
echo 按任意鍵關閉此窗口（服務器將繼續運行）
echo.
pause >nul
exit /b 0


