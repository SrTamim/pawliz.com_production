@echo off
REM PawCare BD - Development Environment Startup Script
REM This script installs dependencies and starts both backend and frontend servers

echo.
echo ============================================================
echo   PawCare BD - Development Environment Setup
echo ============================================================
echo.

REM Check if Node.js is installed
echo Checking for Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

node --version
echo.

REM Get the script directory
setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Install backend dependencies
echo ============================================================
echo Installing Backend Dependencies...
echo ============================================================
cd /d "!SCRIPT_DIR!backend"
if not exist "node_modules" (
    echo npm install in progress...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install backend dependencies
        pause
        exit /b 1
    )
) else (
    echo Backend node_modules already exists. Skipping npm install.
    echo Run "npm install" manually in the backend folder if you want to update dependencies.
)
echo Backend dependencies installed successfully!
echo.

REM Install frontend dependencies
echo ============================================================
echo Installing Frontend Dependencies...
echo ============================================================
cd /d "!SCRIPT_DIR!frontend"
if not exist "node_modules" (
    echo npm install in progress...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo Frontend node_modules already exists. Skipping npm install.
    echo Run "npm install" manually in the frontend folder if you want to update dependencies.
)
echo Frontend dependencies installed successfully!
echo.

echo ============================================================
echo Starting Development Servers...
echo ============================================================
echo.

REM Start Backend Server in a new window
cd /d "!SCRIPT_DIR!backend"
echo Starting Backend Server (Port 5000)...
start "PawCare BD - Backend" cmd /k "title PawCare BD - Backend & echo. & echo Backend Server Starting on http://localhost:5000 & echo. & npm start"

REM Wait a moment for backend to start
timeout /t 2 /nobreak

REM Start Frontend Server in a new window
cd /d "!SCRIPT_DIR!frontend"
echo Starting Frontend Server (Port 3000)...
start "PawCare BD - Frontend" cmd /k "title PawCare BD - Frontend & echo. & echo Frontend Server Starting on http://localhost:3000 & echo. & npm run dev"

echo.
echo ============================================================
echo Startup Complete!
echo ============================================================
echo.
echo Backend Server:  http://localhost:5000
echo Frontend Server: http://localhost:3000
echo.
echo API Health Check: http://localhost:5000/api/health
echo.
echo Note:
echo - Both servers are running in separate windows
echo - Press Ctrl+C in either window to stop that server
echo - Close the command windows to exit completely
echo.
pause
