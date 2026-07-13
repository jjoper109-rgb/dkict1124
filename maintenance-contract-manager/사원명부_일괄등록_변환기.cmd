@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 사원명부 일괄등록 변환기

if not exist ".venv\Scripts\python.exe" (
    echo Python 가상환경을 찾을 수 없습니다.
    echo 현재 폴더: %CD%
    pause
    exit /b 1
)

".venv\Scripts\python.exe" "employee_roster_converter.py"

echo.
echo 변환기가 종료되었습니다.
pause

endlocal
