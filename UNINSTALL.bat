@echo off
TITLE CompanyDB — Uninstall
color 0C

echo.
echo  =============================================
echo    CompanyDB  ^|  Uninstall / Teardown
echo  =============================================
echo.
echo  WARNING: This will stop and remove all containers,
echo           networks, and persistent database volumes.
echo           All stored data will be permanently deleted.
echo.
set /p CONFIRM=  Type YES to confirm: 

if /i NOT "%CONFIRM%"=="YES" (
    echo.
    echo  Aborted. No changes made.
    pause
    exit /b 0
)

cd /d "%~dp0"

echo.
echo  [1/3] Stopping all CompanyDB containers...
docker-compose down

echo.
echo  [2/3] Removing persistent volumes (database data)...
docker-compose down -v

echo.
echo  [3/3] Removing built Docker images...
docker rmi companydb-app 2>nul || echo      (image not found — already clean)
docker image prune -f >nul 2>&1

echo.
echo  =============================================
echo    CompanyDB has been fully removed.
echo    Run INSTALL.bat to set it up again.
echo  =============================================
echo.
pause
