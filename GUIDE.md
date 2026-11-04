# UI Patterns - 캡처, 분류 파이프라인 (보관 문서)

> **참고용 보관 문서입니다. 지금 작업 기준이 아닙니다.**
> - 2026-11-02 사용자 결정: uibowl 은 구독 회원만 볼 수 있고 사용자는 구독 회원이 아님 → **새 캡처는 하지 않는다** ([CLAUDE.md](CLAUDE.md)). 이 문서의 캡처 단계는 다시 구독하게 될 때를 위한 기록
> - 지금 구조, 사용법: [README.md](README.md) / 상태와 다음 할 일: [HANDOFF.md](HANDOFF.md) / 자연어 검색: [mcp/README.md](mcp/README.md)
> - 2026-10-24 이전 내용(index.html 안의 DATA, 브라우저 콘솔 수집 스크립트, AI 이미지 판정, 사용 현황, `restore-backup.bat`, 예전 디자인 스펙)은 11/02 이 문서에서 지웠다. 필요하면 git 기록의 예전 GUIDE.md 를 본다

## 1. 흐름 한눈에

```
uibowl 서비스 페이지
  → uibowl-capture.js (v5)      카드 정보(카테고리, 화면 이름, 컴포넌트) + 이미지 주소 읽기
  → 내려받기                     브라우저가 아니라 node 가 주소로 직접 (10/28~, 아래 2번)
  → capture-import.js            {mo|web}/(업데이트)/{서비스}/ 로 옮기고 .uibowl.json 기록
  → {mo|web}/classify-local.js   카테고리 폴더로 분류 → 데이터 갱신 → (업로드) 준비 → zip
  → 업데이트.bat                 data.js, 업종, 검색 색인, 색, 글자(OCR) 갱신 → 커밋, 푸시
  → 회사 서버 업로드             사용자가 보안망으로 직접
```

`capture-mo.bat` / `capture-web.bat` 은 `capture-import.js` 와 `classify-local.js` 를 차례로 부르는 묶음이다.

## 2. 캡처 (지금은 안 함)

- `uibowl-capture.js` (v5, 10/26): 모바일 `https://uibowl.io/name/{서비스}`, 웹 `https://uibowl.io/website/name/{서비스}` 페이지에서 실행. 카드마다 uibowl 카테고리(`patternCodeName`), 화면 이름(`patternName`), 컴포넌트(이름, 위치%)를 매니페스트에 적는다. 영상 카드는 가운데 장면을 PNG 로
- **브라우저로 여러 장 내려받지 않는다** (10/28 다운로드 창 폭주로 PC 재부팅). 브라우저는 주소 목록만 읽고, 내려받기는 node, PowerShell 로. 그 뒤 `node capture-import.js --downloads <폴더>` 부터는 그대로
- `capture-import.js`: `UB__..` 파일을 찾아 `{서비스}_{화면이름}_{NNN}_{YYYYMMDD}.png` 로 바꿔 `(업데이트)/{서비스}/` 에 넣는다. 옵션 `--downloads <폴더>`, `--wait <초>`, `--site mo|web`
- `uibowl-components.js`: 이미지는 받지 않고 카드 정보만 읽는 도구 (예전 화면 컴포넌트 채우기용, `scripts/match-components.js` 와 짝). 11/02 사용자 결정으로 이 작업도 건너뜀
- 캡처 스킬 uipatterns-capture 는 claude.ai 계정 쪽에 있다

## 3. 분류 - classify-local.js

`mo/`, `web/` 에 같은 코드가 한 벌씩 있고, 실행한 폴더의 사이트만 처리한다. 두 벌은 늘 똑같이 유지한다. 파일 안에 NUL 문자가 있어 Edit 도구가 거부하니 문자열 치환으로 고친다.

처리 순서:
1. **uibowl 카테고리로 확정**: `.uibowl.json` 이 있으면 그 카테고리로 바로 분류 (가장 우선). 이름이 다른 uibowl 카테고리는 `uibowl-category-map.json` 의 `alias` 로 기존 폴더에 합치고(10/27 사용자 결정), 분류하지 않을 것(앱스토어 홍보 컷 등)은 `skip` → `(업데이트)/_분류제외/`
2. **남겨 둔 결정 반영**: `(업데이트)/미분류/_결정.json` 이 있으면 적용하고 `_결정_적용_YYYYMMDD.json` 으로 보관
3. **아이콘 편입**: 서비스 이름과 같은 파일(`{서비스}.png`) → `icons/` (NFC 로 맞춤)
4. **이름으로 분류**: 화면 이름이 기존 데이터와 같고 그 이름의 70% 넘게 한 카테고리에 몰려 있을 때만 (`NAME_SHARE`). 사용자 규칙 `{site}/pattern-rules.json` 이 있으면 그게 먼저 (`patterns` 정확히 일치, `keywords` 일부 일치)
5. **남은 화면**: `(업데이트)/미분류/{서비스}/` 에 모이고 `_분류요청.md` 가 생긴다. Claude 에게 보여 주고 `_결정.json` 을 받아 다시 실행
6. 데이터 갱신(`update-index.js`) → 업로드 준비(`prepare-upload.js`) → 새 아이콘을 `(업로드)/icons/` 로 → 실제로 담겼는지 대조

