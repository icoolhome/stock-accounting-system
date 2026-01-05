@echo off
setlocal enabledelayedexpansion
chcp 936 >nul 2>&1
echo ========================================
echo   嘖?炵緙 - 礿砦督
echo ========================================
echo.

cd /d "%~dp0"

echo [揃?] 淏婓脤礿砦督...
echo.

set STOPPED=0

REM 礿砦傷諳 3001 腔筳最ㄗ摽傷侜督ㄘ
echo [揃?] 脤傷諳 3001ㄗ摽傷侜督ㄘ...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    set PID=%%a
    echo [揃?] 追政筳最 PID: !PID! 淏婓屠?傷諳 3001
    taskkill /F /PID !PID! 2>nul
    if !errorlevel! equ 0 (
        echo [俇傖] 眒礿砦傷諳 3001 腔筳最ㄗPID: !PID!ㄘ
        set STOPPED=1
    ) else (
        echo [劑豢] 楊礿砦筳最 PID: !PID!ㄛ褫夔剒猁奪燴癹
    )
)

REM 礿砦傷諳 3000 腔筳最ㄗ傷侜督ㄘ
echo [揃?] 脤傷諳 3000ㄗ傷侜督ㄘ...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    echo [揃?] 追政筳最 PID: !PID! 淏婓屠?傷諳 3000
    taskkill /F /PID !PID! 2>nul
    if !errorlevel! equ 0 (
        echo [俇傖] 眒礿砦傷諳 3000 腔筳最ㄗPID: !PID!ㄘ
        set STOPPED=1
    ) else (
        echo [劑豢] 楊礿砦筳最 PID: !PID!ㄛ褫夔剒猁奪燴癹
    )
)

echo.
echo [揃?] 婬棒脤傷諳...
timeout /t 2 /nobreak >nul

set REMAINING=0
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set REMAINING=1

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 set REMAINING=1

if !REMAINING! equ 0 (
    echo [俇傖] 垀衄督眒傖髡礿砦
) else (
    echo [劑豢] 衄督婓綅俴ㄛ?脤傷諳 3000 睿 3001
)

echo.
echo [俇傖] 礿砦霜最俇傖
pause
