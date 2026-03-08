@echo off
REM ============================================================
REM PostgreSQL Database Setup Script for wind-mcp-server
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo Wind MCP Server - PostgreSQL Setup
echo ============================================================
echo.

REM ---- Check if PostgreSQL is installed ----
echo [1/5] Checking PostgreSQL installation...
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
echo [2/5] Checking PostgreSQL service status...
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

REM ---- Prompt for postgres superuser password ----
echo [3/5] Database setup requires postgres superuser access
echo.
set /p PGPASSWORD="Enter postgres superuser password: "
echo.

REM ---- Test connection ----
echo [4/5] Testing connection...
psql -U postgres -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to connect to PostgreSQL.
    echo Please check your postgres password.
    echo.
    pause
    exit /b 1
)
echo [OK] Connection successful
echo.

REM ---- Create user and database ----
echo [5/5] Setting up database...
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
set PGPASSWORD=quant123
psql -U quant -d quantdb -f "%~dp0init\01_schema.sql" >nul 2>&1
if %errorlevel% neq 0 (
    echo     [ERROR] Failed to run schema script
    echo.
    pause
    exit /b 1
)
echo     [OK] Schema initialized
echo.

REM ---- Verify setup ----
echo Verifying setup...
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
