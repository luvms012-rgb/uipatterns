@echo off
chcp 65001 >nul
rem UI Patterns — 최신 코드 받기 → 이미지 스캔·데이터 갱신 → GitHub 반영 (사이트 자동 배포)
cd /d "%~dp0"
node scripts\update.js
pause
