# 인수인계 — 2026-10-26 (회사 → 집)

> 어느 PC 에서든 Claude 에게: **"uipatterns HANDOFF.md 읽고 이어서 작업해줘"**
> 규칙·결정사항은 [CLAUDE.md](CLAUDE.md) (Claude 가 자동으로 읽음), 구조·사용법은 [README.md](README.md).
> 작업을 마칠 때 이 문서를 갱신하고 커밋·푸시한다.

## 0. 집·회사 오가며 작업하기 (동기화)

**규칙 하나: 시작할 때 받고, 끝날 때 올린다.** 둘 다 `업데이트` 더블클릭이면 된다.

| 언제 | 할 일 |
|---|---|
| 작업 시작 | `업데이트.command`(집 Mac) / `업데이트.bat`(회사) 더블클릭 → 최신 내용 받기. 또는 Claude 에게 "최신으로 받아줘" |
| 작업 끝 | Claude 에게 "HANDOFF 갱신하고 커밋·푸시해줘" 또는 `업데이트` 더블클릭 (바뀐 것 자동 커밋·푸시) |
| 같은 파일을 양쪽에서 고쳐 충돌 | Claude 에게 "uipatterns 충돌 해결" |

GitHub 로 맞춰지는 것 / 안 맞춰지는 것:
- ✅ 코드·문서·`data.js`(이미지 목록)·`components.json`·`CLAUDE.md`·이 문서
- ❌ 이미지(회사 PC·회사 서버에만), 화면 글자(OCR)·검색 데이터 `search/ocr/`·`search/dist/` (회사 PC 에만, 저장소 제외)
- ❌ 각 PC 의 Claude 메모리 — 그래서 중요한 건 `CLAUDE.md`·이 문서에 적는다
- 캡처 스킬(uipatterns-capture)은 claude.ai 계정으로 맞춰짐 — 아래 3-2 반영 필요

### 집 PC(Mac) 처음 한 번
1. Git, Node.js 22 이상, Claude 데스크톱 앱(Code)
2. 저장소 받기 (이미 있으면 그 폴더에서 `git pull`):
   ```bash
   git clone https://github.com/luvms012-rgb/uipatterns.git ~/Desktop/works/uipatterns
   ```
3. 처음 `git push` 때 GitHub 로그인 창 → 로그인
4. 미리보기: `미리보기.command` 더블클릭 (이미지가 없으니 회사 서버 이미지로 보임. 안 열리면 터미널에서 `chmod +x 미리보기.command 업데이트.command`)

## 1. 현재 상태 (2026-10-26)

| 항목 | 내용 |
|---|---|
| 운영 계획 | **최종: 회사 서버** `imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/` · 지금은 개발 기간 → <https://luvms012-rgb.github.io/uipatterns/> |
| 데이터 | mo 57,263장 · web 26,377장 (10/26 Npay 증권 272장 추가) |
| 화면 글자(OCR) | 전 화면 완료 (mo 1장 오류) — 회사 PC `search/ocr/` |
| 컴포넌트 | 10/26 이후 캡처분만 (Npay 증권 213장) → `web/components.json` → `data.js` comps |
| 자연어 검색 | 회사 PC 로컬 MCP 서버 등록됨 (`claude mcp` 이름 `uipatterns`) — 새 대화에서 "uipatterns 에서 ~ 찾아줘" |

10/26 회사에서 한 일:
1. 회사 PC 를 저장소에 연결, 안 쓰는 파일·옛 백업 정리
2. **자연어 검색**: Windows OCR 로 전 화면 글자 추출 → `search/build-index.js` 가 검색 데이터(SQLite) 생성 → `mcp/` 검색 도구 4개(화면 검색·조건 목록·서비스 비교·화면 글자). `업데이트.bat` 이 새 이미지 OCR·검색 데이터 갱신까지
3. 캡처 파이프라인을 새 구조(`data.js`)에 맞춤, 업로드 zip 은 이미지만
4. **캡처 때 화면별 컴포넌트 저장** (`uibowl-capture.js` v5 → `capture-import.js` → `classify-local.js` 가 최종 경로로 `components.json`) → 사이드바 컴포넌트 필터·컴포넌트 검색
5. 사용 현황 메뉴 숨김 (안 씀)
6. 다운로드: 2장 이상 선택하면 전부 한 번에 (운영 서버에서 동작, github.io 에선 새 창에 모아 보여줌)
7. 미리보기 `미리보기.bat`/`.command` (집에서도), `CLAUDE.md`

