# UI Patterns — 운영 가이드

모바일 앱·PC 웹 스크린샷을 카테고리별로 모아 보고, 검색·필터·다운로드하는 내부 레퍼런스 사이트.
**모바일(`mo/`)과 웹(`web/`)은 완전히 독립된 두 개의 사이트**로, 각각 자체 `index.html`·DATA·SVC_TYPES·스크립트 세트를 가진다.

- **로컬 루트**: `C:\Users\luvms\Desktop\ing\uipatterns\index.html` — `mo/`로 자동 리다이렉트되는 랜딩 스텁 (모바일/웹 선택 링크 포함)
- **로컬 모바일**: `C:\Users\luvms\Desktop\ing\uipatterns\mo\index.html`
- **로컬 웹**: `C:\Users\luvms\Desktop\ing\uipatterns\web\index.html`
- **서버**: `https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/` (로컬과 동일 구조 — 루트 스텁 + `mo/` + `web/`)
- **원칙**: 로컬이 항상 기준. 서버는 로컬을 그대로 복사한 상태여야 한다.

---

## 0. 새 수집 방식 (v4, 2026-10-21) — "모바일 캡처 {서비스명}" 한 마디로 끝

**왜 바꿨나**: uibowl은 카드마다 자체 카테고리(`patternCodeName`, 예: 설정·스토어·챗봇)를 갖고 있고,
이 이름이 우리 카테고리 폴더와 거의 1:1로 같다. 예전 콘솔 스크립트는 이 값을 버리고 화면 이름(`patternName`)만
파일명에 넣었는데, 화면 이름은 비어 있는 경우가 많아서 이름 추측 분류가 계속 실패했다.
v4는 카테고리를 매니페스트로 받아 그대로 분류한다 → 석가머니 156장 중 148장 자동 확정, 판정대기 0.

```
[Cowork에 "모바일 캡처 석가머니"]
 1) Chrome에서 uibowl 페이지 열고 uibowl-capture.js 주입 → 섹션 전체(세로)+각 섹션 가로 스크롤 수집
    → 원본 PNG(영상 카드는 중간 프레임) + 아이콘 + UB__..__manifest.json 다운로드 (Chrome 저장 위치 = 바탕화면)
 2) capture-import.js → 바탕화면/다운로드에서 UB__ 파일을 찾아 mo/(업데이트)/{서비스}/ 로 이동 + .uibowl.json 기록
    (매니페스트는 mo/backups/captures/ 에 보관)
 3) mo/classify-local.js → .uibowl.json 의 카테고리로 확정 분류 → DATA 갱신 → (업로드) 스테이징
 4) (업로드) 폴더를 Redmine에 올리기 (사용자 수동)
```

- 수동으로 할 때: uibowl 페이지 F12 콘솔에 `uibowl-capture.js` 내용을 붙여넣고 끝나면 `capture-mo.bat`(웹은 `capture-web.bat`) 더블클릭.
- `uibowl-category-map.json`: 이름이 다른 uibowl 카테고리는 `alias`에, 분류하지 않을 것(앱스토어 홍보 컷 `iPhone 스크린샷` 등)은 `skip`에.
  skip 대상은 `(업데이트)/_분류제외/`로 빠진다. 로컬에 없는 카테고리는 이유와 함께 미분류로 간다.
- `(업데이트)` 안에서 `_`로 시작하는 폴더는 분류 대상에서 제외된다 (보류용).
- Cowork VM에서 돌릴 땐 `TZ=Asia/Seoul` 을 붙인다 (안 붙이면 파일명 날짜가 UTC 기준으로 하루 밀림).
- 매니페스트 없는 예전 방식 폴더는 기존처럼 이름기반 → 미분류 판정 흐름을 탄다.

---


### 분할 압축 (2026-10-21 추가) — zip-upload.js
업로드 준비가 끝나면 `classify-local.js`(아이콘 스테이징 다음)와 `prepare-upload.bat`이 자동으로 실행한다.
- `{site}/(업로드)/` 전체를 **95MB 이하 zip 여러 개**로 나눠 `(업로드)/` 바로 아래에 저장 (기존 *.zip은 먼저 삭제)
- 파일명 = 오늘 날짜(KST): 1개면 `20261021.zip`, 여러 개면 `20261021_1.zip`, `_2.zip` …
- zip마다 단독으로 풀린다 (분할 볼륨 아님). 폴더 구조 유지, index.html·version.js·stats.js는 항상 1번 zip
- PNG라 무압축(store) — 외부 프로그램 없이 Node만 사용
- 수동: `node zip-upload.js --site web` (`--limit 95` 로 한도 변경)
- prepare-upload가 중간에 끊겼으면 `RESUME=1 node prepare-upload.js` 로 이어서 복사 (폴더를 비우지 않음)

## 1. 전체 워크플로우 (2026-07-09 확정 — 3단계로 단순화)

```
[수집]                          [적재]                     [명령 실행 1번]
uibowl 서비스 페이지에서   →   {mo|web}/(업데이트)/       →   classify-local.bat
F12 콘솔 스크립트로            {서비스명}/ 폴더에              (분류 + DATA/백업 갱신
아이콘+스크린샷 함께 수집       통째로 이동                     + 업로드 폴더 정리까지 자동)
                                                                      ↓
                                                            (업로드)/ 폴더를
                                                            Redmine으로 서버 업로드
```

1. **수집** — uibowl.io에서 서비스 페이지(`https://uibowl.io/name/{서비스명}` 또는 `https://uibowl.io/website/name/{서비스명}`)를 열고 F12 콘솔 스크립트 실행 → 그 서비스의 아이콘 1장 + 스크린샷 전체가 한 번에 다운로드된다 (§4).
2. **적재** — 다운로드된 파일을 전부 `{mo|web}/(업데이트)/{서비스명}/` 폴더 하나에 그대로 이동한다. 아이콘과 스크린샷을 구분해서 넣을 필요 없음 — 같은 폴더에 섞어 넣으면 된다.
3. **명령 실행** — 그 사이트 폴더의 `classify-local.bat`을 더블클릭 한 번. 아래가 전부 자동으로 처리된다 (§3):
   - 폴더 안의 아이콘 파일(서비스명과 같은 파일명) → `icons/`로 편입
   - 나머지 스크린샷 → 패턴명 기준으로 카테고리 폴더에 분류 (새 패턴이면 AI Vision 보조 분류, API 키 없으면 미분류 폴더에 보관)
   - `index.html` DATA·`version.js`·`stats.js`·`search-index.js`·`upload-list.txt` 갱신 + `backups/`에 인덱스 자동 백업
   - `(업로드)/` 폴더에 이번에 새로 분류된 이미지 + `index.html`/`version.js`/`stats.js`/아이콘까지 전부 스테이징
4. **서버 반영** — `(업로드)/` 폴더 안의 내용을 Redmine으로 서버에 업로드하면 끝 (`mo/...`, `web/...` 상대 경로 유지).

모바일 서비스는 `mo/`, PC 웹 서비스는 `web/` 기준으로 위 과정을 동일하게 반복한다. 두 폴더의 스크립트는 로직이 동일하며, 실행한 폴더의 사이트만 처리한다.

---

## 2. 파일 구조

```
uipatterns/
├── index.html               # 루트 랜딩 스텁 — mo/로 자동 리다이렉트, 모바일·웹 선택 링크 제공
├── GUIDE.md                 # 이 파일
├── mo/                       # 모바일 앱 스크린샷 사이트 (완전 독립)
│   ├── index.html             # 단일 파일 사이트 (CSS·JS·DATA 내장)
│   ├── version.js             # DATA MD5 해시 — 페이지 자동 새로고침용
│   ├── search-index.js        # 통합검색(크로스사이트)용 인덱스 — update-index.js가 매번 재생성
│   ├── upload-list.txt        # 날짜별 신규 파일 누적 목록 (서버 동기화 기준)
│   ├── stats.json             # 현재 통계 스냅샷 (update-index.js가 매 실행마다 갱신)
│   ├── stats.js                # stats.json과 동일 내용을 window.__STATS__로 감싼 사본 — 사용현황 대시보드가 file://에서 다른 사이트(mo/web) 통계를 <script> 주입으로 읽어올 때 씀 (§8)
│   ├── icons/                  # 서비스 아이콘 PNG
│   ├── {카테고리}/              # UI 패턴 이미지 폴더
│   ├── (업데이트)/              # 분류 전 임시 적재 폴더 — 서비스명 폴더 안에 아이콘+스크린샷 같이 넣는 곳
│   ├── (업로드)/                # classify-local 실행 시 자동 생성되는 서버 업로드용 스테이징 폴더
│   ├── backups/                # index.html 자동 백업 최대 30개
│   ├── classify-local.js / classify-local.bat   # 3단계 "명령 실행" 그 자체
│   ├── update-index.js / update.bat             # classify-local이 내부적으로 호출 (수동 실행도 가능)
│   ├── prepare-upload.js / prepare-upload.bat    # classify-local이 내부적으로 호출 (수동 실행도 가능)
│   └── restore-backup.bat                        # 비상 복구용
└── web/                      # PC 웹사이트 스크린샷 사이트 — mo/와 스크립트 구성은 동일, 데이터는 완전 독립
    └── (mo/와 동일한 파일 구성)
```

