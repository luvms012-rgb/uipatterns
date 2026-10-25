@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - import uibowl capture (mobile) + classify + stage upload
echo  ======================================================
node "%~dp0capture-import.js" --site mo --wait 30
if errorlevel 1 goto end
node "%~dp0mo\classify-local.js"
:end
pause