## 2. 결정사항
→ [CLAUDE.md](CLAUDE.md) "결정사항" (바꾸지 말 것). 10/26 새로 정해진 것: 최종 운영은 회사 서버 · Cloudflare 가입 불가 · 사용 현황 안 씀 · 다운로드는 묶지 않고 전부

## 3. 남은 일

### 사용자가 직접
1. **`web/(업로드)/20261026.zip` 회사 서버 업로드** (Npay 증권 272장 + 아이콘) → <https://luvms012-rgb.github.io/uipatterns/web/?check=20261026> 점검. 모바일은 10/21 분까지 다 올라가 있음 (확인함)
2. **캡처 스킬 문구 반영**: claude.ai 설정 → 스킬 → uipatterns-capture 를 회사 PC `Desktop\works\uipatterns-capture-SKILL.md` 내용으로 (zip 은 이미지만, 마무리에 `업데이트.bat` 안내)

### 이어서 할 작업
1. **`+` 파일명 web 13장** (아고다 4·트립닷컴 4·클래스101 5) — 회사 서버가 404. 이름 바꾸고(`+` → 다른 글자) `업데이트` 후 재업로드 — 회사 PC
2. **회사 서버로 운영 옮길 때**: 사이트 파일(index.html·data.js·config.js·assets 등)도 서버에 올리는 흐름 필요 — 지금 `prepare-upload`/`zip-upload` 는 이미지만 담음. `config.js` imgBase 를 같은 서버 기준으로
3. 예전 캡처 화면(약 8.3만 장) 컴포넌트 — uibowl 이미지 ID 가 없어 자동으로 못 채움. 자주 찾는 것(바텀시트·모달·하단 네비 등)만 글자·이미지로 추정하는 방안
4. 사이트에서 화면 1장으로 바로 가는 링크(`#img=`), "비슷한 화면" 검색(이미지 임베딩)
5. (집에서 검색까지 쓰고 싶다면) 검색 데이터를 집으로 옮기는 방법 정하기 — 지금은 회사 PC 에만 있음

## 4. 발견한 것
- **회사 웹방화벽**: 이미지를 짧은 시간에 수십 장 요청하면 IP 차단(`error_web_fw`). 페이지에 `no-referrer` 적용함. 서버 확인은 몇 장만
- **회사 서버 CORS 헤더 없음** → github.io 에서 이미지 파일을 읽을 수 없음(다운로드·ZIP 불가). 운영 서버(같은 출처)에선 문제없음
- **서버 index.html 목록 ≠ 올라간 이미지**: 업로드 확인은 이미지 몇 장 HEAD 로 크기 비교
- **uibowl 카드 데이터**에 `components`(이름·위치%)가 이미지마다 있음 → v5 캡처가 저장
- `classify-local.js` 는 분류하며 파일명을 다시 매김 → 가져올 때 이름으로 매칭하면 틀림. 파일 안에 NUL 문자 있음
- Chrome 은 바탕화면·다운로드 같은 최상위 폴더를 폴더 선택에서 막음. 여러 파일 다운로드는 사이트마다 처음 한 번 "자동 다운로드 허용"을 물음
- 데이터 정렬은 문자 코드 순, 파일명은 NFC 로 통일 (`scripts/update-index.js`)
- uibowl 하단 저작권 고지("무단 사용 시 법적 책임") — 공개 사이트 운영 시 참고
