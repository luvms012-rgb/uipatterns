# 자연어 검색 (MCP) — 진행 상황 (2026-10-26)

목표: "바텀시트에 '선택 안 함' 버튼이 있는 UI 찾아줘" 같은 질문을 팀원 누구나 자기 Claude 에서 — 원격 MCP 서버 (HANDOFF.md §5).
구성·사용법은 `mcp/README.md`.

## 완료
- `search/ocr.ps1`: 저장 형식 수정(줄 1개·배열 감싸기 문제), 대상 목록을 `data.js`에서 읽도록 수정. 기존 결과 17,734줄 변환
- OCR 2차 실행: 2026-10-26 60분 제한, 작업자 12개 → mo 57,262/57,263 · web 25,874/26,105 (남은 web 231장은 `run-ocr.bat` 다시 실행하면 이어서)
- `search/build-index.js`: 검색 데이터(SQLite + 글자 전문 검색 색인) 생성 → `search/dist/` (저장소 제외, 약 160MB)
- `mcp/`: 검색 도구 4개(search_screens · list_filters · service_overview · get_screen), Cloudflare Worker 서버, 로컬 stdio 서버
- 로컬 확인 (전체 데이터): 바텀시트 "선택 안 함" 21장 · "더보기" 4,917장 · 장바구니 품절/재고 54장 · 에어비앤비 vs 부킹닷컴 비교 · 모빌리티 메인 368장. Worker 계산 6ms 이하. Worker HTTP 처리 가짜 D1 로 확인
- 알려진 한계: 글자를 이어 붙여 찾으므로 "잠재고객"이 "재고"로 걸리는 식의 오탐이 있음 — Claude 가 결과 글자를 보고 거른다

- 2026-10-26 남은 web OCR 완료 (mo 57,262 · web 26,105 — mo 1장 오류). `업데이트.bat`(scripts/update.js)이 새 이미지 OCR + 검색 데이터 갱신
- 2026-10-26 Cloudflare 가입 불가 → 원격 서버 보류, 회사 PC 의 로컬 서버(mcp/local.mjs)로 사용

## 다음 할 일
1. 컴포넌트(캡처 개선) → 컴포넌트 검색
2. 사이트 `#img=` 딥링크, 비슷한 화면(임베딩)
3. 팀원 공용이 필요해지면 원격 서버를 둘 곳 정하기 (코드는 mcp/src/worker.js)
