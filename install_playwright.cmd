@echo off
python -m pip install -r "%~dp0requirements.txt"
python -m playwright install chromium
