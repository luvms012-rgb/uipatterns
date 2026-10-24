# 인수인계 — 2026-10-24 (집 → 회사)

> 회사에서 Claude에게: **"github.com/luvms012-rgb/uipatterns 의 HANDOFF.md 읽고 이어서 작업해줘"**
> 집 PC에서 한 작업 전부와 결정사항을 여기 모았습니다. 세부 구조·사용법은 README.md.

## 1. 현재 상태

| 항목 | 내용 |
|---|---|
| 사이트 | <https://luvms012-rgb.github.io/uipatterns/> (mo/ · web/) — GitHub Pages, 공개 |
| 저장소 | <https://github.com/luvms012-rgb/uipatterns> — Public, 이름 `uipatterns` 유지 |
| 이미지 | 회사 서버 `imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/{mo,web}/` |
| 데이터 | mo 57,263장 · web 26,105장 (서버 index.html에서 추출, 2026-10-24 기준) |

한 일:
1. 9MB index.html을 화면 코드 + `data.js`(한 줄 = 1장) + `svc-types.js` + `icons.js`로 분리
2. 이미지 주소를 `config.js`의 회사 서버 주소로 (file://로 열면 로컬 폴더 이미지)
3. 선택 다운로드: ZIP 제거 → 원래 파일명 낱장 저장 (크롬·엣지는 폴더 일괄 저장)
4. 원클릭 업데이트 `업데이트.bat` / `업데이트.command` → `scripts/update.js` (pull → 스캔 → 커밋 → push)
5. 예전 `node update-index.js` 호환 shim (`mo/update-index.js` → `scripts/update-index.js`)
6. 사이드바 uibowl식 개편: UI 패턴 7그룹(접기) → 컴포넌트 → 카테고리 유형(맨 아래). 사이드바 검색창 없음
7. 이미지 중계 Worker 코드(`worker/`) — **아직 Cloudflare에 배포 안 함**, `config.js`의 `imgProxy` 비어 있음

## 2. 사용자 결정사항 (바꾸지 말 것)

- **이 프로젝트의 핵심은 쉬운 업데이트.** 이미지 넣고 → 더블클릭 한 번 → 사이트 반영
- **회사 서버에는 이미지만.** 업로드는 **사용자가 보안망으로 직접 수동**. 업로드·FTP·동기화 자동화 금지, 서버 설정(CORS 등) 변경 요청 금지. 보안에 유의
- 그 외 모든 파일은 GitHub. 사이트는 **누구나 봐도 됨**(Public OK)
- 선택 다운로드는 매우 중요. ZIP일 필요는 없음
- **검색이 가장 중요** (자료가 방대함). 사이트 검색바는 단순 키워드용으로 두고, 사이드바에 검색창 두지 않음
- **자연어 검색은 Claude로** — 팀원도 쓰므로 **원격 MCP 서버** 방식 (uibowl "AI에 유아이볼 데이터 연결하기"와 같은 개념)

## 3. 회사에서 할 일 (순서 추천)

1. **회사 PC 연결** — README "회사 PC 처음 연결". 기존 `uipatterns` 폴더를 그대로 저장소로 (이미지 폴더는 .gitignore로 제외)
2. **이미지 표시 확인** — 사이트에서 이미지가 뜨는지. 아래 4-1 방화벽 주의
3. **`prepare-upload.js` 수정** — `(업로드)`에 이미지·아이콘만 (index.html·version.js·stats.js 제외)
4. **캡처에 컴포넌트 저장** — `uibowl-capture.js`/`capture-import.js`가 이미지별 컴포넌트를 `{site}/components.json` (`{"카테고리/파일.png": ["버튼", …]}`)에 기록 → `업데이트.bat` 때 `data.js`의 `comps`로 병합 → 사이드바 컴포넌트 필터 활성화. 기존 이미지는 `{site}/backups/captures/` 매니페스트에 컴포넌트가 있는지 먼저 확인
5. **`+` 파일명 13장** (web, 예: `검색/아고다 (agoda)_항공권+숙소_972_20260630.png`) — 회사 서버가 `+` 들어간 주소를 404 처리. 이름 바꿔 재업로드 (지금 서버 사이트에서도 깨져 있음)
6. **(선택) 다운로드 중계** — `worker/README.md`대로 Cloudflare 가입 → Worker 배포 → `config.js` `imgProxy`. 없으면 다운로드가 새 창 열기로 동작
7. **MCP 검색 서버** — 아래 5

## 4. 발견한 것

1. **회사 웹방화벽**: 로컬(localhost)에서 이미지를 수십 장 한꺼번에 불러오자 회사 서버가 이미지 대신 `error_web_fw` 리다이렉트 페이지(text/html 91바이트)를 돌려주고 해당 IP를 차단 (23:02~ 최소 10분 이상 지속). 외부 사이트 Referer로 인한 핫링크 차단으로 추정 → 페이지에 `<meta name="referrer" content="no-referrer">` 적용함. **배포 사이트에서도 재발하는지 소량으로 먼저 확인**할 것
2. **회사 서버 CORS 헤더 없음** → github.io에서 이미지 fetch(다운로드) 불가 → Worker 중계 필요. `<img>` 표시는 문제없음
3. **uibowl 데이터**: 서비스 페이지가 받는 앱 데이터에 `patterns[].images[].components[]`(componentCodeName, xPercent, yPercent)가 이미지마다 있음 → 컴포넌트를 이미지에 특정할 수 있음. 지금 캡처는 이걸 저장하지 않아서 "특정 안 됨"이었던 것
4. **uibowl 분류** (2026-10-24 확인, `mo/taxonomy.js`·`web/taxonomy.js`에 반영)
   - 패턴 그룹: 진입·탐색·프로모션·활동·거래·관리·AI·도구 (mo/web 항목 다름 — web에 대시보드·랜딩페이지·서브탭)
   - 컴포넌트: mo 56개, web 53개
   - 로컬 폴더명 별칭: 내주변→지도뷰·내주변, 멤버십→멤버십·요금제, 사진촬영→촬영하기, 상품목록→목록 (PLP)
5. **uibowl 하단 저작권 고지**: "무단 사용 시 저작권법 등에 따라 법적 책임" — 공개 사이트 운영 시 참고
6. 데이터 정렬은 기존 서버와 같은 문자 코드 순, 파일명은 NFC로 통일 (`scripts/update-index.js`)

## 5. MCP 검색 서버 구성안

목표 질문:
- 바텀시트에 "선택 안 함" 버튼이 있는 UI를 찾아줘
- "더보기" 텍스트가 들어간 화면 찾아줘
- 장바구니에서 재고 부족이 표현된 화면을 찾아줘
- 에어비앤비와 부킹닷컴 UI/UX 차이 보여줘
- 30대 여성을 위한 모빌리티 서비스 레퍼런스 찾아줘
- 지금 첨부하는 이미지랑 비슷한 화면 보여줘

| 질문 유형 | 필요한 이미지별 정보 |
|---|---|
| 글자("더보기", "선택 안 함") | OCR 텍스트 |
| 컴포넌트 + 글자 + 위치 | uibowl 컴포넌트 태그·좌표 + OCR 좌표 |
| 상황("재고 부족") | 짧은 화면 설명 |
| 서비스 비교 | 서비스별 화면 묶음 (지금 데이터로 가능) |
| 대상·업종("30대 여성 모빌리티") | 업종 + 서비스 특성 |
| 비슷한 화면 | 이미지 임베딩 |

구성:
1. **검색 정보 생성** — 업데이트 때 회사 PC에서 (OCR·임베딩은 무료 로컬 도구 우선), 결과를 저장소에 올림
2. **원격 MCP 서버** — Cloudflare Worker(중계와 같은 계정), 읽기 전용. 도구 예: 화면 검색 · 서비스 화면 · 서비스 비교 · 비슷한 화면 · 화면 이미지 보기
3. **팀원 연결** — Claude 설정 → 커넥터 → 사용자 지정 커넥터 추가 → MCP 주소
4. **사이트 딥링크** — 답변에서 화면 1장으로 바로 가는 주소 (예: `mo/#img=카테고리/파일.png`) 추가 필요
