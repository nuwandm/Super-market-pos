@echo off
title Supermarket POS - Reset Tool
echo.
echo ============================================
echo   Supermarket POS - Factory Reset Tool
echo   Dream Labs IT Solutions
echo ============================================
echo.
echo Searching for database file...
echo.

set "FOUND="
set "DB_FILE=supermarket-pos.db"

:: Search common Electron userData locations
for %%P in (
  "%APPDATA%\Supermarket POS"
  "%APPDATA%\supermarket-pos-desktop"
  "%APPDATA%\Supermarket"
  "%LOCALAPPDATA%\Supermarket POS"
  "%LOCALAPPDATA%\supermarket-pos-desktop"
  "%LOCALAPPDATA%\Supermarket"
) do (
  if exist "%%~P\%DB_FILE%" (
    set "FOUND=%%~P\%DB_FILE%"
    set "FOUND_DIR=%%~P"
  )
)

:: Fallback: deep search in APPDATA
if not defined FOUND (
  for /f "delims=" %%F in ('dir /s /b "%APPDATA%\%DB_FILE%" 2^>nul') do (
    set "FOUND=%%F"
    for %%D in ("%%F") do set "FOUND_DIR=%%~dpF"
  )
)

:: Fallback: deep search in LOCALAPPDATA
if not defined FOUND (
  for /f "delims=" %%F in ('dir /s /b "%LOCALAPPDATA%\%DB_FILE%" 2^>nul') do (
    set "FOUND=%%F"
    for %%D in ("%%F") do set "FOUND_DIR=%%~dpF"
  )
)

if not defined FOUND (
  echo [NOT FOUND] No database file was found on this machine.
  echo The app may not have been run yet - setup page should already appear.
  echo.
  pause
  exit /b 0
)

echo [FOUND] %FOUND%
echo.
echo WARNING: This will delete all shop data including:
echo   - Shop configuration and settings
echo   - Staff accounts and PINs
echo   - Products, categories, inventory
echo   - Sales history and customer records
echo.
set /p CONFIRM=Are you sure you want to reset? Type YES to confirm:

if /i not "%CONFIRM%"=="YES" (
  echo.
  echo Reset cancelled.
  pause
  exit /b 0
)

echo.
echo Deleting database...
del /f /q "%FOUND%"

if exist "%FOUND%" (
  echo [ERROR] Could not delete the file. Make sure Supermarket POS is closed.
  echo Please close the app and run this tool again.
) else (
  echo [SUCCESS] Database deleted.
  echo.
  echo The next time you open Supermarket POS, the setup page will appear.
)

echo.
pause
