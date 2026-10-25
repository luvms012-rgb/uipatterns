# 자연어 검색 + GitHub 운영 — 진행 상황 (2026-10-23 중단)

목표: "바텀시트에 '선택 안 함' 버튼이 있는 UI 찾아줘" 같은 질문을 Claude 프롬프트로 처리하고,
uipatterns 를 GitHub 비공개 저장소(luvms012-rgb/uipatterns)로 운영. 이미지는 회사 서버에만 둔다.

## 방식
- 화면 텍스트: Windows 내장 OCR(한국어, 무료·오프라인)로 전 화면 텍스트+세로 위치(y 0~1000)를 뽑아 `search/ocr/{mo|web}/w*.jsonl` 에 저장
- 검색: `search/find.js` 로 카테고리·서비스·업종·패턴명·텍스트·위치(top/bottom) 조건 검색
- 확인: 후보를 `search/montage.ps1` 몽타주로 묶어 Claude 가 실제 화면을 보고 거른다 (바텀시트 여부, 재고 부족 표현 등)
- 비교/페르소나/유사 이미지: Claude 가 find.js 통계 + 대표 화면 몽타주로 판단 (첨부 이미지는 Claude 가 보고 카테고리·텍스트 조건으로 바꿔 검색)

## 완료
- `search/ocr.ps1` (작업자 1개, 이어하기 지원, `-Minutes` 시간 제한), `search/run-ocr.ps1` / `run-ocr.bat` (작업자 12개 동시)
- OCR 1차 실행: 2026-10-23 58분 제한으로 실행 (작업자 12개, 처음 5분 약 7,300장). 중간 확인 시점 mo 14,975장 / web 9장 완료 — 작업자는 mo → web 순서라 web 은 거의 남아 있음. 남은 건 `run-ocr.bat` 다시 실행하면 이어서 처리 (처리 수 확인: `search/ocr/{mo|web}/*.jsonl` 줄 수 합계, 전체 대상 mo 57,263 / web 약 26,700)
- `search/find.js` 초안, `search/montage.ps1` 초안 (`--html` 결과 페이지, `--montage` 몽타주)

## 다음 할 일
1. find.js 버그: OCR 결과 줄이 1개뿐인 화면은 PowerShell ConvertTo-Json 이 `l` 을 펼쳐 저장해 `r.ocr.l.map` 에서 오류 → 읽을 때 형식 보정 (ocr.ps1 도 `-InputObject` 로 저장하도록 수정)
2. montage.ps1 실제 실행 확인
3. `uipatterns/CLAUDE.md` + `.claude/skills/uipatterns-search/SKILL.md` — 질문 유형별 검색 절차
4. `.gitignore` (png/jpg·icons·backups·(업데이트)·(업로드)·로그·zip·.tools·search/results·search/ocr/logs), `git init`, 첫 커밋
5. GitHub 웹에서 비공개 빈 저장소 `uipatterns` 생성(사용자) → remote 연결·푸시
6. 예시 질문 6개로 검증, GUIDE.md 에 검색·저장소 절 추가 (GUIDE 의 작업 폴더 경로 `Desktop\ing` → `Desktop\works` 로 고칠 것)
- 참고: `mo/backups/classify-local_v2_20260820.js` 에 `sk-ant` 문자열이 있음 — backups 는 git 제외라 올라가지 않지만 내용 확인 필요