**mo/와 web/는 스크립트 로직은 동일하지만 데이터(카테고리 목록·SVC_TYPES·이미지·DATA)는 완전히 독립**이다. 한쪽 폴더에서 스크립트를 실행해도 다른 쪽에는 전혀 영향을 주지 않는다.

**런타임 자동 생성 파일** (mo/, web/ 각각에 개별 생성, 삭제 가능):
- `.last-upload` — prepare-upload 마지막 준비 날짜 기록 (재준비 시 삭제)
- `.update.lock` — update-index.js 동시 실행 방지 락. **삭제되지 않고 항상 덮어쓰기만 됨** (§11 참고)
- `prepare-upload-debug.log` — prepare-upload 실행 로그 (콘솔 출력이 안 보일 때 확인용, 매 실행마다 초기화됨)

---

## 3. 스크립트 목록

아래 스크립트는 `mo/`와 `web/`에 동일하게 존재한다. 실행한 위치(어느 폴더의 `.bat`)의 사이트만 처리된다.
운영 중 사람이 직접 실행할 일이 있는 건 사실상 **`classify-local.bat` 하나**뿐이고, 나머지는 그 안에서 자동 호출되거나 비상용이다.

### classify-local.js / classify-local.bat — 메인 파이프라인  (v3, 2026-08-20 개편)

`(업데이트)/{서비스명}/` 폴더 하나에 아이콘+스크린샷을 같이 넣고 이 배치 파일 **한 번**만 실행하면 끝난다.

0. **대기중 결정 반영** — `(업데이트)/미분류/_결정.json`이 있으면 먼저 적용한다. Cowork(Claude) 세션이 미분류 화면을 판정해 남겨둔 결과다. 적용 후 `_결정_적용_YYYYMMDD.json`으로 이름만 바꿔 보관한다.
1. **아이콘 편입** — 서비스 폴더 안에서 파일명이 서비스명과 같은 이미지(예: `젠디/젠디.png`)를 찾아 `icons/{서비스명}.png`(NFC 정규화)로 이동. `(업데이트)` 루트에 바로 놓인 아이콘도 지원.
2. **이름기반 확정 분류** — 파일명의 화면 이름이 기존 DATA와 **정확/정규화 일치**하고, 그 이름의 **70% 이상이 한 카테고리에 몰려 있을 때만** 카테고리 폴더로 옮긴다. 이 조건에서의 실측 정확도는 **97.5%**. `메인`처럼 여러 카테고리에 흩어진 이름은 이름으로 정하지 않고 3단계로 넘긴다.
3. **AI 이미지 판정** — 남은 화면을 실제 스크린샷으로 판정한다. 키는 `api-key.txt`(mo/web 폴더 또는 상위 `uipatterns/`) 또는 환경변수 `ANTHROPIC_API_KEY`에서 찾는다. 프롬프트에는 파일명에서 뽑은 화면 이름과 이름기반 후보를 힌트로 같이 넣는다. 모델은 기본 Sonnet, `ANTHROPIC_VISION_MODEL`로 변경 가능. 배치 실패는 그 배치만 미분류로 남고 나머지는 계속 진행한다.
   키가 없으면 `(업데이트)/미분류/_분류요청.md`(파일 목록 + 후보 + 처리 절차)를 만들어 두고 넘어간다.
4. **DATA 갱신** — `update-index.js` 자동 실행. **이동한 게 0개여도 항상 실행한다** (v2는 건너뛰어서, 이전 실행에서 밀린 파일이 영영 업로드되지 않았다).
5. **업로드 준비** — `prepare-upload.js` 자동 실행. 역시 항상 실행.
6. **아이콘 스테이징** — 이번에 새로 편입된 아이콘을 `(업로드)/icons/`에 복사.
7. **최종 점검** — 이번에 분류한 파일이 실제로 `(업로드)`에 담겼는지 대조하고, 빠진 게 있으면 파일명과 복구 방법을 출력한다.

전체 로그는 콘솔뿐 아니라 `classify-debug.log`에도 남는다.

#### v2에서 무엇이 문제였나 (2026-08-20 실측)

| 항목 | 수치 |
|---|---|
| 신규 배치에서 "처음 보는 패턴명"이라 미분류로 빠지던 비율 | 평균 **82%** (배치별 60~91%) |
| 8/20 플랭 배치 | 183장 중 **166장(91%)** |
| 파일명에 화면 이름이 아예 없는 이미지(`서비스_001_날짜.png`) | 전체의 **33%** — 무조건 미분류 |

v2는 기존 패턴명 4,145개와 **글자가 완전히 같을 때만** 분류했다. 신규 서비스는 화면 이름이 대부분 새것이라 통째로 미분류로 빠졌고, 분류된 게 적으니 `(업로드)`도 늘 소량이었다. 고장이 아니라 설계상 그럴 수밖에 없던 상태다.

**이름만으로 추정하는 방식은 답이 아니다.** 기존 데이터의 20%를 "처음 보는 패턴"으로 가정한 홀드아웃 검증에서 이름 기반 추정 정확도는 **top1 35% / top3 50%**였다. 같은 이름이라도 화면 내용에 따라 카테고리가 갈리기 때문이다(`전체` → 마이페이지/메인/설정). 그래서 v3는 추정을 자동 분류에 쓰지 않고 **후보 제시용으로만** 쓴다. 굳이 켜려면 `set GUESS_AUTO=1` (결과는 `(업데이트)/_추정분류.md`에 남는다).

#### 파일명이 규격을 벗어나도 살려낸다

v2는 `{서비스}_{패턴}_{번호3자리}_{YYYYMMDD}` 규격에서 조금만 벗어나도 파싱이 깨져 미분류로 보냈다. v3의 `pattern-classify.js` 파서는 아래를 전부 흡수한다.

| 들어오는 파일명 | v2 | v3 |
|---|---|---|
| `플랭_메인_1_20260820.png` (번호 자릿수 부족) | 미분류 | 정상 처리 |
| `플랭_메인_20260820.png` (번호 없음) | 미분류 | 정상 처리 |
| `플랭_메인.png` (번호·날짜 없음) | 미분류 | 정상 처리 |
| `플랭_메인_001_20260820 (1).png` (중복 다운로드본) | 미분류 (수동 삭제 필요) | 정상 처리 + 내용 같으면 자동 제거 |
| `플랭_ 메인 _001_20260820.png` (앞뒤 공백) | 미분류 | 정상 처리 |
| 한글 자모 분리(NFD) 파일명 | 미분류 | NFC 정규화 후 처리 |
| `Screenshot_2026-08-20_11-20-33.png` | 미분류 | 화면 이름 없음으로 보고 이미지 판정으로 |

또한 v2는 목적지에 같은 이름이 있으면 **덮어썼다**(NFD 파일명을 못 세어 번호가 001부터 다시 매겨지는 경우). v3는 번호를 밀어 충돌을 피하고, 내용이 완전히 같은 파일은 중복으로 보고 버린다.

#### 미분류가 남았을 때 (API 키 없이 운영할 때)

1. `classify-local.bat` 실행 → `(업데이트)/미분류/_분류요청.md` 생성됨
2. Cowork(Claude) 세션에 **"uipatterns 미분류 분류해줘"** 요청
3. Claude가 이미지를 보고 같은 폴더에 `_결정.json` 작성

```json
{
  "플랭": [
    { "file": "플랭_004_20260820.png", "category": "메인", "pattern": "메인" }
  ]
}
```

4. `classify-local.bat` 다시 실행 → 결정 반영 + 색인 + 업로드 준비까지 자동

