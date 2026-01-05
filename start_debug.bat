@echo off
setlocal enabledelayedexpansion

REM 調試模式：不隱藏輸出
echo [調試] 開始執行 start.bat
echo [調試] 當前目錄: %CD%
echo [調試] 腳本目錄: %~dp0
echo.

chcp 65001
echo [調試] 代碼頁已設置為 65001 (UTF-8)
echo.

cd /d "%~dp0"
echo [調試] 已切換到目錄: %CD%
echo.

where node
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js
    pause
    exit /b 1
) else (
    echo [調試] Node.js 已找到
    node --version
)
echo.

if not exist "package.json" (
    echo [錯誤] 找不到 package.json
    pause
    exit /b 1
) else (
    echo [調試] package.json 存在
)
echo.

if not exist "node_modules" (
    echo [警告] 找不到 node_modules
) else (
    echo [調試] node_modules 存在
)
echo.

if not exist "node_modules\concurrently\dist\bin\concurrently.js" (
    echo [警告] 找不到 concurrently
) else (
    echo [調試] concurrently 存在
)
echo.

echo [調試] 檢查完成，按任意鍵繼續執行原始腳本...
pause
echo.

REM 繼續執行原始邏輯
call start.bat

pause
