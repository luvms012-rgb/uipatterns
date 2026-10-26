# UI Patterns

사내 UI 패턴 레퍼런스 (uibowl.io 벤치마킹). 모바일 `mo/` · 웹사이트 `web/` 두 사이트.

- **최종 운영: 회사 서버** <https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/> — 사이트와 이미지를 같은 서버에 둔다 (2026-10-26 결정)
- 개발 기간 사이트: <https://luvms012-rgb.github.io/uipatterns/> (GitHub Pages — 이미지는 회사 서버에서 불러옴)
- 저장소: <https://github.com/luvms012-rgb/uipatterns>
- 이미지: 회사 서버 `.../uipatterns/{mo,web}/`. 개발 기간에는 **이미지만** 회사 서버, 나머지는 전부 여기
- 작업 이어가기: [HANDOFF.md](HANDOFF.md) — 지금 상태 · 남은 작업 · **집·회사 오가며 작업하기(동기화)** · Claude 규칙은 [CLAUDE.md](CLAUDE.md)
- 미리보기: `미리보기.bat` / `미리보기.command` 더블클릭 → <http://localhost:5180/mo/> (이 PC 에 이미지가 없으면 회사 서버 이미지로)

## 업데이트 = `업데이트.bat` 더블클릭 (맥: `업데이트.command`)

| 하는 일 | 회사 PC (이미지 있음) | 집 PC (이미지 없음) |
|---|---|---|
| 1. GitHub에서 최신 코드 받기 | ✅ | ✅ |
| 2. 이미지 폴더 스캔 → `data.js`·업종·검색 색인 갱신 | ✅ | 건너뜀 |
| 3. 새 이미지 목록 → `업로드할 이미지.txt` | ✅ | — |
| 4. 커밋 → GitHub 반영 → 1~2분 뒤 사이트 자동 갱신 | ✅ | ✅ (코드 수정분) |

새 이미지는 **회사 서버에 직접 업로드** (보안망). 올린 뒤 `사이트/mo/?check=20261024`(날짜·서비스명·all)로 엑박 점검.

### 평소 흐름 (회사)
1. 캡처: Claude에게 `모바일 캡처 {서비스명}` / `웹 캡처 {서비스명}` 또는 `{uibowl 주소} 캡처` → `(업데이트)`로 가져와 분류 (uipatterns-capture 스킬)
2. `업데이트.bat` 더블클릭
3. `(업로드)` 이미지를 회사 서버에 업로드

## 폴더 구조

```
uipatterns/
├─ index.html            → mo/ 로 이동
├─ config.js             이미지 주소(imgBase) · 다운로드 중계(imgProxy)
├─ assets/sidebar.js·css 사이드바 (mo/web 공용): UI 패턴(그룹) → 컴포넌트 → 카테고리 유형
├─ 업데이트.bat / 업데이트.command
├─ scripts/
│  ├─ update.js          원클릭 업데이트 (pull → 스캔 → 커밋 → push)
│  └─ update-index.js    폴더 스캔 → data.js / svc-types.js / search-index.js / stats.js
├─ mo/ · web/
│  ├─ index.html         화면 (CSS·JS)
│  ├─ data.js            이미지 목록 — 자동 생성, 한 줄 = 1장
│  ├─ svc-types.js       서비스 → 업종 매핑 (직접 수정 가능, 새 서비스는 자동 추가)
│  ├─ taxonomy.js        사이드바 분류 — uibowl 패턴 그룹 · 폴더명 별칭 · 컴포넌트 목록
│  ├─ components.json    (선택) 이미지별 컴포넌트 { "카테고리/파일.png": ["버튼", …] } → data.js의 comps
│  ├─ icons.js · search-index.js · stats.js · version.js · upload-list.txt
│  ├─ update-index.js    예전 명령 호환용 (→ scripts/update-index.js)
│  └─ 카테고리 폴더/ · icons/ · (업데이트)/ · (업로드)/   ← 이미지, git 제외 (.gitignore)
└─ worker/               다운로드용 이미지 중계 (Cloudflare Worker, worker/README.md)
```

