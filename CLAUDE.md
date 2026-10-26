# UI Patterns — Claude 작업 규칙 (집·회사 공통)

이 파일은 집 PC·회사 PC 어느 쪽 Claude 든 이 폴더에서 일할 때 자동으로 읽는다. 여기 적힌 결정은 사용자가 정한 것이니 바꾸지 말 것.
- **지금 상태·다음 할 일: [HANDOFF.md](HANDOFF.md)** — 작업 시작 때 먼저 읽고, 작업을 마칠 때 갱신한다
- 구조·사용법: [README.md](README.md) · 자연어 검색: [mcp/README.md](mcp/README.md) · 예전 캡처 파이프라인 상세: GUIDE.md (옛 구조 문서)

## 일하는 방식
- 사용자는 UI 디자이너. 한국어로, 쉬운 말로 답한다
- **시작할 때 `git pull`**, 끝나면 HANDOFF.md 갱신 → **커밋·푸시는 사용자에게 확인받고** (메시지 한국어). 집·회사가 같은 저장소를 번갈아 쓰므로 안 올린 변경을 남겨 두지 않는다
- 사용자가 직접 할 일(회사 서버 업로드, claude.ai 설정 등)은 대신하지 말고 할 일로 알려준다

## 결정사항 (바꾸지 말 것)
- **최종 운영은 회사 서버** `https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/` (사이트·이미지 같은 서버). GitHub Pages(`luvms012-rgb.github.io/uipatterns`)는 **개발 기간용**
- 개발 기간에는 회사 서버에 **이미지만**. 업로드는 사용자가 보안망으로 직접 수동 — 업로드·FTP·동기화 자동화 금지, 서버 설정(CORS 등) 변경 요청 금지
- 핵심은 쉬운 업데이트: 이미지 넣고 → `업데이트.bat` 더블클릭 → 반영
- **검색이 가장 중요.** 자연어 검색은 Claude + MCP(`mcp/`). 사이트 검색바는 단순 키워드, 사이드바 검색창 없음
- **Cloudflare 가입 불가** → 원격 MCP·다운로드 중계(`worker/`) 보류. 다시 제안하지 말 것. 검색은 회사 PC 로컬 서버(`mcp/local.mjs`)
- 다운로드: 2장 이상 선택 = 묶지 않고(ZIP·폴더 선택 없이) 전부 한 번에. 운영 서버에서 동작, 개발 기간(github.io)엔 새 창에 모아 보여줌
- 사용 현황(대시보드)은 안 씀 → 숨김. 팀 집계·개편 다시 제안하지 말 것
- 비용 드는 방식 쓰지 않음 (Anthropic API 크레딧 X). OCR 은 Windows 내장 OCR
- 저장소는 Public — 키·비밀값·개인정보 올리지 말 것

## PC 별 차이
| | 회사 PC (Windows) | 집 PC (Mac) |
|---|---|---|
| 이미지 (mo/·web/ 카테고리 폴더) | 있음 | 없음 → 미리보기는 회사 서버 이미지 |
| 캡처·분류·업로드 zip | 여기서만 | ✗ |
| 화면 글자 추출(OCR)·검색 데이터 `search/dist/` | 여기서만 (Windows OCR, 저장소 제외) | ✗ → 검색 MCP 못 씀 |
| 코드·문서 수정, 미리보기 | ✓ | ✓ |

## 자주 쓰는 것
- 업데이트(동기화): `업데이트.bat` / `업데이트.command` → `scripts/update.js` (pull → 이미지 스캔·OCR·검색 데이터 → 커밋 → push)
- 미리보기: `미리보기.bat` / `미리보기.command` → `scripts/preview.js` (localhost:5180, 이미지 위치 자동)
- 검색 데이터: `search/run-ocr.bat` → `node search/build-index.js` · 로컬 MCP 등록: `claude mcp add --scope user uipatterns node <폴더>/mcp/local.mjs`
- 캡처: claude.ai 스킬 uipatterns-capture (Chrome 확장 필요, 회사 PC)

## 주의 (실제로 겪은 것)
- 회사 서버 웹방화벽: 이미지를 짧은 시간에 수십 장 요청하면 IP 차단(`error_web_fw`). 서버 확인은 몇 장만 천천히. CORS 헤더 없음
- 서버 index.html 의 목록은 "올라간 이미지"의 증거가 아님 — 업로드 확인은 이미지 몇 장 HEAD 로 크기 비교
- `classify-local.js` 는 분류하며 파일명을 다시 매긴다 → 가져올 때 이름으로 매칭 금지. 이 파일엔 NUL 문자가 있어 Edit 도구가 거부 → 문자열 치환으로 수정 (mo·web 두 벌 동일 유지)
- 회사 PC: 이미지 폴더를 Bash(git bash)로 대량 읽으면 느림 → PowerShell. 한글 든 `.ps1` 은 UTF-8 BOM, JSON 은 BOM 없이
- `.gitattributes` 가 `* -text` (줄바꿈 변환 없음) — `.command` 는 LF, 실행 권한(`git update-index --chmod=+x`) 유지
- 파일명에 `+` 가 있으면 회사 서버가 404
- Node 24 의 `fs.rmSync` 는 한글 경로에서 메시지 없이 죽는다 → 지우기는 `unlinkSync`/`rmdirSync`
- 새 uibowl 카테고리는 기존 폴더로 합치는 게 기본(사용자 결정 10/27) → `uibowl-category-map.json` alias
