@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Load language strings (optional, continue if not found)
if exist "%~dp0load_language.bat" (
    call "%~dp0load_language.bat" 2>nul
)

REM Set default values if not loaded
if not defined BATCH_SETUP_TITLE set BATCH_SETUP_TITLE=Stock Accounting System - Setup
if not defined BATCH_SETUP_NODEJS_INSTALLED set BATCH_SETUP_NODEJS_INSTALLED=Node.js is already installed
if not defined BATCH_SETUP_NODEJS_NOT_FOUND set BATCH_SETUP_NODEJS_NOT_FOUND=Node.js is not installed
if not defined BATCH_SETUP_INSTALLING set BATCH_SETUP_INSTALLING=Starting Node.js installation...
if not defined BATCH_SETUP_DOWNLOADING set BATCH_SETUP_DOWNLOADING=Downloading Node.js installer...
if not defined BATCH_SETUP_INSTALLING_DEPS set BATCH_SETUP_INSTALLING_DEPS=Installing project dependencies...
if not defined BATCH_SETUP_SUCCESS set BATCH_SETUP_SUCCESS=Setup completed successfully!
if not defined BATCH_COMMON_ERROR set BATCH_COMMON_ERROR=ERROR
if not defined BATCH_COMMON_INFO set BATCH_COMMON_INFO=INFO
if not defined BATCH_COMMON_SUCCESS set BATCH_COMMON_SUCCESS=SUCCESS
if not defined BATCH_COMMON_WARN set BATCH_COMMON_WARN=WARN

echo ========================================
echo   %BATCH_SETUP_TITLE%
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Node.js is already installed
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [%BATCH_COMMON_INFO%] %BATCH_SETUP_NODEJS_INSTALLED%
    node --version
    npm --version
    echo.
    goto :install_dependencies
)

echo [%BATCH_COMMON_INFO%] %BATCH_SETUP_NODEJS_NOT_FOUND%
echo [%BATCH_COMMON_INFO%] %BATCH_SETUP_INSTALLING%
echo.

REM Check if Chocolatey is installed
where choco >nul 2>&1
if %errorlevel% equ 0 (
    echo [%BATCH_COMMON_INFO%] Chocolatey detected, using Chocolatey to install Node.js...
    echo [%BATCH_COMMON_INFO%] This may require administrator privileges
    echo.
    powershell -Command "Start-Process choco -ArgumentList 'install nodejs-lts -y' -Verb RunAs -Wait"
    if %errorlevel% equ 0 (
        echo [%BATCH_COMMON_SUCCESS%] Node.js installed successfully
        call refreshenv
    ) else (
        echo [%BATCH_COMMON_ERROR%] Chocolatey installation failed, trying alternative method...
        goto :download_nodejs
    )
) else (
    echo [%BATCH_COMMON_INFO%] Chocolatey not found, downloading Node.js installer...
    goto :download_nodejs
)

:download_nodejs
echo [%BATCH_COMMON_INFO%] %BATCH_SETUP_DOWNLOADING%
echo [%BATCH_COMMON_INFO%] Please wait, this may take a few minutes...
echo.

REM Create temp directory
set TEMP_DIR=%TEMP%\stock-accounting-setup
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM Download Node.js LTS installer
set NODE_INSTALLER=%TEMP_DIR%\nodejs-installer.msi
set NODE_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi

echo [%BATCH_COMMON_INFO%] Download URL: %NODE_URL%
echo [%BATCH_COMMON_INFO%] Saving to: %NODE_INSTALLER%
echo.

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%'}"

if not exist "%NODE_INSTALLER%" (
    echo [%BATCH_COMMON_ERROR%] Failed to download Node.js installer
    echo [%BATCH_COMMON_INFO%] Please download and install Node.js manually from:
    echo        https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [%BATCH_COMMON_INFO%] Node.js installer downloaded successfully
echo [%BATCH_COMMON_INFO%] Starting installation...
echo [%BATCH_COMMON_INFO%] Please follow the installation wizard
echo.

REM Run installer
start /wait msiexec /i "%NODE_INSTALLER%" /quiet /norestart

REM Refresh environment variables
call refreshenv 2>nul

REM Wait a bit for PATH to update
timeout /t 3 /nobreak >nul

REM Refresh PATH in current session
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%B"
set "PATH=%SYSTEM_PATH%"

REM Verify installation
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [%BATCH_COMMON_SUCCESS%] Node.js installed successfully
    node --version
    npm --version
    echo.
) else (
    echo [%BATCH_COMMON_ERROR%] Node.js installation completed but not found in PATH
    echo [%BATCH_COMMON_INFO%] Please restart your terminal or restart your computer
    echo [%BATCH_COMMON_INFO%] Then run setup.bat again
    echo.
    pause
    exit /b 1
)

REM Cleanup
if exist "%NODE_INSTALLER%" del "%NODE_INSTALLER%"
if exist "%TEMP_DIR%" rmdir "%TEMP_DIR%" 2>nul

:install_dependencies
echo [%BATCH_COMMON_INFO%] %BATCH_SETUP_INSTALLING_DEPS%
echo [%BATCH_COMMON_INFO%] This may take several minutes...
echo.

REM Install root dependencies
if not exist "node_modules" (
    echo [%BATCH_COMMON_INFO%] Installing root dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [%BATCH_COMMON_ERROR%] Failed to install root dependencies
        pause
        exit /b 1
    )
)

REM Install server dependencies
if not exist "server\node_modules" (
    echo [%BATCH_COMMON_INFO%] Installing server dependencies...
    cd /d "%~dp0server"
    call npm install
    if %errorlevel% neq 0 (
        echo [%BATCH_COMMON_ERROR%] Failed to install server dependencies
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

REM Install client dependencies
if not exist "client\node_modules" (
    echo [%BATCH_COMMON_INFO%] Installing client dependencies...
    cd /d "%~dp0client"
    call npm install
    if %errorlevel% neq 0 (
        echo [%BATCH_COMMON_ERROR%] Failed to install client dependencies
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

echo.
echo [%BATCH_COMMON_SUCCESS%] %BATCH_SETUP_SUCCESS%
echo [%BATCH_COMMON_INFO%] You can now run start.bat to start the system
echo.
pause
