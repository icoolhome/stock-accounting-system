@echo off
setlocal enabledelayedexpansion
chcp 936 >nul 2>&1
echo ========================================
echo   嘖?炵緙 - 
echo ========================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [嶒悷] 梑祥善 Node.jsㄛ?假娊 Node.js
    echo 狟徭鋒硊: https://nodejs.org/
    pause
    exit /b 1
)

set NEED_BUILD_SERVER=0
set NEED_BUILD_CLIENT=0

if not exist "server\dist\index.js" (
    echo [劑豢] 梑祥善 server\dist\index.jsㄛ筳俴膘离
    set NEED_BUILD_SERVER=1
)

if not exist "client\dist" (
    echo [劑豢] 梑祥善 client\distㄛ筳俴膘离
    set NEED_BUILD_CLIENT=1
)

if !NEED_BUILD_SERVER! equ 1 (
    echo [揃?] 膘离侜督...
    cd /d "%~dp0server"
    if not exist "package.json" (
        echo [嶒悷] 梑祥善 server\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [嶒悷] 侜督膘离囮
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [俇傖] 侜督膘离俇傖
)

if !NEED_BUILD_CLIENT! equ 1 (
    echo [揃?] 膘离諦傷...
    cd /d "%~dp0client"
    if not exist "package.json" (
        echo [嶒悷] 梑祥善 client\package.json
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    call npm run build
    if errorlevel 1 (
        echo [嶒悷] 諦傷膘离囮
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo [俇傖] 諦傷膘离俇傖
)

echo.
echo ========================================
echo   腢綅俴耀宒
echo ========================================
echo   1. 淏都耀宒 (淕磁?敦)
echo   2. 掖劓耀宒 (螛紲?敦)
echo ========================================
echo.
set /p MODE="?腢耀宒 (1 麼 2ㄛ蕼偞 1): "

if "%MODE%"=="" set MODE=1
if "%MODE%"=="2" goto background_mode
if "%MODE%"=="1" goto normal_mode
goto normal_mode

:normal_mode
echo.
echo [揃?] 眕淏都耀宒督ㄗ淕磁?敦ㄘ...
echo [揃?] 侜督: http://localhost:3001
echo [揃?] 諦傷: http://localhost:3000
echo.
echo ========================================
echo   笭猁: ?昦燊寯森?敦ㄐ
echo   ========================================
echo   督淏婓森?敦笢綅俴﹝
echo   妏蚚 Ctrl+C 褫礿砦垀衄督﹝
echo ========================================
echo.

cd /d "%~dp0"

REM 妏蚚 concurrently 婓肮珨?敦諳笢綅俴垀衄督
if exist "node_modules\concurrently\dist\bin\concurrently.js" (
    REM ?膘霹蠶?燴恅璃晊腷湖嶱罜
    set OPEN_BROWSER=%TEMP%\open_browser_%RANDOM%.bat
    echo @echo off > "!OPEN_BROWSER!"
    echo timeout /t 10 /nobreak ^>nul 2^>^&1 >> "!OPEN_BROWSER!"
    echo start http://localhost:3000 >> "!OPEN_BROWSER!"
    echo del "%%~f0" >> "!OPEN_BROWSER!"
    start "" "!OPEN_BROWSER!"
    call npm start
) else (
    echo [嶒悷] 梑祥善 concurrentlyㄛ?珂俴: npm install
    pause
    exit /b 1
)

exit /b 0

:background_mode
echo.
echo [揃?] 眕掖劓耀宒督...
echo [揃?] 侜督: http://localhost:3001
echo [揃?] 諦傷: http://localhost:3000
echo.

set VBS_BACKEND=%TEMP%\start_backend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_BACKEND!"
echo WshShell.CurrentDirectory = "%~dp0server" >> "!VBS_BACKEND!"
echo WshShell.Run "cmd /c npm start", 0, False >> "!VBS_BACKEND!"

echo [揃?] 淏婓摽傷侜督...
cscript //nologo "!VBS_BACKEND!"

echo [揃?] 脹渾摽傷侜督...
timeout /t 5 /nobreak >nul

:check_backend_bg
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_backend_bg
)

echo [俇傖] 摽傷侜督眒憩髯

set VBS_FRONTEND=%TEMP%\start_frontend_hidden.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "!VBS_FRONTEND!"
echo WshShell.CurrentDirectory = "%~dp0" >> "!VBS_FRONTEND!"
echo WshShell.Run "cmd /c npm run start:client", 0, False >> "!VBS_FRONTEND!"

echo [揃?] 淏婓傷侜督...
cscript //nologo "!VBS_FRONTEND!"

echo [揃?] 脹渾傷侜督...
timeout /t 8 /nobreak >nul

:check_frontend_bg
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto check_frontend_bg
)

echo [俇傖] 傷侜督眒憩髯
echo [揃?] 淏婓嶱罜...
start http://localhost:3000

del "!VBS_BACKEND!" >nul 2>&1
del "!VBS_FRONTEND!" >nul 2>&1

echo.
echo [俇傖] 督眒眕掖劓耀宒﹝
echo [揃?] 侜督睿諦傷淏婓螛紲?敦笢綅俴﹝
echo [揃?] 猁礿砦督ㄛ蠟褫眕ㄩ
echo       1. 俴 stop.bat
echo       2. 妏蚚馱釬奪燴磐旰 node.exe 最唗
echo       3. 忒燊寯螛紲腔韜鍔?敦
echo.
pause
exit /b 0
