@echo off
cd /d "%~dp0"
start "" "http://125.136.150.11:8080/"
".venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8080
pause
