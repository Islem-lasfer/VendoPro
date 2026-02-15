@echo off
title POS Database Server
color 0A
cls
echo.
echo ===============================================
echo        POS - DATABASE SERVER
echo ===============================================
echo.
echo This server must run on the MAIN computer
echo that has MySQL installed (192.168.1.6)
echo.
echo All POS clients will connect to this server.
echo.
echo ===============================================
echo.
pause
echo.
echo Starting server...
echo.

cd /d "%~dp0\database-server"

if not exist node_modules (
    echo.
    echo [STEP 1/2] Installing required packages...
    echo This only happens the first time.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install packages!
        echo Make sure Node.js is installed.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Packages installed successfully!
    echo.
)

echo [STEP 2/2] Starting database server...
echo.
echo ===============================================
echo   SERVER RUNNING - Keep this window open!
echo ===============================================
echo.
echo Server Address: http://192.168.1.6:3001
echo.
echo To stop the server: Close this window
echo                     or press Ctrl+C
echo.
echo ===============================================
echo.

node server.js

if errorlevel 1 (
    echo.
    echo ===============================================
    echo   SERVER STOPPED WITH ERROR
    echo ===============================================
    echo.
    echo Possible issues:
    echo - MySQL is not running
    echo - MySQL credentials in .env are incorrect
    echo - Port 3001 is already in use
    echo.
    echo Check database-server\.env file for settings
    echo.
    pause
)
