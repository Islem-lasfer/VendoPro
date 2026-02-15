@echo off
title POS Database Server
color 0A
echo.
echo ========================================
echo    POS Database Server Launcher
echo ========================================
echo.
echo Starting server on port 3001...
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Server is starting...
echo.
echo Keep this window open while using the POS.
echo Close this window to stop the server.
echo.
node server.js

pause
