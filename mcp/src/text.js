// 글자 비교 규칙 — 검색 데이터 생성(search/build-index.js)과 검색 서버가 함께 쓴다. 바꾸면 검색 데이터를 다시 만들 것.

// 띄어쓰기·기호·대소문자를 무시하고, OCR 이 자주 헷갈리는 i/l 을 같게 본다
export const norm = s => String(s ?? '').normalize('NFC').toLowerCase().replace(/i/g, 'l').replace(/[^\p{L}\p{N}]/gu, '');

// 두 글자씩 자른 조각 — 한 글자면 그대로
export function bigrams(n) {
  const c = Array.from(n);
  if (c.length < 2) return c;
  const out = [];
  for (let i = 0; i < c.length - 1; i++) out.push(c[i] + c[i + 1]);
  return out;
}

// 줄과 줄 사이에 넣는 표시 — 두 글자 조각과 겹치지 않는 길이라서 다른 줄 글자가 이어 붙어 검색되지 않는다
export const LINE_SEP = 'linebreakx';

// 화면 세로 위치(0=맨 위 ~ 1000=맨 아래) 구간 — 글자 색인을 구간별 열(z0~z3)에 나눠 넣는다
export const ZONE_COLS = [[0, 350], [350, 550], [550, 650], [650, 1001]];
export const zoneCol = y => ZONE_COLS.findIndex(([a, b]) => y >= a && y < b);
// 검색 조건의 위치 → 열. 가운데와 아래는 550~650 이 겹친다 (바텀시트 위쪽 항목도 '아래'로 잡히게)
export const ZONES = { top: [0], middle: [1, 2], bottom: [2, 3] };

// 카테고리 이름 비교용: 'ㆍ'/'·' 통일, 띄어쓰기 제거
export const catKey = s => String(s ?? '').normalize('NFC').replace(/[ㆍ・·]/g, '·').replace(/\s+/g, '').toLowerCase();
