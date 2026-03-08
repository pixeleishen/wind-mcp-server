@echo off
REM ============================================================
REM PostgreSQL Database Setup Script (No Password Required)
REM Temporarily modifies pg_hba.conf to allow local trust auth
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo Wind MCP Server - PostgreSQL Setup (No Password Mode)
echo ============================================================
echo.

REM ---- Check if running as Administrator ----
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator
    echo Right-click setup_no_password.bat and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM ---- Check if PostgreSQL is installed ----
echo [1/7] Checking PostgreSQL installation...
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL is not installed or not in PATH.
    echo.
    echo Please install PostgreSQL first:
    echo   winget install PostgreSQL.PostgreSQL.16
    echo.
    echo Or add PostgreSQL to PATH:
    echo   set PATH=%%PATH%%;C:\Program Files\PostgreSQL\16\bin
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('psql --version') do set PG_VERSION=%%i
echo [OK] Found: %PG_VERSION%
echo.

REM ---- Check if PostgreSQL service is running ----
echo [2/7] Checking PostgreSQL service status...
pg_isready >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL service is not running.
    echo.
    echo Please start the service:
    echo   net start postgresql-x64-16
    echo.
    pause
    exit /b 1
)
echo [OK] PostgreSQL service is running
echo.

REM ---- Backup pg_hba.conf ----
echo [3/7] Backing up pg_hba.conf...
set PG_DATA=C:\Program Files\PostgreSQL\16\data
set PG_HBA=%PG_DATA%\pg_hba.conf
set PG_HBA_BACKUP=%PG_DATA%\pg_hba.conf.backup

copy "%PG_HBA%" "%PG_HBA_BACKUP%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to backup pg_hba.conf
    echo Make sure you're running as Administrator
    echo.
    pause
    exit /b 1
)
echo [OK] Backup created: pg_hba.conf.backup
echo.

REM ---- Modify pg_hba.conf to use trust authentication ----
echo [4/7] Temporarily enabling trust authentication...
powershell -Command "(Get-Content '%PG_HBA%') -replace 'scram-sha-256', 'trust' | Set-Content '%PG_HBA%'"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to modify pg_hba.conf
    copy "%PG_HBA_BACKUP%" "%PG_HBA%" >nul 2>&1
    pause
    exit /b 1
)
echo [OK] Authentication method changed to trust
echo.

REM ---- Reload PostgreSQL configuration ----
echo [5/7] Reloading PostgreSQL configuration...
psql -U postgres -c "SELECT pg_reload_conf();" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Failed to reload config, restarting service...
    net stop postgresql-x64-16 >nul 2>&1
    timeout /t 2 >nul
    net start postgresql-x64-16 >nul 2>&1
    timeout /t 3 >nul
)
echo [OK] Configuration reloaded
echo.

REM ---- Create user and database ----
echo [6/7] Setting up database...
echo.

echo   - Creating user 'quant'...
psql -U postgres -c "CREATE USER quant WITH PASSWORD 'quant123';" 2>nul
if %errorlevel% equ 0 (
    echo     [OK] User 'quant' created
) else (
    echo     [INFO] User 'quant' already exists
)

echo   - Creating database 'quantdb'...
psql -U postgres -c "CREATE DATABASE quantdb OWNER quant;" 2>nul
if %errorlevel% equ 0 (
    echo     [OK] Database 'quantdb' created
) else (
    echo     [INFO] Database 'quantdb' already exists
)

echo   - Running schema initialization...
psql -U quant -d quantdb -f "%~dp0init\01_schema.sql" >nul 2>&1
if %errorlevel% neq 0 (
    echo     [ERROR] Failed to run schema script
    copy "%PG_HBA_BACKUP%" "%PG_HBA%" >nul 2>&1
    psql -U postgres -c "SELECT pg_reload_conf();" >nul 2>&1
    echo.
    pause
    exit /b 1
)
echo     [OK] Schema initialized
echo.

REM ---- Restore pg_hba.conf ----
echo [7/7] Restoring original authentication settings...
copy "%PG_HBA_BACKUP%" "%PG_HBA%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Failed to restore pg_hba.conf
    echo Please manually restore from: %PG_HBA_BACKUP%
) else (
    echo [OK] Original settings restored
    del "%PG_HBA_BACKUP%" >nul 2>&1
)

REM ---- Reload configuration again ----
psql -U postgres -c "SELECT pg_reload_conf();" >nul 2>&1
if %errorlevel% neq 0 (
    net stop postgresql-x64-16 >nul 2>&1
    timeout /t 2 >nul
    net start postgresql-x64-16 >nul 2>&1
)
echo.

REM ---- Verify setup ----
echo Verifying setup...
set PGPASSWORD=quant123
psql -U quant -d quantdb -c "\dt meta.*" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Schema verification failed
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Setup Complete!
echo ============================================================
echo.
echo Connection details:
echo   Host:     localhost
echo   Port:     5432
echo   Database: quantdb
echo   User:     quant
echo   Password: quant123
echo.
echo Connection string:
echo   postgresql://quant:quant123@localhost:5432/quantdb
echo.
echo Next steps:
echo   1. Create etl/.env file (copy from etl/.env.example)
echo   2. Run ETL: cd etl ^&^& python run_all.py
echo.
pause
