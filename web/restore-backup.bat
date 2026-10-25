@echo off
chcp 65001 > nul
echo.
echo  UI Patterns - 백업 복원
echo  ========================
echo.

set BACKUP_DIR=%~dp0backups

if not exist "%BACKUP_DIR%" (
  echo  [오류] backups 폴더가 없습니다.
  pause
  exit /b 1
)

echo  사용 가능한 백업 목록 (최신순):
echo.
for /f "delims=" %%f in ('dir /b /o-n "%BACKUP_DIR%\index_*.html" 2^>nul') do (
  echo    %%f
)
echo.
set /p CHOICE=" 복원할 파일명을 입력하세요 (예: index_20260625_001521.html): "

if not exist "%BACKUP_DIR%\%CHOICE%" (
  echo.
  echo  [오류] 파일을 찾을 수 없습니다: %CHOICE%
  pause
  exit /b 1
)

:: 현재 index.html을 먼저 백업
for /f "tokens=1-3 delims=/ " %%a in ("%DATE%") do set D=%%a%%b%%c
for /f "tokens=1-3 delims=:. " %%a in ("%TIME%") do set T=%%a%%b%%c
set CURRENT_BAK=index_before_restore_%D%_%T%.html
copy /y "%~dp0index.html" "%BACKUP_DIR%\%CURRENT_BAK%" > nul
echo.
echo  현재 index.html 보존: backups\%CURRENT_BAK%

:: 복원 실행 (/y — 덮어쓰기 확인 프롬프트가 리다이렉트에 묻혀 멈추는 것을 방지)
copy /y "%BACKUP_DIR%\%CHOICE%" "%~dp0index.html" > nul
echo  복원 완료: %CHOICE%
echo.
echo  브라우저에서 index.html을 새로고침하세요.
echo.
pause