- **분류하며 파일 이름 번호를 다시 매긴다** → 가져온 뒤엔 이름으로 짝을 맞추면 안 된다
- 파일 이름이 규격에서 조금 벗어나도(번호 자릿수, 날짜 없음, `(1)` 중복본, 앞뒤 공백, NFD) `pattern-classify.js` 가 살려 낸다. 같은 이름이 있으면 번호를 밀고, 내용이 같은 파일은 버린다
- `(업데이트)` 안에서 `_` 로 시작하는 폴더는 분류하지 않는다 (보류용)
- 옵션: `DRY_RUN=1` (옮기지 않고 결과만), `NAME_SHARE` (기본 0.7), `GUESS_AUTO=1` (이름 추정도 자동 분류에, 정확도 약 35%라 비권장)
- 코드에 API 키로 이미지를 판정하는 단계가 남아 있지만 **쓰지 않는다** (결정사항: Anthropic API 크레딧 안 씀). 키 파일을 두지 않으면 자동으로 건너뛴다

## 4. 데이터 갱신 - scripts/update-index.js

`업데이트.bat` 과 `classify-local.js` 가 부른다 (`mo/update-index.js` 는 예전 명령 호환용).
- 이미지 폴더를 훑어 `{site}/data.js`, `svc-types.js`, `icons.js`, `search-index.js`, `stats.js`, `version.js`, `upload-list.txt` 를 만든다. `components.json`, `colors.json` 은 줄마다 합친다
- **새 서비스 업종**은 키 없이 자동으로: ① 반대편 사이트(mo/web)에 같은 서비스가 있으면 그 업종 ② `TYPE_KEYWORDS` 사전 ③ 둘 다 안 되면 미분류. 그 사이트 `ALL_INDUSTRY_TYPES` 에 있는 업종만 쓴다. 틀리면 `svc-types.js` 를 직접 고쳐도 된다
- 파일 이름은 NFC, 정렬은 문자 코드 순. 동시 실행은 `.update.lock` 으로 막는다

## 5. 업로드 준비 - prepare-upload.js, zip-upload.js

- `prepare-upload.js`: `upload-list.txt` 에서 아직 안 담은 새 이미지만 `(업로드)/` 에 카테고리 구조 그대로 복사. 담은 파일은 `.last-upload` 에 한 줄씩 기록 (지우면 전체를 다시 담음). 로그 `prepare-upload-debug.log`
- `(업로드)/` 를 비우고 다시 담기 때문에 분류 때 넣은 아이콘이 지워질 수 있다 → zip 전에 `(업로드)/icons/` 확인
- `zip-upload.js`: `(업로드)/` 를 95MB 이하 zip 여러 개로, 저장소 바로 아래 `(서버업로드)/` 에 (`mo_YYYYMMDD.zip`, 여러 개면 `_1`, `_2`). 하나씩 따로 풀리고, **이미지만** 담는다. 옵션 `--site mo|web`, `--limit 95`
- 사이트 파일 zip 은 따로 `node scripts/pack-site.js` (10/29~)
- **서버용 zip 은 사용자가 서버에 올린다고 할 때만 만든다** (10/29 사용자 결정)

## 6. 주의 (겪은 것)

- 파일 이름에 `+` 가 있으면 회사 서버가 404. 가운뎃점류 문자는 `-` 로
- 로컬은 되는데 서버에서만 이미지가 안 뜨면 파일 이름이 NFD 일 가능성 → NFC 로 바꾸고 데이터 다시 만들기
- 서버 index.html 목록은 "올라간 이미지" 증거가 아니다 → 이미지 몇 장만 HEAD 로 크기 비교 (웹방화벽 때문에 천천히, 소량)
- `.bat` 은 CRLF 로 저장해야 한다 (LF 면 `chcp 65001` 과 맞물려 아무것도 안 함)
- Node 24 `fs.rmSync` 는 한글 경로에서 메시지 없이 죽는다 → `unlinkSync`/`rmdirSync`
- 이미지 폴더는 Bash 로 대량 읽으면 느리다 → PowerShell
