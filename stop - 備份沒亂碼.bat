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

REM 停止端口 3001 的進程（後端伺服器）
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

REM 停止端口 3000 的進程（前端伺服器）
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

echo.
echo [資訊] 再次檢查端口狀態...
timeout /t 2 /nobreak >nul

set REMAINING=0
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set REMAINING=1

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set REMAINING=1

if !REMAINING! equ 0 (
    echo [完成] 所有服務已成功停止
) else (
    echo [警告] 仍有服務在運行，請檢查端口 3000 和 3001
)

echo.
echo [完成] 停止流程完成
pause
