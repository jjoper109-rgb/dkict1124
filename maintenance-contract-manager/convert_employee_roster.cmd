@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Python virtual environment was not found.
    echo Current folder: %CD%
    pause
    exit /b 1
)

".venv\Scripts\python.exe" "employee_roster_converter.py"

echo.
echo Converter finished.
pause

endlocal
