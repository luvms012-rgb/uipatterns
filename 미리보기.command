#!/bin/zsh
# UI Patterns — 이 PC에서 사이트 미리보기 (이미지가 없으면 회사 서버 이미지로). 창을 닫으면 끝. 더블클릭으로 실행.
cd "$(dirname "$0")"
node scripts/preview.js
