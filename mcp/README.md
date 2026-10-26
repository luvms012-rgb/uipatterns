# UI Patterns MCP 검색 서버

Claude 에게 "바텀시트에 '선택 안 함' 버튼 있는 화면 찾아줘"처럼 물으면 UI Patterns 화면을 찾아주는 서버입니다 (uibowl 의 "AI에 유아이볼 데이터 연결하기"와 같은 개념). 읽기 전용입니다.

| 도구 | 하는 일 |
|---|---|
| `search_screens` | 화면 속 글자(OCR)·글자 위치(위/가운데/아래)·카테고리·패턴 그룹·서비스·업종으로 화면 찾기 |
| `list_filters` | 카테고리·업종·서비스 이름 목록 (이름이 정확하지 않을 때) |
| `service_overview` | 서비스 1~4개의 화면 구성과 예시 화면 — 서비스 비교 |
| `get_screen` | 화면 1장의 전체 글자와 위치 — 결과 확인용 |

결과마다 이미지 주소(회사 서버)와 사이트 링크(`mo/#svc=서비스명`)를 줍니다. 서버는 회사 서버에 요청하지 않습니다.

## 구조

```
search/ocr.ps1 · run-ocr.bat   화면 글자 추출 (Windows 내장 OCR, 무료) → search/ocr/{mo,web}/*.jsonl
search/build-index.js          data.js + 업종 + 패턴 그룹 + OCR → search/dist/uipatterns.sql (D1용) · uipatterns.db (로컬)
mcp/src/tools.js               검색 도구 (D1·로컬 공용)
mcp/src/worker.js              원격 서버 (Cloudflare Worker + D1) — 팀원용
mcp/local.mjs                  로컬 서버 (stdio) — 이 PC에서 바로 쓰기·시험용
```

- 글자 검색은 화면 글자를 두 글자씩 잘라 넣은 전문 검색 색인(SQLite FTS5)으로 찾습니다. 띄어쓰기·기호·대소문자는 무시하고, 위치 조건도 색인에서 바로 찾습니다.
- Cloudflare 무료 요금(Worker 계산 요청당 10ms, D1 하루 읽기 500만 행) 안에서 돌도록 만들었습니다. 로컬 측정: 계산 2~15ms, 첫 요청이 한도 근처일 수 있음 → 배포 후 오류(1102)가 잦으면 Workers 유료($5/월)로.
- `search/dist/` 는 저장소에 올리지 않습니다 (.gitignore). D1 에만 올립니다.

## 검색 데이터 만들기 (회사 PC)

```bash
search/run-ocr.bat          # 새 이미지의 글자 추출 (이미 한 화면은 건너뜀)
node search/build-index.js  # search/dist/ 생성 (Node 22.12 이상)
```

## 이 PC에서 바로 쓰기 (로컬)

Claude Code:
```bash
claude mcp add uipatterns -- node C:/Users/luvms/Desktop/works/uipatterns/mcp/local.mjs
```

## 팀원용 원격 서버 (처음 한 번)

1. Cloudflare 가입 (무료) — 이미지 중계(`worker/`)와 같은 계정
2. `mcp/` 폴더에서
   ```bash
   npx wrangler login
   npx wrangler d1 create uipatterns
   ```
   나온 `database_id` 를 `mcp/wrangler.toml` 에 넣기
3. 검색 데이터 올리기 + 서버 배포
   ```bash
   npx wrangler d1 execute uipatterns --remote --file ../search/dist/uipatterns.sql
   npx wrangler deploy
   ```
   → 주소 `https://uipatterns-mcp.<계정>.workers.dev/mcp`
4. 팀원: Claude 설정 → 커넥터 → 사용자 지정 커넥터 추가 → 위 주소

이미지를 추가한 뒤에는 OCR → `build-index.js` → 3번의 `d1 execute` 만 다시 하면 됩니다 (서버 코드는 그대로).

## 아직 없는 것

- 컴포넌트 검색 — 캡처 때 uibowl 의 이미지별 컴포넌트를 저장해야 함 (HANDOFF §3-4). 그 전엔 글자 + 위치로 근사
- 비슷한 화면 검색 (이미지 임베딩)
- 사이트에서 화면 1장으로 바로 가는 링크 (`#img=`) — 지금은 서비스 화면 목록으로 연결
