@echo off
TITLE Skywalker — Local Launcher
color 0A

echo.
echo  =============================================
echo    Skywalker  ^|  Local Docker Stack
echo  =============================================
echo.

REM ── Check Docker is installed and running ────────────────────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Docker not found. Run INSTALL.bat first.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Docker Desktop is not running.
    echo  Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM ── Move to the project root (same folder as this .bat file) ─────────────────
cd /d "%~dp0"

echo  [1/3] Pulling any updated images...
docker-compose pull --quiet

echo  [2/3] Starting full stack (DB + S3 emulator + App)...
docker-compose up --build -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] docker-compose failed. Check the logs with:
    echo          docker-compose logs
    pause
    exit /b 1
)

echo  [3/3] Waiting for the app to become ready...
timeout /t 6 /nobreak >nul

echo.
echo  =============================================
echo    Skywalker is LIVE at http://localhost:3000
echo    Default login: admin / admin123
echo  =============================================
echo.

REM ── Open the browser ─────────────────────────────────────────────────────────
start "" "http://localhost:3000"

echo  Press any key to view live logs (Ctrl+C to stop)...
pause >nul
docker-compose logs -f app
