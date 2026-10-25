@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - 업로드 준비
echo  =====================================
node "%~dp0prepare-upload.js"
node "%~dp0..\zip-upload.js" --site web
echo.
pause
