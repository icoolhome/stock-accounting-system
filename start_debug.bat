@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM 錯誤處理：確保錯誤時不會立即退出
if errorlevel 1 (
    echo [錯誤] 初始化失敗
    pause
    exit /b 1
)

echo ========================================
echo   股票記帳系統 - 啟動
echo ========================================
echo.

cd /d "%~dp0"
if errorlevel 1 (
    echo [錯誤] 無法切換到腳本目錄
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js，請先安裝 Node.js
    echo 下載網址: https://nodejs.org/
    pause
    exit /b 1
)

set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [提示] 找不到 server\dist\index.js，將進行編譯
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [提示] 找不到 client\dist，將進行編譯
    set NEED_BUILD_CLIENT=1
)

if !NEED_BUILD_SERVER! equ 1 (
    echo [資訊] 正在編譯後端服務...
    cd /d "%~dp0server"
    if not exist "package.json" (
        echo [錯誤] 找不到 server\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 後端服務編譯失敗
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [完成] 後端服務編譯完成
)

if !NEED_BUILD_CLIENT! equ 1 (
    echo [資訊] 正在編譯前端服務...
    cd /d "%~dp0client"
    if not exist "package.json" (
        echo [錯誤] 找不到 client\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [錯誤] 前端服務編譯失敗
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [完成] 前端服務編譯完成
)

echo.
echo ========================================
echo   請選擇啟動模式
echo ========================================
echo   1. 正常模式 (顯示視窗)
echo   2. 背景模式 (隱藏視窗)
echo ========================================
echo.
set /p MODE="請選擇模式 (1 或 2，預設 1): "

if "%MODE%"=="" set MODE=1
if "%MODE%"=="2" goto background_mode
if "%MODE%"=="1" goto normal_mode
goto normal_mode

:normal_mode
echo.
echo [資訊] 以正常模式啟動服務（顯示視窗）...
echo [資訊] 後端服務: http://localhost:3001
echo [資訊] 前端服務: http://localhost:3000
echo.
echo ========================================
echo   注意: 請不要關閉此視窗
echo   ========================================
echo   服務將在此視窗中運行。
echo   使用 Ctrl+C 來停止所有服務。
echo ========================================
echo.

cd /d "%~dp0"

REM 檢查 package.json 是否存在
if not exist "package.json" (
    echo [錯誤] 找不到根目錄的 package.json
    echo 當前目錄: %CD%
    pause
    exit /b 1
)

REM 檢查 node_modules 是否存在
if not exist "node_modules" (
    echo [警告] 找不到 node_modules，嘗試安裝依賴...
    call npm install
    if errorlevel 1 (
        echo [錯誤] npm install 失敗
        pause
        exit /b 1
    )
)

REM 使用 concurrently 在同一視窗中運行所有服務
if exist "node_modules\concurrently\dist\bin\concurrently.js" (
    REM 使用 PowerShell 在背景窗口打開瀏覽器（不顯示新窗口）
    powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 10; Start-Process 'http://localhost:3000'"
    call npm start
    if errorlevel 1 (
        echo [錯誤] npm start 執行失敗
        pause
        exit /b 1
    )
) else (
    echo [錯誤] 找不到 concurrently，請先執行: npm install
    echo 正在嘗試自動安裝...
    call npm install
    if errorlevel 1 (
        echo [錯誤] npm install 失敗，請手動執行: npm install
        pause
        exit /b 1
    )
    if exist "node_modules\concurrently\dist\bin\concurrently.js" (
        powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 10; Start-Process 'http://localhost:3000'"
        call npm start
    ) else (
        echo [錯誤] 安裝後仍找不到 concurrently
        pause
        exit /b 1
    )
)

exit /b 0

:background_mode
echo.
echo [資訊] 以背景模式啟動服務...
echo [資訊] 後端服務: http://localhost:3001
echo [資訊] 前端服務: http://localhost:3000
echo.

set VBS_BACKEND=%TEMP%\start_backend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_BACKEND!"
echo WshShell.CurrentDirectory = "%~dp0server" >> "!VBS_BACKEND!"
echo WshShell.Run "cmd /c npm start", 0, False >> "!VBS_BACKEND!"

echo [資訊] 正在啟動後端服務...
cscript //nologo "!VBS_BACKEND!"
if errorlevel 1 (
    echo [錯誤] 啟動後端服務失敗
    pause
    exit /b 1
)

echo [資訊] 等待後端服務啟動...
timeout /t 5 /nobreak >nul

:check_backend_bg
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_backend_bg
)

echo [完成] 後端服務已啟動

set VBS_FRONTEND=%TEMP%\start_frontend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_FRONTEND!"
echo WshShell.CurrentDirectory = "%~dp0" >> "!VBS_FRONTEND!"
echo WshShell.Run "cmd /c npm run start:client", 0, False >> "!VBS_FRONTEND!"

echo [資訊] 正在啟動前端服務...
cscript //nologo "!VBS_FRONTEND!"
if errorlevel 1 (
    echo [錯誤] 啟動前端服務失敗
    pause
    exit /b 1
)

echo [資訊] 等待前端服務啟動...
timeout /t 8 /nobreak >nul

:check_frontend_bg
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_frontend_bg
)

echo [完成] 前端服務已啟動
echo [資訊] 正在打開瀏覽器...
start http://localhost:3000

del "!VBS_BACKEND!" >nul 2>&1
del "!VBS_FRONTEND!" >nul 2>&1

echo.
echo [完成] 服務已以背景模式啟動。
echo [資訊] 後端和前端服務在隱藏視窗中運行。
echo [資訊] 要停止服務，您可以：
echo       1. 執行 stop.bat
echo       2. 使用任務管理器結束 node.exe 進程
echo       3. 手動關閉隱藏的服務視窗
echo.
pause
exit /b 0
