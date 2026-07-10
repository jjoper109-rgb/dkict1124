@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-erp-shortcut.ps1"

echo.
pause