#### 자주 틀리는 이름은 규칙으로 고정한다

`mo/pattern-rules.json` (없으면 안 만들어도 됨)에 적어두면 다음 실행부터 그 이름은 무조건 그 카테고리로 간다. 같은 판정을 반복 요청하지 않으려면 여기에 쌓으면 된다.

```json
{
  "patterns": { "레벨테스트 결과리포트": "통계ㆍ리포트" },
  "keywords": [ { "match": "결제수단", "category": "간편결제" } ]
}
```

#### 옵션 (환경변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DRY_RUN=1` | 꺼짐 | 파일을 옮기지 않고 결과만 출력 |
| `NAME_SHARE` | `0.7` | 이름으로 확정할 때 요구하는 카테고리 점유율 |
| `ANTHROPIC_VISION_MODEL` | `claude-sonnet-4-5` | 이미지 판정 모델 |
| `VISION_BATCH` | `6` | 한 번에 보내는 스크린샷 수 |
| `GUESS_AUTO=1` | 꺼짐 | 이름 기반 추정도 자동 분류에 사용 (정확도 35%, 비권장) |

### 미분류 판정은 Cowork(Claude) 세션에서 한다 — API 키 안 씀

Anthropic API는 **Claude 구독(Pro/Max)과 별개인 선불 크레딧**이 필요하다. 이 프로젝트는 크레딧을 쓰지 않기로 했으므로 `api-key.txt`를 두지 않는다(키가 없으면 3단계가 자동으로 건너뛰어지고 판정 요청서만 만들어진다).

운영 흐름은 두 번의 실행이다.

1. `(업데이트)/{서비스명}/`에 이미지를 넣고 `classify-local.bat` 실행
   → 이름으로 확정되는 것만 분류되고, 나머지는 `(업데이트)/미분류/{서비스명}/`에 모이며 `_분류요청.md`가 생성된다
2. Cowork 세션에 **"uipatterns 미분류 분류해줘"** 요청
   → Claude가 이미지를 몽타주로 묶어 보고 `(업데이트)/미분류/_결정.json`을 작성한다
3. `classify-local.bat` 다시 실행 → 결정 반영 + 색인 + 업로드 준비까지 자동

Claude가 판정할 때 쓰는 방법(참고): `device_bash` + PIL로 스크린샷을 폭 380px로 줄여 4장씩 가로 몽타주(`_montage/mNNN.png`)로 묶고, 타일마다 `#인덱스`를 찍은 뒤 `_map.json`으로 인덱스↔파일명을 맞춘다. 이 크기에서 본문까지 읽히므로 판정 정확도가 유지되면서 토큰은 1/4로 줄어든다. 판정이 끝나면 `_montage` 폴더는 지운다(그대로 두면 `미분류` 아래의 서비스 폴더로 오인된다).

```
classify-local.bat   ← 더블클릭 (api-key.txt 있으면 미분류까지 자동)
```

---

### update-index.js / update.bat — DATA 갱신 (classify-local이 내부 호출, 수동 실행도 가능)

카테고리 폴더를 전체 스캔해 그 사이트의 `index.html` DATA 블록·`version.js`·`stats.json`/`stats.js`·`search-index.js`를 갱신한다.
실행 전 `index.html`을 `backups/index_YYYYMMDD_HHMMSS.html`로 자동 백업 (최대 10개 보관(환경변수 `MAX_BACKUPS`로 변경 가능 — 백업 1개가 4~9MB라 30개면 수백 MB가 쌓인다), 초과분 삭제 실패해도 전체가 죽지 않도록 개별 try/catch로 방어).
신규 파일은 파일명 날짜(`_YYYYMMDD`) 기준으로 `upload-list.txt`에 날짜별 누적 기록.

**신규 서비스 업종 자동 분류 (API 키 불필요, 완전 오프라인 — 2026-07-10 개편)** — 스캔 후 `SVC_TYPES`에 아직 없는 신규 서비스가 발견되면 `autoClassifyTypes()`가 이어서 자동 실행된다. 예전에는 `ANTHROPIC_API_KEY` + Claude API로 분류했으나, 이제 키 없이 다음 2단계로 채운다:
- **① 반대편 사이트 재사용** — 먼저 반대편 사이트(mo↔web)의 `index.html` `SVC_TYPES`를 읽어, 같은 서비스명이 거기 이미 분류돼 있으면 그 업종을 그대로 가져온다(가장 정확). 단 반대편이 `미분류`/`기타`거나, 그 업종이 이 사이트 `ALL_INDUSTRY_TYPES`에 없으면 재사용하지 않고 ②로 넘어간다.
- **② 키워드 사전** — `update-index.js` 상단 `TYPE_KEYWORDS`(업종별 브랜드명·도메인 고유어)로 서비스명+수집된 카테고리·화면명을 부분일치 검색해 추정. 오분류를 피하려 고정밀 키워드만 넣었고, 매칭되는 업종이 그 사이트 `ALL_INDUSTRY_TYPES`에 있을 때만 채택한다.
- **③ 미분류 폴백** — ①②로도 못 맞추면 `SVC_TYPES`에 넣지 않고 `미분류`로 남긴다(사이드바에 `미분류`로 표시, 크래시 없음). 필요하면 그 사이트의 `SVC_TYPES` 블록에 `'서비스명':'업종'`을 직접 추가하거나, `TYPE_KEYWORDS`에 키워드를 보강하면 다음 실행부터 자동 분류된다.
- `mo/`는 30개 업종, `web/`는 20개 업종 목록을 각자의 `index.html`에서 동적으로 읽어와 분류 기준으로 사용 (§7) — 재사용·키워드 어느 경로든 그 사이트 `ALL_INDUSTRY_TYPES`에 있는 업종으로 클램프하므로 두 사이트 업종 목록은 서로 섞이지 않는다(web에 없는 `메신저`·`소개팅` 등이 web에 유입되지 않음).

**search-index.js 생성** — index.html의 통합검색(§8)이 상대 사이트를 검색할 때 읽어가는 인덱스. 그 사이트 자신의 DATA에서 카테고리 목록·서비스별 스크린 수·패턴명을 계산해 매번 새로 만든다(§7에 스키마 설명).

**동시 실행 방지** — `.update.lock` 파일 기반 락 (5분 초과 시 stale 처리). 이 작업 폴더는 파일 삭제·이름변경이 제한될 수 있어, 락 해제는 파일을 지우는 대신 `{pid,status,ts}` JSON을 `running`↔`idle`로 덮어쓰는 방식으로 구현되어 있다.

```
update.bat   ← 더블클릭 (classify-local.bat이 내부적으로 이미 호출하므로 평소엔 직접 실행할 일 없음)
```

---

### prepare-upload.js / prepare-upload.bat — 업로드 폴더 스테이징 (classify-local이 내부 호출)

그 사이트의 `upload-list.txt` 기준으로 마지막 업로드 이후 신규 파일만 추려 `(업로드)/` 폴더에 카테고리 구조 그대로 복사한다. `index.html`·`version.js`·`stats.js`는 **신규 이미지가 하나도 없어도 항상 최신 상태로 포함**된다. 완료 후 탐색기로 `(업로드)/` 폴더를 자동 오픈. 실행할 때마다 `(업로드)/` 안의 기존 내용을 먼저 정리한 뒤 다시 채우므로, 이전 업로드 잔여물이 남지 않는다.

모든 실행 로그는 콘솔뿐 아니라 `prepare-upload-debug.log`에도 그대로 기록된다 (배치 콘솔 출력이 안 보이는 경우에도 확인 가능하도록). 예외가 발생해도 로그에 스택트레이스를 남기고 안전하게 종료한다.

```
prepare-upload.bat   ← 더블클릭 (classify-local.bat이 내부적으로 이미 호출하므로 평소엔 직접 실행할 일 없음)
```

준비 날짜는 `.last-upload` 파일에 기록되어(신규 이미지가 있었을 때만 갱신) 다음 실행 시 중복을 방지한다. 재준비가 필요하면 `.last-upload` 파일을 삭제 후 재실행.

---

### restore-backup.bat — 비상 복구용

그 사이트 `backups/` 폴더의 백업 목록을 출력하고, 선택한 파일명으로 `index.html`을 복원한다.
복원 전 현재 `index.html`을 `backups/index_before_restore_…html`로 자동 보관.
`copy /y`로 덮어쓰기 확인 프롬프트 없이 바로 진행한다(2026-07-09 수정 — `/y` 없이 실행하면 프롬프트가 콘솔 리다이렉트에 가려진 채 멈추면서 이상 동작이 날 수 있었음).

