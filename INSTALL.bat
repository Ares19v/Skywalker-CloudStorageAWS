@echo off
TITLE CompanyDB — Install
color 0A

echo.
echo  =============================================
echo    CompanyDB  ^|  First-Time Setup
echo  =============================================
echo.

REM ── Check Docker ─────────────────────────────────────────────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [!] Docker not found on this machine.
    echo      Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    echo      Then re-run this script.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [!] Docker Desktop is installed but not running.
    echo      Please start Docker Desktop and re-run this script.
    pause
    exit /b 1
)

echo  [OK] Docker is available.
echo.

REM ── Move to project root ─────────────────────────────────────────────────────
cd /d "%~dp0"

REM ── Create .env from example if it doesn't exist ─────────────────────────────
if not exist ".env" (
    echo  [1/3] Creating .env from .env.example...
    copy /Y ".env.example" ".env" >nul
    echo  [!] .env created. Edit it with your credentials if needed.
    echo      For local Docker use, the defaults are already configured.
) else (
    echo  [1/3] .env already exists — skipping.
)

echo.
echo  [2/3] Building and starting all containers...
docker-compose up --build -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Setup failed. Run: docker-compose logs
    pause
    exit /b 1
)

echo  [3/3] Waiting for the stack to be ready...
timeout /t 8 /nobreak >nul

echo.
echo  =============================================
echo    Installation complete!
echo    CompanyDB is running at http://localhost:3000
echo    Default login: admin / admin123
echo  =============================================
echo.
echo  Use Run_Project.bat to launch next time.
echo.
start "" "http://localhost:3000"
pause
