@echo off
setlocal enabledelayedexpansion
chcp 936 >nul 2>&1
echo ========================================
echo   股票記帳系統 - 停止服務
echo ========================================
echo.

cd /d "%~dp0"

echo [資訊] 正在檢查並停止服務...
echo.

set STOPPED=0

REM 停止端口 3001 的進程（後端）
echo [資訊] 檢查端口 3001（後端伺服器）...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    echo [資訊] 發現進程 PID: !PID! 正在監聽端口 3001
    taskkill /F /PID !PID! 2>nul
    if !errorlevel! equ 0 (
        echo [完成] 已停止端口 3001 的進程（PID: !PID!）
        set STOPPED=1
    ) else (
        echo [警告] 無法停止進程 PID: !PID!，可能需要管理員權限
    )
)

REM 停止端口 3000 的進程（前端）
echo [資訊] 檢查端口 3000（前端伺服器）...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    echo [資訊] 發現進程 PID: !PID! 正在監聽端口 3000
    taskkill /F /PID !PID! 2>nul
    if !errorlevel! equ 0 (
        echo [完成] 已停止端口 3000 的進程（PID: !PID!）
        set STOPPED=1
    ) else (
        echo [警告] 無法停止進程 PID: !PID!，可能需要管理員權限
    )
)

REM 等待一下讓進程完全停止
timeout /t 1 /nobreak >nul 2>&1

REM 再次檢查端口是否還在監聽
echo.
echo [資訊] 再次檢查端口狀態...
netstat -ano 2>nul | findstr ":3000 :3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [完成] 所有服務已成功停止
    set ALL_STOPPED=1
) else (
    echo [警告] 部分服務可能仍在運行
    echo [資訊] 正在顯示仍在監聽的端口：
    netstat -ano 2>nul | findstr ":3000"
    netstat -ano 2>nul | findstr ":3001"
    set ALL_STOPPED=0
)

REM 如果還有進程在運行，提供更詳細的幫助信息
if !ALL_STOPPED! equ 0 (
    echo.
    echo [提示] 如果服務仍在運行，請嘗試以下方法：
    echo       1. 以管理員身份運行此腳本
    echo       2. 在工作管理員中手動結束 node.exe 進程
    echo       3. 如果使用正常模式，關閉相關的命令視窗
    echo       4. 使用命令列手動停止：taskkill /F /PID [進程ID]
)

echo.
echo [完成] 停止過程完成
echo.
pause
exit /b 0