```
restore-backup.bat   ← 더블클릭 → 목록 출력 → 파일명 입력
```

목록이 길어서 원하는 백업이 화면에 안 보여도, 파일이 실제로 `backups/` 폴더에 있다면 파일명을 그대로 입력하면 된다 (목록에 보이는 것만 입력 가능한 게 아님).

---

## 4. 이미지+아이콘 수집 — uibowl.io 콘솔 스크립트 (2026-07-09 통합)

서비스 페이지 하나를 열어 F12 → Console 탭에 아래 스크립트를 붙여넣고 실행하면, **그 서비스의 아이콘 1장과 스크린샷 전체가 한 번에** 다운로드된다. 팝업 차단 메시지가 뜨면 허용 설정 필요.

**파일명 형식**: 스크린샷은 `{서비스명}_{패턴명}_{번호}_{YYYYMMDD}.png`, 아이콘은 `{서비스명}.png` (패턴명·번호·날짜 없음 — `classify-local.bat`이 이 차이로 아이콘을 구분한다).
**다운로드된 파일은 전부 그대로 `{mo|web}/(업데이트)/{서비스명}/` 폴더 하나에 이동**한다 (모바일 URL → `mo/`, 웹 URL → `web/`).

---

### 4-1. 모바일 (아이콘+스크린샷 통합 수집)

**수집 URL**: `https://uibowl.io/name/{서비스명}` (예: `https://uibowl.io/name/젠디`)

가로 스크롤 컨테이너(`[data-radix-scroll-area-viewport]`)로 스크린샷 카드를 전부 스크롤·수집한 뒤, 페이지 헤더의 아이콘(`img[alt="icon"]`)을 마지막에 함께 내려받는다.

**2026-07-09 수정**: (1) 아이콘을 `naturalWidth===128` 기준으로 찾으면 페이지 내 다른 128×128 이미지를 잘못 집어올 수 있어, 실제 아이콘 마크업의 `alt="icon"` 속성으로 특정하도록 변경. (2) 스크린샷이 끝까지 안 모이는 문제 — 가상 스크롤이 스크롤 폭(scrollWidth)을 뒤늦게 늘리는 경우 "끝에 도달"로 오판해 조기 종료되던 것을 고쳐서, 새 카드가 더 이상 안 늘어나는 상태가 6회 연속 확인될 때까지 계속 스크롤하도록 변경(단순히 스크롤 끝 도달만으로 멈추지 않음), 매 스크롤마다 전체 카드도 다시 훑어 MutationObserver가 놓친 카드를 보완.

```javascript
(async function(){
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  function sanitize(s) {
    return (s||'')
      .replace(/[・·•‧]/g, '-')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/_+/g, '_').replace(/-+/g, '-')
      .replace(/^[_-]+|[_-]+$/g, '')
      .trim();
  }
  // ★ 재시도 붙은 fetch: 일시적 네트워크 오류(HTTP2 PING 실패 등) 자동 복구
  async function fetchWithRetry(url, tries = 4) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res;
      } catch (e) {
        lastErr = e;
        // 지수 백오프: 600ms, 1200ms, 2400ms...
        await new Promise(r => setTimeout(r, 600 * Math.pow(2, i)));
      }
    }
    throw lastErr;
  }
  async function toPngBlob(url) {
    const res = await fetchWithRetry(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  async function dl(url, filename) {
    const blob = await toPngBlob(url);
    const burl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = burl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(burl), 2000);
    await new Promise(r => setTimeout(r, 500));
  }
  const allItems = new Map();
  let svcName = null;
  function getInfo(card) {
    const fk = Object.keys(card).find(k => k.startsWith('__reactFiber'));
    let f = card[fk];
    for(let i = 0; i < 15; i++) {
      const p = f?.memoizedProps;
      if(p?.children) {
        const ch = Array.isArray(p.children) ? p.children : [p.children];
        for(const c of ch) { if(c?.props?.appName) return c.props; }
      }
      f = f?.return;
      if(!f) break;
    }
    return null;
  }
  function collectCard(card) {
    const id = card.getAttribute?.('data-img-id');
    if(!id || allItems.has(id)) return;
    const img = card.querySelector('img[src*="/_next/image"]');
    if(!img?.getAttribute('src')) return;
    const info = getInfo(card);
    if (info?.appName && !svcName) svcName = sanitize(info.appName);
    const svc = sanitize(info?.appName || '미분류');
    const pat = sanitize(info?.patternName || '');
    const prefix = [svc, pat].filter(Boolean).join('_');
    allItems.set(id, { src: img.getAttribute('src'), prefix });
    console.log(`[수집 ${allItems.size}] ${prefix}`);
  }
  function collectAll() {
    document.querySelectorAll('[data-img-id]').forEach(collectCard);
  }

  function findScroller() {
    const card = document.querySelector('[data-img-id]');
    if (card) {
      let el = card.parentElement;
      while (el && el !== document.body) {
        const style = getComputedStyle(el);
        const ox = style.overflowX;
        if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth - el.clientWidth > 5) return el;
        el = el.parentElement;
      }
    }
    for (const sel of [
      '[data-radix-scroll-area-viewport]',
      '[data-radix-scroll-area-viewport] > div',
      '.overflow-x-auto', '.overflow-x-scroll'
    ]) {
      const cand = document.querySelector(sel);
      if (cand && cand.scrollWidth - cand.clientWidth > 5) return cand;
    }
    return null;
  }

  collectAll();
  const scrollEl = findScroller();
  const observer = new MutationObserver(() => collectAll());
  observer.observe(scrollEl || document.body, { childList: true, subtree: true });

  function getScrollState() {
    if (scrollEl) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      return { pos: scrollLeft, max: scrollWidth - clientWidth };
    }
    const el = document.scrollingElement || document.documentElement;
    return { pos: el.scrollTop, max: el.scrollHeight - el.clientHeight };
  }
  function stepScroll(px) {
    if (scrollEl) scrollEl.scrollLeft += px;
    else window.scrollBy(0, px);
  }
  if (!scrollEl) console.warn('가로 스크롤 컨테이너를 찾지 못해 window 스크롤로 폴백합니다.');

  let stableCount = 0;
  while (stableCount < 6) {
    const before = allItems.size;
    const { pos, max } = getScrollState();
    const atEnd = pos >= max - 5;
    stepScroll(350);
    await new Promise(r => setTimeout(r, 700));
    collectAll();
    const added = allItems.size - before;
    if (added === 0 && atEnd) stableCount++;
    else stableCount = 0;
  }
  await new Promise(r => setTimeout(r, 1200));
  collectAll();
  observer.disconnect();
  console.log(`\n총 ${allItems.size}개 카드 수집 완료 — 다운로드 시작`);

  let count = 0;
  const failed = [];  // ★ 실패 항목 모으기
  for(const [, item] of allItems) {
    const filename = `${item.prefix}_${String(++count).padStart(3,'0')}_${today}.png`;
    console.log(`[${count}/${allItems.size}] ${filename}`);
    try {
      await dl(item.src, filename);
    } catch (e) {
      console.warn(`  ✗ 실패(건너뜀): ${filename} — ${e.message}`);
      failed.push({ src: item.src, filename });
    }
  }
  console.log(`스크린샷 1차 완료: 성공 ${count - failed.length}개 / 실패 ${failed.length}개`);

  // ★ 실패분 마지막에 한 번 더 재시도
  if (failed.length) {
    console.log(`\n실패 ${failed.length}개 재시도 중...`);
    const stillFailed = [];
    for (const f of failed) {
      console.log(`  재시도: ${f.filename}`);
      try {
        await new Promise(r => setTimeout(r, 800));
        await dl(f.src, f.filename);
      } catch (e) {
        stillFailed.push(f);
        console.warn(`  ✗ 재시도도 실패: ${f.filename}`);
      }
    }
    if (stillFailed.length) {
      console.warn(`\n최종 실패 ${stillFailed.length}개 — 아래 URL을 수동 저장하세요:`);
      stillFailed.forEach(f => console.warn(`  ${f.filename}\n    ${f.src}`));
    } else {
      console.log('재시도 전부 성공 ✔');
    }
  }

  // ── 아이콘 수집 ──
  const iconImg = document.querySelector('img[alt="icon"]');
  if (iconImg && iconImg.src) {
    const name = svcName || sanitize(iconImg.closest('section')?.querySelector('strong')?.textContent || '아이콘');
    try { await dl(iconImg.src, `${name}.png`); console.log(`아이콘 완료: ${name}.png`); }
    catch (e) { console.warn(`아이콘 다운로드 실패: ${e.message}`); }
  } else {
    console.warn('아이콘(alt="icon")을 찾지 못했습니다. 직접 저장해서 같은 폴더에 넣어주세요.');
  }
  console.log(`\n전체 완료.`);
})();
```

