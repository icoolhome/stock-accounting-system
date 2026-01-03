@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Check Backend Server Status
echo ========================================
echo.

echo [INFO] Checking if backend server is running on port 3001...
echo.

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend server is NOT running on port 3001
    echo [INFO] Please start the backend server first:
    echo        cd server
    echo        npm start
    echo.
) else (
    echo [OK] Backend server is running on port 3001
    echo.
    netstat -ano | findstr ":3001" | findstr "LISTENING"
    echo.
)

echo [INFO] Checking if frontend server is running on port 3000...
echo.

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Frontend server is NOT running on port 3000
    echo.
) else (
    echo [OK] Frontend server is running on port 3000
    echo.
    netstat -ano | findstr ":3000" | findstr "LISTENING"
    echo.
)

echo [INFO] Testing backend connection...
echo.

curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Cannot connect to backend server at http://localhost:3001/api/health
    echo [INFO] Backend server may not be running or may have errors
    echo.
) else (
    echo [OK] Backend server is responding
    echo.
    curl -s http://localhost:3001/api/health
    echo.
)

pause
exit /b 0


