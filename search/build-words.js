/**
 * build-words.js — 사이트 검색용 "화면 속 글자" 색인 (2026-10-30)
 *
 * search/ocr/{site}/*.jsonl (회사 PC 의 Windows OCR 결과) → {site}/words.js
 * 사이트 검색창이 "품절", "더보기", "선택 안 함" 같은 화면 속 글자로도 찾게 한다.
 * 전체 글자(검색 데이터 160MB)는 그대로 회사 PC 에 두고, 여기선 낱말 → 화면 목록만 작게 만든다.
 *
 *   낱말 = OCR 한 줄을 띄어쓰기로 나눈 것 + 짧은 줄(12자 이하)은 줄 전체 ("선택 안 함" 같은 버튼 글자)
 *   글자 비교 규칙은 검색 서버와 같은 norm (mcp/src/text.js: 띄어쓰기·기호·대소문자 무시, i/l 같게)
 *   빼는 것: 숫자만 있는 것(가격·시간·전화번호), 메일 주소, 한 글자, 21자 이상, 화면 1장에만 나오는 낱말(파일 크기 - 대부분 OCR 오타·고유한 글),
 *            화면 25% 넘게 나오는 낱말(상태 표시줄 등)
 *
 * 형식: window.__WORDS__ = { v, n, first, last, screens, w: "낱말|낱말|…", p: "번호목록|번호목록|…" }
 *   번호 = data.js 의 DATA 순서(0부터). 번호목록 = 앞 번호와의 차이를 36진수로, 쉼표로 이음
 *   n/first/last 로 data.js 와 짝이 맞는지 사이트가 확인한다 (안 맞으면 글자 검색만 쉰다)
 *
 * 사용: node search/build-words.js [--ocr <폴더>] [--out <폴더>]   (업데이트.bat 이 데이터 갱신 뒤 부른다)
 */
const fs = require('fs');
const path = require('path');
const { norm } = require('../mcp/src/text.js');   // ESM — Node 22.12+ 는 require 가능 (build-index.js 와 같음)

const REPO = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OCR_DIR = arg('--ocr', path.join(__dirname, 'ocr'));
const OUT_DIR = arg('--out', REPO);
const MAX_SHARE = 0.25, MIN_SCREENS = 2, SHORT_LINE = 12, MAX_LEN = 20;

function readData(site) {
  const src = fs.readFileSync(path.join(OUT_DIR, site, 'data.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('[', src.indexOf('const DATA')), src.lastIndexOf(']') + 1));
}
function loadOcr(site) {   // build-index.js 의 loadOcr 와 같음
  const map = new Map();
  const dir = path.join(OCR_DIR, site);
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
    for (const row of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!row.trim()) continue;
      let r;
      try { r = JSON.parse(row); } catch { continue; }   // OCR 가 쓰는 중인 마지막 줄
      if (Array.isArray(r.l)) map.set(r.p.normalize('NFC'), r.l);
    }
  }
  return map;
}
const ok = n => n.length >= 2 && n.length <= MAX_LEN && !/^\d+$/.test(n);

for (const site of ['mo', 'web']) {
  if (!fs.existsSync(path.join(OUT_DIR, site, 'data.js'))) continue;
  const D = readData(site);
  const ocr = loadOcr(site);
  if (!ocr.size) { console.log(`  ${site}: 화면 글자(OCR) 없음 — words.js 를 만들지 않음`); continue; }

  const post = new Map();   // 낱말 → 화면 번호 목록 (번호 순)
  let screens = 0;
  D.forEach((item, i) => {
    if (item.category === 'icons') return;
    const lines = ocr.get(String(item.path).normalize('NFC'));
    if (!lines || !lines.length) return;
    screens++;
    const words = new Set();
    for (const [, t] of lines) {
      const parts = String(t || '').split(/\s+/).filter(p => p && !p.includes('@'));
      for (const p of parts) { const n = norm(p); if (ok(n)) words.add(n); }
      const whole = norm(t);
      if (parts.length > 1 && whole.length <= SHORT_LINE && ok(whole)) words.add(whole);
    }
    for (const w of words) { let a = post.get(w); if (!a) post.set(w, a = []); a.push(i); }
  });

  const limit = Math.max(50, Math.floor(screens * MAX_SHARE));
  const vocab = [...post.keys()].filter(w => { const k = post.get(w).length; return k >= MIN_SCREENS && k <= limit; }).sort();
  const common = [...post.values()].filter(a => a.length > limit).length, single = post.size - vocab.length - common;
  const enc = list => { let prev = 0; return list.map(i => { const d = i - prev; prev = i; return d.toString(36); }).join(','); };
  const out = {
    v: 1, n: D.length, first: D[0] && D[0].path, last: D[D.length - 1] && D[D.length - 1].path, screens,
    w: vocab.join('|'), p: vocab.map(w => enc(post.get(w))).join('|'),
  };
  const file = path.join(OUT_DIR, site, 'words.js');
  fs.writeFileSync(file, `// 화면 속 글자 색인 — search/build-words.js 가 만듦. 직접 고치지 말 것\nwindow.__WORDS__ = ${JSON.stringify(out)};\n`, 'utf8');
  const mb = (fs.statSync(file).size / 1048576).toFixed(1);
  console.log(`  ${site}: 글자 있는 화면 ${screens.toLocaleString()}장, 낱말 ${vocab.length.toLocaleString()}개 (한 장에만 있는 말 ${single.toLocaleString()}개, 흔한 말 ${common}개 뺌) → words.js ${mb}MB`);
}