---

### 4-2. 웹(PC) (아이콘+스크린샷 통합 수집)

**수집 URL**: `https://uibowl.io/website/name/{서비스명}` (예: `https://uibowl.io/website/name/Figma`)

`[data-radix-scroll-area-viewport]`가 없으면 `document.body` 기준 세로 스크롤로 자동 전환된다는 점만 모바일판과 다르다. 아이콘·스크롤 종료조건 수정 내용은 §4-1과 동일(2026-07-09).

```javascript
(async function(){
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');

  function sanitize(s) {
    return (s||'')
      .replace(/[・·•‧]/g, '-')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/_+/g, '_').replace(/-+/g, '-')
      .replace(/^[_-]+|[_-]+$/g, '')
      .trim();
  }

  async function toPngBlob(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function dl(url, filename) {
    const blob = await toPngBlob(url);
    const burl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = burl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(burl), 2000);
    await new Promise(r => setTimeout(r, 400));
  }

  const allItems = new Map();
  let svcName = null;

  function getInfo(card) {
    const fk = Object.keys(card).find(k => k.startsWith('__reactFiber'));
    let f = card[fk];
    for(let i = 0; i < 15; i++) {
      const p = f?.memoizedProps;
      if(p?.children) {
        const ch = Array.isArray(p.children) ? p.children : [p.children];
        for(const c of ch) { if(c?.props?.appName) return c.props; }
      }
      f = f?.return;
      if(!f) break;
    }
    return null;
  }

  function collectCard(card) {
    const id = card.getAttribute?.('data-img-id');
    if(!id || allItems.has(id)) return;
    const img = card.querySelector('img[src*="/_next/image"]');
    if(!img?.getAttribute('src')) return;
    const info = getInfo(card);
    if (info?.appName && !svcName) svcName = sanitize(info.appName);
    const svc = sanitize(info?.appName || '미분류');
    const pat = sanitize(info?.patternName || '');
    const prefix = [svc, pat].filter(Boolean).join('_');
    allItems.set(id, { src: img.getAttribute('src'), prefix });
    console.log(`[수집 ${allItems.size}] ${prefix}`);
  }

  function collectAll() {
    document.querySelectorAll('[data-img-id]').forEach(collectCard);
  }

  collectAll();
  const scrollEl = document.querySelector('[data-radix-scroll-area-viewport]');
  const observeTarget = scrollEl || document.body;
  const observer = new MutationObserver(() => collectAll());
  observer.observe(observeTarget, { childList: true, subtree: true });

  let stableCount = 0;
  while (stableCount < 6) {
    const before = allItems.size;
    let atEnd;
    if (scrollEl) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      atEnd = scrollLeft + clientWidth >= scrollWidth - 5;
      scrollEl.scrollLeft += 350;
    } else {
      const beforeY = window.scrollY;
      window.scrollBy(0, 600);
      atEnd = window.scrollY === beforeY;
    }
    await new Promise(r => setTimeout(r, 700));
    collectAll();
    const added = allItems.size - before;
    if (added === 0 && atEnd) stableCount++;
    else stableCount = 0;
  }
  await new Promise(r => setTimeout(r, 1200));
  collectAll();
  observer.disconnect();

  console.log(`\n총 ${allItems.size}개 카드 수집 완료 — 다운로드 시작`);

  let count = 0;
  for(const [, item] of allItems) {
    const filename = `${item.prefix}_${String(++count).padStart(3,'0')}_${today}.png`;
    console.log(`[${count}/${allItems.size}] ${filename}`);
    await dl(item.src, filename);
  }
  console.log(`스크린샷 완료: ${count}개`);

  // ── 아이콘(헤더의 alt="icon" 이미지) 함께 수집 ──────────────────────────
  const iconImg = document.querySelector('img[alt="icon"]');
  if (iconImg && iconImg.src) {
    const name = svcName || sanitize(iconImg.closest('section')?.querySelector('strong')?.textContent || '아이콘');
    await dl(iconImg.src, `${name}.png`);
    console.log(`아이콘 완료: ${name}.png`);
  } else {
    console.warn('아이콘(alt="icon")을 페이지에서 찾지 못했습니다. 직접 저장해서 같은 폴더에 넣어주세요.');
  }

  console.log(`\n전체 완료: 스크린샷 ${count}개` + (iconImg ? ` + 아이콘 1개` : ''));
})();
```

**카테고리별로 여러 서비스를 한 번에 모으고 싶을 때**는 기존처럼 `https://uibowl.io/?detail=1&patterns=AI` 같은 카테고리 URL에서 실행해도 된다 — 이 경우 스크린샷은 서비스별로 잘 모이지만, 아이콘은 서비스마다 페이지 상단에 하나씩만 있는 구조라 카테고리 페이지에는 없을 수 있다. 아이콘까지 정확히 챙기려면 서비스 페이지(`/name/{서비스명}`) 기준으로 개별 실행하는 걸 권장한다.

---

### 4-3. 아이콘만 일괄 수집 (전체 서비스 아이콘 한 번에)

§4-1/§4-2가 **한 서비스**의 아이콘+스크린샷을 받는 것과 달리, 이건 서비스 목록 페이지를 스크롤하며 **모든 서비스의 아이콘(128×128)만** 한꺼번에 내려받는다. 아이콘 폴더를 통째로 갱신하거나, 스크린샷은 이미 있는데 아이콘만 빠진 서비스를 메울 때 쓴다.

- **모바일**: `https://uibowl.io` 접속 → F12 → Console 실행 → 받은 파일을 `mo/icons/`로 이동
- **웹(PC)**: `https://uibowl.io/website` 접속 → F12 → Console 실행 → 받은 파일을 `web/icons/`로 이동

모바일·웹 **공통 스크립트** (URL만 달리해 사용). 가상 스크롤(virtualization) 페이지라 스크롤하며 실시간 수집하고, 128×128 아이콘 `img`에서 React fiber를 거슬러 올라가 `appName`을 추출해 파일명으로 저장한다. 팝업 차단 허용 필요. 새 항목 없이 4회 연속이면 종료.
아이콘 특정은 §4의 단일 서비스 페이지와 달리 목록 페이지엔 아이콘이 128×128로 렌더되므로 크기 기준으로 잡는다(§4의 `alt="icon"` 방식은 단일 서비스 페이지 전용).

