@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo  Skywalker CloudStorageAWS (Skywalker Data Vault)
echo ========================================================
echo.

if not exist ".env" (
    echo [1/3] Initializing .env configuration...
    copy /Y ".env.example" ".env" >nul
)

if not exist "node_modules" (
    echo [2/3] Installing dependencies...
    call npm install
)

echo.
echo [3/3] Starting Skywalker Server (Port 3000)...
start "Skywalker Server" cmd /k "node server.js"

ping -n 3 127.0.0.1 >nul 2>&1
start http://localhost:3000

echo.
echo ========================================================
echo  Skywalker is LIVE at: http://localhost:3000
echo  Default Login: admin / admin123
echo ========================================================
