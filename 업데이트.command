#!/bin/zsh
# UI Patterns — 최신 코드 받기 → (이미지가 있으면) 데이터 갱신 → GitHub 반영. 더블클릭으로 실행.
cd "$(dirname "$0")"
node scripts/update.js
echo
read -k1 "?아무 키나 누르면 닫힙니다…"
