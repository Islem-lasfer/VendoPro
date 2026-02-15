@echo off
title Starting POS Application
color 0A
cls
echo.
echo ================================================
echo         POS - Starting Application
echo ================================================
echo.
echo This will start the POS application in desktop mode
echo with full database server auto-start support.
echo.
echo ================================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists
if not exist node_modules (
    echo [STEP 1/3] Installing dependencies...
    echo This only happens the first time.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo Make sure Node.js is installed.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed!
    echo.
)

REM Check if database-server dependencies exist
if not exist database-server\node_modules (
    echo [STEP 2/3] Installing database server dependencies...
    echo.
    cd database-server
    call npm install
    if errorlevel 1 (
        echo.
        echo WARNING: Failed to install database server dependencies!
        echo Server auto-start may not work.
        echo.
    ) else (
        echo.
        echo Database server dependencies installed!
        echo.
    )
    cd ..
)

echo [STEP 3/3] Starting POS Application...
echo.
echo ================================================
echo   APPLICATION STARTING - Please wait...
echo ================================================
echo.
echo The desktop app will open automatically.
echo Auto-start server feature is now available!
echo.
echo To stop: Close the application window
echo          or press Ctrl+C here
echo.
echo ================================================
echo.

npm start

if errorlevel 1 (
    echo.
    echo ================================================
    echo   APPLICATION STOPPED
    echo ================================================
    echo.
    pause
)
