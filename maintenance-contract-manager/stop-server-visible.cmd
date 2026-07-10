@echo off
setlocal
chcp 65001 >nul
title 유지보수 계약 서버 종료

set "PORT=8080"
set "FOUND="

echo.
echo ========================================
echo   유지보수 계약 서버 종료
echo ========================================
echo 포트: %PORT%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo 종료 대상 PID: %%P
    taskkill /PID %%P /T /F
    echo.
)

if not defined FOUND (
    echo 포트 %PORT%에서 실행 중인 서버를 찾지 못했습니다.
) else (
    echo 서버 종료 명령을 완료했습니다.
)

echo.
echo 이 창은 자동으로 닫히지 않습니다.
pause

endlocal
