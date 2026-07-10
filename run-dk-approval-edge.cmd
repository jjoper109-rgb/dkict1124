@echo off
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "PROFILE=%~dp0디케이 자동화 로컬저장소"
set "EXTENSION=%~dp0gw-approval-extension"
start "" "%EDGE%" "--user-data-dir=%PROFILE%" "--load-extension=%EXTENSION%" "--no-first-run" "--new-window" "http://gw.e-dk.co.kr/"
