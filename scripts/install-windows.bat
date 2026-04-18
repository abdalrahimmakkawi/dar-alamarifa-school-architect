@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   Dar Alamarifa School Architect - Windows Deployment
echo ============================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo [2/4] Checking environment variables...
if not exist .env (
    if exist .env.example (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env
        echo [ACTION] Please edit the .env file and add your NVIDIA and Supabase keys.
    ) else (
        echo [ERROR] .env.example not found.
        pause
        exit /b 1
    )
)

echo [3/4] Building the application...
call npm run build

if %errorlevel% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo [4/4] Starting the development server...
echo [INFO] The application will be available at http://localhost:3000
echo.
echo Press Ctrl+C to stop the server.
echo.
call npm run dev

pause
