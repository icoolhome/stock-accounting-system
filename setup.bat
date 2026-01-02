@echo off
chcp 65001 >nul
echo ========================================
echo   股票記帳系統 - 一鍵安裝與建置
echo ========================================
echo.

echo [1/5] 檢查 Node.js 安裝...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 未找到 Node.js，請先安裝 Node.js
    echo 下載地址: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo [OK] Node.js 已安裝
echo.

echo [2/5] 安裝根目錄依賴...
call npm install
if %errorlevel% neq 0 (
    echo [錯誤] 根目錄依賴安裝失敗
    pause
    exit /b 1
)
echo [OK] 根目錄依賴安裝完成
echo.

echo [3/5] 安裝伺服器依賴...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [錯誤] 伺服器依賴安裝失敗
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] 伺服器依賴安裝完成
echo.

echo [4/5] 安裝客戶端依賴...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [錯誤] 客戶端依賴安裝失敗
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] 客戶端依賴安裝完成
echo.

echo [5/5] 建置專案...
echo 建置伺服器...
cd server
call npm run build
if %errorlevel% neq 0 (
    echo [錯誤] 伺服器建置失敗
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] 伺服器建置完成
echo.

echo 建置客戶端...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo [錯誤] 客戶端建置失敗
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] 客戶端建置完成
echo.

echo ========================================
echo   安裝與建置完成！
echo ========================================
echo.
echo 現在可以執行 start.bat 啟動系統
echo.
pause