- `index.html`을 파일로 직접 열면(file://) 이 PC의 이미지 폴더를 보여줘서 서버 업로드 전에 확인할 수 있습니다.
- 백업은 git 기록이 대신합니다 (예전 `backups/index_*.html` 불필요).

## 회사 PC 처음 연결 (한 번)

회사 PC의 기존 `uipatterns` 폴더를 그대로 저장소로 씁니다. 이미지·캡처 파이프라인은 그대로 두고 코드만 GitHub 것으로 바뀝니다.
Claude에게 **"uipatterns 회사 PC 연결"** 이라고 하면 아래를 대신 해줍니다.

1. 기존 폴더 백업: `mo/index.html`, `web/index.html`, `mo/update-index.js`, `web/update-index.js`
2. 그 폴더에서 `git init` → `git remote add origin https://github.com/luvms012-rgb/uipatterns.git` → `git fetch` → `git checkout -f -B main origin/main`
3. 기존 캡처 스크립트(`uibowl-capture.js`, `capture-import.js`, `classify-local.js`, `prepare-upload.js`, `zip-upload.js`, `GUIDE.md` 등)는 그대로 남아 있고, 첫 `업데이트.bat` 때 함께 GitHub에 올라갑니다.
4. **`prepare-upload.js`가 `index.html`·`version.js`·`stats.js`를 `(업로드)`에 넣지 않도록 수정** — 이제 회사 서버엔 이미지만 올립니다. 새 index.html을 서버에 올리면 서버 쪽 옛 페이지가 깨집니다. (2026-10-26 완료 — `zip-upload.js` 도 사이트 파일은 빼고 압축)

## 다운로드

- **운영(회사 서버)·로컬 미리보기**: 사이트와 이미지가 같은 서버라 바로 저장됩니다. 1장은 바로 다운로드, **2장 이상 선택하면 전부 한 번에 다운로드 폴더로** (묶지 않고 원래 파일명). 브라우저가 사이트마다 처음 한 번 '자동 다운로드 허용'을 묻습니다 (주소창 오른쪽).
- **개발 기간(github.io)**: 회사 서버가 다른 사이트에서 이미지 파일을 읽는 것을 허용하지 않아(CORS 헤더 없음) 바로 저장할 수 없습니다. 다운로드를 누르면 새 창 하나에 이미지를 모아 보여주고, 오른쪽 클릭 → '이미지를 다른 이름으로 저장'으로 저장합니다.
- 판별은 `canReadImages()` (페이지와 이미지가 같은 서버인지, 또는 중계 `imgProxy` 가 있는지).

## 자연어 검색 = Claude + MCP (`mcp/README.md`)

"바텀시트에 '선택 안 함' 버튼 있는 화면 찾아줘"처럼 **Claude에게 묻는 방식**입니다 (uibowl의 "AI에 유아이볼 데이터 연결하기"와 같은 개념). 사이트 검색바는 키워드 검색으로 단순하게 둡니다.
- 화면 속 글자(Windows 내장 OCR, 전 화면 완료)·위치·카테고리·서비스·업종으로 찾고, 서비스 비교도 됩니다
- `업데이트.bat` 이 새 이미지의 글자 추출과 검색 데이터(`search/dist/`, 저장소 제외) 갱신까지 합니다
- 지금은 **회사 PC의 Claude에서 로컬 서버**(`mcp/local.mjs`)로 씁니다. 팀원 공용 원격 서버는 Cloudflare 계정이 없어 보류 — 코드(`mcp/src/worker.js`)는 준비돼 있음

## 다음 작업 (2026-10-26 기준)

- [x] 회사 PC 연결
- [x] `prepare-upload.js`·`zip-upload.js`: 이미지만 `(업로드)`에 담기 · 분류 스크립트가 `data.js` 를 읽도록
- [x] 로컬 미리보기로 새 화면 확인 (mo·web 이미지 표시, 회사 서버 요청 없음)
- [ ] 배포된 사이트에서 이미지 표시 확인 — 회사 웹방화벽(`error_web_fw`) 주의, 이미지 몇 장으로만 조심스럽게
- [x] 캡처 시 이미지별 컴포넌트를 `components.json`에 저장 → 사이드바 컴포넌트 필터 + 컴포넌트 검색 (2026-10-26~ 캡처분. `uibowl-capture.js` v5 → `capture-import.js` → `classify-local.js` 가 최종 경로로 기록)
- [ ] 예전 캡처 화면(약 8.3만 장)의 컴포넌트 — uibowl 이미지 ID 가 없어 자동으로 못 채움. 자주 찾는 몇 개만 글자·이미지로 추정하는 방안 검토
- [ ] 파일명에 `+`가 든 web 이미지 13장 이름 바꿔 재업로드 (회사 서버가 `+` 주소를 404 처리)
- [ ] 사이트 딥링크 — 화면 1장으로 바로 가는 주소 (예: `mo/#img=카테고리/파일.png`)
- [ ] "비슷한 화면" 검색 (이미지 임베딩)
