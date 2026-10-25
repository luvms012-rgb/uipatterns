@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - 업로드 준비
echo  =====================================
node "%~dp0prepare-upload.js"
node "%~dp0..\zip-upload.js" --site mo
echo.
echo  (자세 로그: prepare-upload-debug.log)
echo.
pause