```javascript
(async function(){
  function sanitize(s) {
    return (s||'').replace(/[・·•‧]/g,'-').replace(/[<>:"/\\|?*]/g,'')
      .replace(/_+/g,'_').replace(/-+/g,'-').replace(/^[_-]+|[_-]+$/g,'').trim();
  }

  async function toPngBlob(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }

  // 128×128 아이콘 img에서 위로 올라가며 React fiber에서 appName 추출
  function getNameFromIcon(img) {
    let el = img;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) break;
      const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      if (!fk) continue;
      let f = el[fk];
      for (let j = 0; j < 15; j++) {
        const p = f?.memoizedProps;
        if (p?.appName) return p.appName;
        if (p?.children) {
          const ch = [p.children].flat(5);
          for (const c of ch) if (c?.props?.appName) return c.props.appName;
        }
        f = f?.return; if (!f) break;
      }
    }
    return null;
  }

  // 현재 DOM에서 미수집 아이콘 수집
  function collectVisible(map) {
    for (const img of document.querySelectorAll('img')) {
      if (img.naturalWidth !== 128 || img.naturalHeight !== 128) continue;
      if (!img.src || img.src.startsWith('data:')) continue;
      const name = getNameFromIcon(img);
      if (!name) continue;
      const safe = sanitize(name);
      if (!map.has(safe)) {
        map.set(safe, img.src);
        console.log(`[수집 ${map.size}] ${safe}`);
      }
    }
  }

  const collected = new Map();
  let noNewCount = 0;

  // 스크롤하면서 수집 (새 항목 없이 4회 연속이면 종료)
  while (noNewCount < 4) {
    const before = collected.size;
    collectVisible(collected);
    const added = collected.size - before;
    window.scrollBy(0, window.innerHeight * 0.7);
    await new Promise(r => setTimeout(r, 700));
    if (added === 0) noNewCount++;
    else noNewCount = 0;
    if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 100) {
      await new Promise(r => setTimeout(r, 800));
      collectVisible(collected);
      break;
    }
  }

  console.log(`\n총 ${collected.size}개 수집 완료 — 다운로드 시작`);

  let count = 0;
  for (const [safe, src] of collected) {
    count++;
    console.log(`[${count}/${collected.size}] ${safe}.png`);
    try {
      const blob = await toPngBlob(src);
      const burl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = burl; a.download = `${safe}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(burl), 2000);
      await new Promise(r => setTimeout(r, 400));
    } catch(e) {
      console.warn(`  실패: ${e.message}`);
    }
  }
  console.log(`\n완료: ${count}개`);
})();
```

---

## 5. upload-list.txt — 서버 동기화 기준

`mo/upload-list.txt`와 `web/upload-list.txt`는 각각 별도로 관리된다.
`classify-local.bat` 실행마다(내부적으로 update-index.js가) 신규 파일을 파일명의 `_YYYYMMDD` 날짜 기준으로 그룹핑해 누적 기록한다.
기존 날짜 섹션이 있으면 병합하며, 전체를 최신 날짜 내림차순으로 재정렬한다.

**형식 예시** (`mo/upload-list.txt`)

```
[2026-07-09]
AI/젠디_로그인_001_20260709.png
AI/젠디_대시보드_002_20260709.png

[2026-06-24]
초대하기ㆍ받기/Apple Invites_초대받기_001_20260624.png
...
```

**서버 동기화 절차**

1. `classify-local.bat` 실행 → `(업로드)/` 폴더 자동 생성 (신규 이미지 + 아이콘 + `index.html` + `version.js` + `stats.js` 포함)
2. `(업로드)/` 폴더를 Redmine으로 서버에 업로드 (`mo/...`, `web/...` 상대 경로 유지)
3. 서버 페이지 강제 새로고침(Ctrl+Shift+R)으로 확인

**서버 동기화 상태 확인** (서버 `mo/` 또는 `web/` 페이지 콘솔에서 각각 실행)

```javascript
const r = await fetch('version.js?_='+Date.now());
const txt = await r.text();
console.log('서버 version:', txt.match(/"([^"]+)"/)?.[1]);
console.log('현재 version:', window.__UIP_VER);
console.log('일치:', txt.includes(window.__UIP_VER));
```

**파일 존재 여부 일괄 검증** (서버 `mo/` 또는 `web/` 페이지 콘솔에서 각각 실행)

```javascript
const base = location.href.replace(/index\.html.*$/, '');
const cats = [...new Set(DATA.map(d=>d.category))];
const failed = [];
for(const cat of cats){
  const items = DATA.filter(d=>d.category===cat);
  for(const d of [...items.slice(0,3), ...items.slice(-3)]){
    const r = await fetch(base+d.path,{method:'HEAD'}).catch(()=>({status:0}));
    if(r.status!==200) failed.push({cat, path:d.path, status:r.status});
  }
}
console.log('누락:', failed.length, failed);
```

---

## 6. 데이터 구조

각 사이트(`mo/index.html`, `web/index.html`)는 동일한 구조의 DATA·S·SVC_TYPES를 갖되, **내용은 서로 완전히 독립**이다.

### DATA 블록 (index.html 내부)

```js
// __DATA_START__
const DATA = [
  { "category": "메인", "name": "클로바노트_녹음하기_001_20260617", "path": "메인/클로바노트_녹음하기_001_20260617.png" },
  ...
];
// __DATA_END__
```

- `category` = 폴더명 = UI 패턴 타입
- `name.split('_')[0]` = 서비스명
- `name.split('_').slice(1,-2).join(' ')` = 패턴명
- 이미지 경로: `{category}/{name}.png`

### search-index.js (통합검색용, 2026-07-09 추가)

`update-index.js`가 매번 그 사이트의 DATA로부터 다시 계산해 생성한다. 상대편 사이트가 `<script src="../{mo|web}/search-index.js">` 방식으로 읽어가 크로스사이트 검색에 쓴다 (stats.js와 동일 패턴, file://에서 fetch로 다른 폴더를 못 읽는 문제 우회).

```js
window.__SEARCH_INDEX__ = {
  "platform": "mo",                                   // 또는 "web"
  "cats": ["간편결제", "검색", ...],                     // 그 사이트의 UI 패턴 카테고리 전체 목록
  "svcs": [{ "svc": "Amap", "cat": "AI", "count": 310 }, ...],  // 서비스별 총 스크린 수 (cat은 대표 카테고리 1개)
  "pats": [{ "pat": "채팅", "svc": "Discord", "cat": "AI", "path": "AI/Discord_채팅_001_20260617.png", "name": "Discord_채팅_001_20260617" }, ...]  // 고유 (패턴,서비스) 조합
};
```

`index.html`의 `extractService`/`extractPattern` 함수와 완전히 동일한 로직으로 계산되므로, 둘 중 하나를 고치면 `update-index.js`의 해당 블록도 같이 맞출 것.

### 상태 객체 (S)

```js
const S = {
  checked: new Set(),           // 선택된 UI 패턴 카테고리
  checkedTypes: new Set(),      // 선택된 업종
  selected: new Set(),          // 다중 선택 다운로드 — 반드시 포함
  view: 'index' | 'detail',
  svc: null | '서비스명'
};
```

`selected: new Set()` 누락 시 사이드바·카드 전체 동작 불가.

### URL 해시 상태 동기화

| 해시 | 의미 |
|------|------|
| `#cat=AI` | UI 패턴 필터 |
| `#type=금융` | 업종 필터 |
| `#svc=카카오톡` | 서비스 상세 |
| `#cat=AI&type=금융` | 복합 필터 |

### SVC_TYPES / ALL_INDUSTRY_TYPES (업종 매핑, 사이트별 독립)

**`mo/index.html`** — 30개 업종 (풀 리스트):
AI, IoT, OTT, SNS, 게임, 교육&도서, 금융, 기타, 농업, 도구, 메신저, 모빌리티, 반려동물, 배달&음식&주류, 부동산, 뷰티, 비즈니스툴, 소개팅, 심리, 여행, 운동&건강, 육아, 음악, 의료, 일상, 적립, 채용, 커머스, 커뮤니티, 콘텐츠

**`web/index.html`** — 20개 업종 (모바일 전용 업종 IoT·SNS·게임·농업·메신저·반려동물·소개팅·육아·음악·적립 제외한 축소 리스트):
AI, OTT, 교육&도서, 금융, 기타, 도구, 모빌리티, 배달&음식&주류, 부동산, 뷰티, 비즈니스툴, 심리, 여행, 운동&건강, 의료, 일상, 채용, 커머스, 커뮤니티, 콘텐츠

새 서비스 추가 시 해당 사이트의 `SVC_TYPES`에 자동 추가된다 (`classify-local.bat`이 내부적으로 update-index.js를 호출할 때 Claude API로 자동 분류, §3). API 키가 없으면 `미분류`로 남으며 수동 추가도 가능.
**주의**: `classify-local.js`/`update-index.js`를 수정할 때는 반드시 그 사이트의 `ALL_INDUSTRY_TYPES`를 동적으로 읽어오도록 유지할 것 — mo의 30개 리스트를 web에 하드코딩하면 제거된 업종(메신저·소개팅 등)이 web에 되살아난다.

---

## 7. index.html UX 동작

`mo/index.html`과 `web/index.html`은 동일한 UX 로직을 공유한다 (독립 실행되는 두 개의 동일 구조 SPA).

### 인덱스 뷰 (서비스 목록)

