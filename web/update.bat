@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - 이미지 목록 업데이트
echo  =====================================
node "%~dp0update-index.js"
echo.
pause
