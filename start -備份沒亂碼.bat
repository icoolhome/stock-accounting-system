@echo off
setlocal enabledelayedexpansion
chcp 936 >nul 2>&1
echo ========================================
echo   股票記帳系統 - 啟動
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js，請安裝 Node.js
    echo 下載網址: https://nodejs.org/
    pause
    exit /b 1
)

set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [警告] 找不到 server\dist\index.js，將進行建置
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [警告] 找不到 client\dist，將進行建置
    set NEED_BUILD_CLIENT=1
)

if !NEED_BUILD_SERVER! equ 1 (
    echo [資訊] 建置伺服器...
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
    echo [完成] 伺服器建置完成
)

if !NEED_BUILD_CLIENT! equ 1 (
    echo [資訊] 建置客戶端...
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
    echo [完成] 客戶端建置完成
)

echo.
echo ========================================
echo   選擇運行模式
echo ========================================
echo   1. 正常模式 (整合視窗)
echo   2. 背景模式 (隱藏視窗)
echo ========================================
echo.
set /p MODE="請選擇模式 (1 或 2，預設為 1): "

if "%MODE%"=="" set MODE=1
if "%MODE%"=="2" goto background_mode
if "%MODE%"=="1" goto normal_mode
goto normal_mode

:normal_mode
echo.
echo [資訊] 以正常模式啟動服務（整合視窗）...
echo [資訊] 伺服器: http://localhost:3001
echo [資訊] 客戶端: http://localhost:3000
echo.
echo ========================================
echo   重要: 請勿關閉此視窗！
echo   ========================================
echo   服務正在此視窗中運行。
echo   使用 Ctrl+C 可停止所有服務。
echo ========================================
echo.

cd /d "%~dp0"

REM 使用 concurrently 在同一個窗口中運行所有服務
if exist "node_modules\concurrently\dist\bin\concurrently.js" (
    REM 創建臨時批處理文件來延遲打開瀏覽器
    set OPEN_BROWSER=%TEMP%\open_browser_%RANDOM%.bat
    echo @echo off > "!OPEN_BROWSER!"
    echo timeout /t 10 /nobreak ^>nul 2^>^&1 >> "!OPEN_BROWSER!"
    echo start http://localhost:3000 >> "!OPEN_BROWSER!"
    echo del "%%~f0" >> "!OPEN_BROWSER!"
    start "" "!OPEN_BROWSER!"
    call npm start
) else (
    echo [錯誤] 找不到 concurrently，請先執行: npm install
    pause
    exit /b 1
)

exit /b 0

:background_mode
echo.
echo [資訊] 以背景模式啟動服務...
echo [資訊] 伺服器: http://localhost:3001
echo [資訊] 客戶端: http://localhost:3000
echo.

set VBS_BACKEND=%TEMP%\start_backend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_BACKEND!"
echo WshShell.CurrentDirectory = "%~dp0server" >> "!VBS_BACKEND!"
echo WshShell.Run "cmd /c npm start", 0, False >> "!VBS_BACKEND!"

echo [資訊] 正在啟動後端伺服器...
cscript //nologo "!VBS_BACKEND!"

echo [資訊] 等待後端伺服器啟動...
timeout /t 5 /nobreak >nul

:check_backend_bg
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_backend_bg
)

echo [完成] 後端伺服器已就緒

set VBS_FRONTEND=%TEMP%\start_frontend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_FRONTEND!"
echo WshShell.CurrentDirectory = "%~dp0" >> "!VBS_FRONTEND!"
echo WshShell.Run "cmd /c npm run start:client", 0, False >> "!VBS_FRONTEND!"

echo [資訊] 正在啟動前端伺服器...
cscript //nologo "!VBS_FRONTEND!"

echo [資訊] 等待前端伺服器啟動...
timeout /t 8 /nobreak >nul

:check_frontend_bg
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_frontend_bg
)

echo [完成] 前端伺服器已就緒
echo [資訊] 正在開啟瀏覽器...
start http://localhost:3000

del "!VBS_BACKEND!" >nul 2>&1
del "!VBS_FRONTEND!" >nul 2>&1

echo.
echo [完成] 服務已以背景模式啟動。
echo [資訊] 伺服器和客戶端正在隱藏視窗中運行。
echo [資訊] 要停止服務，您可以：
echo       1. 執行 stop.bat
echo       2. 使用工作管理員結束 node.exe 程序
echo       3. 手動關閉隱藏的命令視窗
echo.
pause
exit /b 0