- 서비스 카드 클릭 → 해당 서비스 디테일 뷰로 이동
- 필터 모드: 사이드바에서 UI 패턴 또는 업종 선택 → 해당 조건의 전체 카드를 서비스별 그룹(`.svc-group`)으로 표시
- **필터 모드 서비스 헤더 클릭 → 그 서비스 디테일 뷰로 이동** (2026-07-10 추가). 각 그룹 상단의 서비스 헤더(`.svc-header`: 아이콘+서비스명+카테고리)에 `onclick="showService(...)"`가 걸려 있어 클릭 시 그 서비스의 전체 화면으로 진입한다. 개별 스크린샷 카드는 종전대로 라이트박스로 열린다(헤더만 네비게이션).
- 상단 칩: 활성 필터 표시. 각 칩의 X → 해당 필터 해제. **칩 줄 맨 오른쪽 "초기화" 버튼(`.chip-reset`, `clearFilters()`) → 선택한 모든 패턴·업종 필터를 한 번에 해제**하고 인덱스 최상위로 복귀 (활성 필터가 하나라도 있을 때만 표시, 2026-07-10 추가)
- **필터 토글 시 최상단 즉시 스크롤** (2026-07-10): `toggleCat`/`toggleType`가 렌더 직후 `window.scrollTo({top:0, behavior:'auto'})`를 호출. 패턴을 추가 선택하거나 해제할 때 항상 인덱스 최상위 화면부터 보인다. `behavior:'instant'`는 일부 브라우저 엔진에서 TypeError를 던져 함수 실행이 중단되므로 반드시 `'auto'`를 쓸 것

### 디테일 뷰 (카드 목록)

- 상단 서비스 정보 바(`.detail-bar`)에 **뒤로가기 버튼**(`← 목록`) — 클릭 시 인덱스 뷰로 복귀. 헤더(80px) 바로 아래 **sticky**로 고정되어 스크린샷을 아무리 스크롤해도 항상 접근 가능. 좁은 화면(≤480px)에서는 "목록" 텍스트가 사라지고 아이콘만 표시
- 카드 단일 클릭 → **라이트박스 모달**로 확대 (닫기 버튼 / 배경 클릭 / ESC). 확대 이미지(`#lb-img`) 최대 폭: mo 1050px / web 1280px
- 모달 내 다운로드 버튼 → 단일 이미지 fetch→blob 다운로드
- 카드 호버 → 좌상단 체크박스 표시 → 클릭 시 선택 (하단 선택 바 등장)
- 선택 바 ZIP 다운로드 → 체크된 항목 전체를 ZIP으로 일괄 다운로드

### 검색 (2026-07-09 mo/web 통합검색 완료)

- 헤더 검색창 → 서비스명·패턴명 실시간 검색 (2자 이상 입력 시)
- 자기 사이트 결과와 함께, 상대 사이트(mo↔web) 검색 결과도 "모바일에서"/"웹사이트에서" 섹션으로 같이 표시됨 — `search-index.js`(§6)를 상대 사이트에서 지연 로딩(script 주입)해 계산
- 카테고리/서비스/패턴 결과 클릭 → 해당 필터 적용 또는 라이트박스 모달로 바로 열기 (상대 사이트 결과 클릭 시 그 사이트의 이미지를 크로스로 열어줌)

### 사용 현황 대시보드

헤더의 "사용 현황" 진입 시 표시되는 통계 화면. mo/web 양쪽에 동일한 구조로 존재하며 동작도 동일하다.

- **탭 구성**: `전체` · `모바일` · `웹사이트` 3탭(`dashTab` 상태). `전체`는 지금 보고 있는 사이트(자기 자신)의 활동 로그를 그대로 보여주고, `모바일`/`웹사이트` 탭은 `aTrack()`이 기록해둔 `byPlatform.{mo,web}` 버킷을 각각 보여준다.
- **플랫폼 pill 카드**(카탈로그 크기 표시 카드)는 탭 버튼과 별개로 직접 클릭해도 해당 탭으로 전환된다.
- **크로스사이트 통계 로딩**: `file://`로 로컬에서 열었을 때 `fetch()`는 다른 폴더(mo↔web)의 파일을 읽지 못한다(브라우저 제약). 그래서 상대편 사이트 통계는 `fetch` 대신 `<script src="../{mo|web}/stats.js">` 주입 방식으로 읽어온다 — `version.js` 자동 새로고침 폴러와 동일한 패턴. `stats.js`는 update-index.js가 실행될 때마다 항상 최신으로 재생성되며, 서버에도 반드시 함께 배포해야 한다 (prepare-upload가 자동 포함).
- **인기 서비스 아이콘 크로스플랫폼 경로**: `모바일`/`웹사이트` 탭의 "인기 서비스" 아이콘은 그 서비스가 실제로 속한 사이트의 `icons/` 폴더(`../mo/icons/` 또는 `../web/icons/`)에서 가져온다 (`rankIconBase`가 탭 값에 따라 경로를 계산).

---

## 8. 디자인 스펙

다크모드. 이모지 금지 — 아이콘은 Lucide SVG만 사용. `mo/`, `web/` 동일 스펙 적용.

| 항목 | 값 |
|------|-----|
| 폰트 | Pretendard (jsdelivr CDN) |
| 아이콘 라이브러리 | Lucide Icons 0.383.0 (unpkg CDN) — 단일, 혼용 금지 |
| 헤더 | 80px 고정, 좌우 패딩 16px |
| 사이드바 | 240px 고정 |
| 그리드 | 5열 (900px↓ 4열, 600px↓ 3열) |
| 카드 radius | 20px |
| 카드 비율 | 375:812 |

**CSS 변수**

```css
--bg:      #0c0c0e
--bg-card: #17181c
--border:  #32343e
--text-1:  #f0f0f2
--accent:  #3182f6
```

**사이드바 구성**: [UI 패턴] 섹션 · 구분선 · [카테고리 유형] 섹션.
정렬: 영문(ABC) 먼저, 한글(ㄱㄴㄷ) 순.

**코딩 규칙**: 동적 템플릿 내 SVG → inline 사용 / 정적 HTML → `<i data-lucide="...">` + `lucide.createIcons()`.

**버튼·칩 계열 (2026-07-10 통일)** — 같은 유형은 배경·테두리·호버를 하나로 맞춘다:

- **아웃라인 계열** (`← 목록` 뒤로가기 `.back-btn`, 칩 초기화 `.chip-reset`, 라이트박스 닫기 `.lb-close`·좌우 화살표 `.lb-nav`, 선택 종료 `.sb-exit-btn`, 대시보드 닫기 `.dash-hdr-close`): 기본 `background:var(--bg-card)` + `border:1px solid var(--border)` + `color:var(--text-2)` → 호버 `background:var(--bg-hover)` + `color:var(--text-1)`(테두리 색은 유지). 모양(radius)만 맥락에 맞춰 다르게 둔다(초기화 칩은 칩 줄에 맞춰 알약형 999px, 나머지는 8~10px).
- **고스트 계열** (전체선택 `.sb-sel-all-btn`, 아이콘 버튼 `#admin-btn`, 모바일 사이드바 탭 `.sb-mobile-tab`): 배경·테두리 없음 → 호버 `background:var(--bg-hover)` + `color:var(--text-1)`.
- **채움/주요 계열** (다운로드 `.sb-dl-btn`·`.lb-dl`): `background:var(--accent)` → 호버 `var(--acc-h)`.
- **탭 계열** (`.hdr-tab`, `.dash-tab`): 배경 변화 없이 색상만(`text-3`→`text-1`) 변경, `.active`는 `text-1`.

새 버튼/칩을 추가할 때는 위 4개 계열 중 하나를 골라 그 토큰을 그대로 재사용할 것 — 같은 아웃라인 타입인데 배경·호버가 다르게 새로 정의하지 말 것.

---

## 9. 백업·복원

`mo/`, `web/` 각각 독립적으로 `classify-local.bat`(내부의 update-index.js) 실행마다 `backups/index_YYYYMMDD_HHMMSS.html`로 자동 백업 (최대 30개, 초과분 삭제 실패해도 크래시하지 않음).

**복원**: 해당 사이트 폴더의 `restore-backup.bat` 더블클릭 → 목록 출력 → 파일명 입력 (목록에 안 보여도 실제 존재하는 파일명이면 입력 가능, §3).

**임의 시점 백업이 필요할 때**는 사용자가 직접 `update.bat`을 실행하는 것이 가장 안전하다 — 신규 이미지가 없어도 재스캔 결과는 동일하게 나오고(무위험), 실행 즉시 그 시점의 `index.html`이 `backups/`에 백업된다. Claude가 대신 `cp` 등으로 대용량 `index.html`을 복사·재작성하는 방식은 **권장하지 않음**: 실행 환경의 브릿지(마운트)가 수 MB급 파일에 대해 오래된 캐시본을 보여주거나 쓰기 도중 잘린/중복된 사본을 만드는 문제가 실제로 여러 번 있었다 (§10). 백업·복원처럼 index.html 전체를 다루는 작업은 항상 `.bat` 실행으로 처리할 것.

