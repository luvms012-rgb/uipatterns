@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - import uibowl capture (web) + classify + stage upload
echo  ======================================================
node "%~dp0capture-import.js" --site web --wait 30
if errorlevel 1 goto end
node "%~dp0web\classify-local.js"
:end
pause
