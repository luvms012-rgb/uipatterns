@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - classify and stage for upload (v3)
echo  ==========================================
echo   1) classify by filename (only when it is certain)
echo   2) classify the rest by looking at the images (needs api-key.txt)
echo   3) rebuild index (DATA)
echo   4) stage the upload folder
echo.
node "%~dp0classify-local.js"
pause