---

## 10. 주의사항

- 작업 폴더 고정: `C:\Users\luvms\Desktop\ing\uipatterns`에서만 작업 (하위 `mo/`, `web/` 포함)
- `.bat` 파일은 사용자가 직접 실행 (원격 실행 불가)
- DATA 수정은 `// __DATA_START__` ~ `// __DATA_END__` 사이만, 그리고 반드시 올바른 사이트(mo 또는 web)의 index.html에서
- `backups/` 폴더는 DATA 스캔 EXCLUDE 목록에 포함 (이미지로 취급 안 됨)
- 아이콘은 PNG만 (`icons/` 폴더) — webp 금지. 수집 스크립트가 자동 변환
- 파일명 금지 문자: `・` (카타카나 중점) — 수집 스크립트가 `-`로 자동 변환
- `(숫자)` 중복 파일 생성 시 (`파일명 (1).png`) → 즉시 삭제 후 `classify-local.bat` 실행
- 아이콘 파일명은 서비스명과 정확히 일치해야 함 (공백·대소문자 포함) — §4 스크립트가 자동으로 서비스명 그대로 저장하므로 수동 리네임은 보통 불필요
- `(업데이트)/미분류/` 폴더: classify-local이 못 맞춘 항목. API 키가 있으면 자동으로, 없으면 Claude에게 직접 보여주고 판별 요청 가능
- `.last-upload` 파일: prepare-upload 기준일 기록. 이전 배치를 재업로드하려면 삭제 후 재실행 — **삭제 전 반드시 §5의 "서버 동기화 상태 확인" 스크립트로 마지막 실제 반영일을 먼저 확인할 것** (기준이 없어지면 upload-list.txt 전체 이력을 통째로 신규로 간주해 매우 오래 걸릴 수 있음)
- **`.bat` 파일은 반드시 CRLF(Windows) 줄바꿈으로 저장되어야 한다.** LF만 있으면 `chcp 65001`과 맞물려 실행되자마자 알 수 없는 명령 오류를 내며 아무 동작도 하지 않는다. `.bat`을 스크립트로 새로 만들거나 수정했다면 CRLF가 유지됐는지 반드시 확인할 것
- 신규 서비스의 업종(SVC_TYPES)은 API 키 없이 오프라인으로 자동 채워진다(반대편 사이트 재사용 → 키워드 사전, §3). 둘 다 실패한 서비스만 사이드바에 `미분류`로 남으며 — 기능 오류가 아님 — 그 사이트의 `SVC_TYPES` 블록에 `'서비스명':'업종'`을 직접 추가하거나 `update-index.js`의 `TYPE_KEYWORDS`에 키워드를 보강하면 다음 실행부터 자동 분류된다
- 이 작업 폴더는 기본적으로 파일 삭제·이름변경이 제한된 환경이지만, 필요 시 명시적으로 삭제 권한을 요청할 수 있다. 자동화 스크립트를 설계할 때는 가능하면 삭제에 의존하지 않는 덮어쓰기 기반으로 만들 것 — `.update.lock`이 그 예시 패턴
- mo/web 카테고리 폴더명에 쓰이는 가운뎃점류 문자가 사이트마다 다를 수 있으니, 폴더를 복사/이동할 때 문자가 깨지지 않는지 확인할 것
- **파일명 유니코드 정규화(NFD/NFC) 불일치** — 로컬은 정상인데 서버에서만 이미지가 안 보이는 경우, 파일명이 한글 자모가 분리된 NFD로 저장됐을 가능성이 크다. Windows 로컬은 NFD/NFC 차이를 관대하게 처리하지만 서버(Linux)는 바이트 단위로 비교해 404가 뜬다. 브라우저 콘솔에서 `DATA.filter(d => d.path.normalize('NFC') !== d.path)`로 확인 가능. 해결은 로컬 실제 파일명을 NFC로 rename 후 `update.bat`으로 DATA 재생성 + 재업로드
- **`index.html`이 통째로 손상(잘림/중복)되는 사고가 반복적으로 있었다.** `restore-backup.bat`의 복사 명령에 `/y`가 없어 덮어쓰기 확인 프롬프트가 콘솔 리다이렉트에 가려진 채 멈추면서 파일이 수백 MB로 부풀거나 중간에 잘리는 사고가 2026-07-09에 있었고, 지금은 수정되었다. 사이트가 흰 화면이거나 콘솔에 JS 에러가 뜨면: 먼저 `backups/` 폴더에서 가장 최근의 정상 백업(`</html>`로 제대로 끝나는 것)을 찾아 `restore-backup.bat`으로 복원할 것
- **(대용량 파일 다루는 세션 참고)** 이 작업 폴더를 다루는 실행 환경의 브릿지(마운트)는 수 MB급 대용량 파일(특히 `mo/index.html`, `web/index.html`)에 한해 실제 최신 상태보다 뒤처진 캐시본을 보여주는 현상이 있었다. 이런 파일의 읽기·쓰기 검증은 셸(bash 등)이 아니라 파일 도구(Read/Write/Edit, 사용자 실제 파일 기준)로 할 것. 파일 전체를 복사·재작성해야 하는 작업(백업·복원 등)은 가능하면 사용자에게 해당 `.bat`을 직접 실행해달라고 요청할 것

---

## 11. 현황

정확한 최신 수치는 각 사이트 `stats.json`(`classify-local.bat`/`update.bat` 실행마다 자동 갱신)을 확인할 것. 대략적인 규모는 mo 5만 장·515개 서비스·56개 카테고리, web 1.4만 장 이상·200개 이상 서비스·56개 이상 카테고리 수준이며 계속 늘어난다.

**2026-07-09 작업 요약**
- 서버→로컬 대량 동기화 과정에서 mo/web `index.html`이 손상(내용 중복·잘림)된 것을 발견, `restore-backup.bat`의 `/y` 누락 버그를 고치고 정상 복원 완료
- mo/web 스크립트 불일치(구버전 `classify-local.js`/`prepare-upload.js`, `search-index.js` 누락 등) 확인 후 최신 버전으로 동기화
- 통합검색(§6, §7)이 mo/web 양쪽에서 정상 동작하도록 `search-index.js` 자동 생성 로직을 `update-index.js`에 추가
- 운영 방식을 3단계(수집 → 적재 → `classify-local.bat` 1회 실행)로 단순화. 이에 따라 `classify.js`/`classify.bat`(AI Vision 전용 분류 — classify-local에 이미 통합됨), `dedup.js`/`dedup.bat`, `watch.js`/`watch-start.vbs`/`watch-stop.bat`, `clear-upload.js`/`clear-upload.bat`(prepare-upload가 매번 자체적으로 폴더를 비우고 다시 채우므로 불필요)를 mo/web에서 모두 제거
- F12 콘솔 수집 스크립트를 아이콘+스크린샷 통합 버전으로 교체 (§4) — 서비스 페이지 하나에서 한 번에 수집. `classify-local.js`도 서비스 폴더 안에 섞여 들어온 아이콘 파일을 자동으로 구분해 `icons/`로 편입하도록 수정

**2026-07-10 작업 요약** (mo/web 공통, index.html UX/디자인만 수정 — DATA·이미지 변경 없음)
- 필터(패턴 선택) 모드의 서비스 헤더를 클릭 가능하게 해 그 서비스 디테일 뷰로 이동하도록 추가 (§7)
- 패턴/업종 필터 토글 시 화면을 최상단으로 즉시 스크롤(`behavior:'auto'`)하도록 추가 — 추가 선택·해제 모두 최상위부터 표시 (§7)
- 칩 줄 맨 오른쪽에 "초기화"(전체 해제) 버튼 `clearFilters()` 추가 (§7)
- 버튼·칩 디자인 시스템 점검 후 아웃라인/고스트/채움/탭 4개 계열로 정리, 불일치(초기화 칩 배경·글자, 라이트박스 버튼 테두리 누락, 모바일 탭 호버 색) 통일 (§8)
- 코드만 바뀐 배포이므로 `prepare-upload.bat`이 신규 이미지 없이도 `index.html`을 항상 포함(§3 기존 동작)해 서버 반영됨

날짜별 배치는 각 사이트의 `upload-list.txt`에서 확인.
