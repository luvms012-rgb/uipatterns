# UI Patterns

사내 UI 패턴 레퍼런스 (uibowl.io 벤치마킹). 모바일 `mo/` · 웹사이트 `web/` 두 사이트.

- 사이트: <https://luvms012-rgb.github.io/uipatterns/>
- 저장소: <https://github.com/luvms012-rgb/uipatterns>
- 이미지: 회사 서버 `imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/{mo,web}/` — **이미지만** 회사 서버, 나머지는 전부 여기

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
4. **`prepare-upload.js`가 `index.html`·`version.js`·`stats.js`를 `(업로드)`에 넣지 않도록 수정** — 이제 회사 서버엔 이미지만 올립니다. 새 index.html을 서버에 올리면 서버 쪽 옛 페이지가 깨집니다.

## 다운로드

- 카드/크게 보기: 1장 다운로드
- 선택 다운로드: ZIP 없이 원래 파일명으로 저장. 크롬·엣지는 폴더를 한 번 고르면 그 폴더에 한꺼번에 저장
- `config.js`의 `imgProxy`가 비어 있으면 다운로드 대신 새 창으로 열립니다 → `worker/README.md`로 설정
