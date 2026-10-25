@echo off
chcp 65001 >nul
rem 화면 텍스트(OCR) 추출 — 끊겨도 다시 실행하면 이어서 처리
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-ocr.ps1" %*
pause
