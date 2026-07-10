@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8080/"
".venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8080
pause
