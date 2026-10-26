'use strict';

/**
 * pattern-classify.js — UI 패턴 파일명 → 카테고리 분류 엔진 (공용 모듈)
 *
 * classify-local.js 가 사용한다. mo/ web/ 어느 쪽에서든 그 폴더의 data.js DATA를
 * 학습 데이터로 삼으므로 카테고리 체계가 달라도 그대로 동작한다.
 *
 * 분류 단계 (위에서부터, 먼저 맞는 것이 이김)
 *   0) 사용자 규칙   pattern-rules.json 의 patterns(정확일치) / keywords(부분일치)
 *   1) 정확 일치     기존 DATA에 똑같은 패턴명이 있음
 *   2) 정규화 일치   공백·기호·대소문자·유니코드 정규화(NFC) 차이만 있는 경우
 *   3) 이웃 추정     비슷한 기존 패턴명들의 카테고리로 투표 (실측 top1 35% — 참고용)
 *   4) 미분류        3)의 확신도가 임계치 미만
 *
 * 재작업의 근본 원인이던 "정확 일치만 분류" 문제를 2)3)이 흡수한다.
 */

const fs = require('fs');
const path = require('path');

const IMG_EXTS = /\.(png|jpg|jpeg|webp|gif|bmp)$/i;

// ─── 문자열 유틸 ────────────────────────────────────────────────────────────
// 윈도우/브라우저/맥에서 내려받은 한글 파일명은 NFC/NFD가 섞인다. 전부 NFC로 통일.
const SEP_CLASS = "[\\s_\\-\\u2013\\u2014\\u00b7\\u318d\\u30fb,./\\\\()\\[\\]{}!?&+:;'\"~@#$%^*=|<>]";
const SEP = new RegExp(SEP_CLASS + '+');

function nfc(s) { return (s == null ? '' : String(s)).normalize('NFC'); }

function normKey(s) {
  return nfc(s).toLowerCase().replace(new RegExp(SEP_CLASS, 'g'), '');
}

function tokenize(s) {
  const t = nfc(s).toLowerCase();
  const words = t.split(SEP).filter(Boolean);
  const out = [];
  for (const w0 of words) {
    const w = w0.replace(/\d+/g, '#');
    if (!w) continue;
    out.push('w:' + w);
    if (/[가-힣]/.test(w)) {
      for (let i = 0; i + 2 <= w.length; i++) out.push('b:' + w.slice(i, i + 2));
      for (let i = 0; i + 3 <= w.length; i++) out.push('t:' + w.slice(i, i + 3));
    } else if (w.length >= 4) {
      for (let i = 0; i + 3 <= w.length; i++) out.push('e:' + w.slice(i, i + 3));
    }
  }
  return out;
}

// ─── 파일명 파서 (관대) ──────────────────────────────────────────────────────
// 규격: {서비스}_{패턴}_{번호3자리}_{YYYYMMDD}.png
// 실제로는 아래가 전부 들어온다 → 모두 살려낸다.
//   플랭_메인_1_20260820.png        (번호 자릿수 부족)
//   플랭_메인_20260820.png          (번호 없음)
//   플랭_메인.png                   (번호·날짜 없음)
//   플랭_메인_001_20260820 (1).png  (중복 다운로드본)
//   메인_001_20260820.png           (서비스명 없음 → 폴더명 사용)
//   Screenshot_2026-08-20_11-20-33.png (의미 없는 이름 → 패턴 없음)
function parseFilename(filename, svcFolderName) {
  const raw = nfc(filename);
  let base = raw.replace(IMG_EXTS, '');

  // 중복 다운로드 접미사 제거: "이름 (1)", "이름 - 복사본", "이름 복사본 (2)"
  let dup = false;
  const dupRe = /(\s*[-–]?\s*(복사본|copy)\s*)?(\s*\(\s*\d+\s*\))?\s*$/i;
  const stripped = base.replace(dupRe, function (m) { if (m && m.trim()) dup = true; return ''; });
  if (stripped) base = stripped;

  base = base.trim();
  const svcNorm = normKey(svcFolderName || '');

  let parts = base.split('_').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  if (!parts.length) return { svc: svcFolderName, pattern: '', date: null, dup: dup, raw: raw };

  // 뒤에서부터 날짜 / 번호 벗겨내기
  let date = null;
  const lastP = parts[parts.length - 1];
  if (/^\d{8}$/.test(lastP)) { date = lastP; parts.pop(); }
  else if (/^\d{4}[-.]?\d{2}[-.]?\d{2}$/.test(lastP)) { date = lastP.replace(/[-.]/g, ''); parts.pop(); }

  if (parts.length > 1 && /^\d{1,4}$/.test(parts[parts.length - 1])) parts.pop();

  // 앞의 서비스명 토큰 제거 (폴더명과 같을 때만). 남는 게 서비스명뿐이면 패턴명 없음으로 본다.
  if (parts.length === 1 && normKey(parts[0]) === svcNorm) parts.shift();
  else if (parts.length > 1 && normKey(parts[0]) === svcNorm) parts.shift();
  else if (parts.length > 1 && svcNorm && normKey(parts[0]).indexOf(svcNorm) === 0 && normKey(parts[0]).length <= svcNorm.length + 2) parts.shift();

  let pattern = parts.join('_').trim();

  // 스크린샷 자동생성 이름 등 의미 없는 패턴은 버린다
  if (isMeaningless(pattern)) pattern = '';

  return { svc: svcFolderName, pattern: pattern, date: date, dup: dup, raw: raw };
}

const MEANINGLESS = /^(screenshot|screen shot|스크린샷|image|img|photo|캡처|캡쳐|화면[\s_-]*캡[처쳐]?|kakaotalk|스크린샷?\s*\d*)([\s_\-0-9.:]*)$/i;
function isMeaningless(p) {
  const s = nfc(p).trim();
  if (!s) return true;
  if (/^[\d\s_\-.:()]+$/.test(s)) return true;      // 숫자/기호만
  if (MEANINGLESS.test(s)) return true;
  return false;
}

// ─── DATA 로딩 ──────────────────────────────────────────────────────────────
// data.js (예전엔 index.html) 의 __DATA_START__ ~ __DATA_END__ 사이 DATA 배열
function loadData(dataFile) {
  const html = fs.readFileSync(dataFile, 'utf-8');
  const s = html.indexOf('// __DATA_START__');
  const e = html.indexOf('// __DATA_END__');
  if (s === -1 || e === -1) throw new Error('DATA 마커를 찾을 수 없습니다.');
  const m = html.slice(s, e).match(/const DATA\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error('DATA 배열을 파싱할 수 없습니다.');
  return JSON.parse(m[1]);
}

// DATA 항목 이름에서 (서비스, 패턴) 뽑기 — 저장된 이름은 규격을 지키므로 엄격하게 봐도 된다
function parseDataName(name) {
  const parts = nfc(name).split('_');
  if (parts.length < 3) return null;
  const date = parts[parts.length - 1];
  const num = parts[parts.length - 2];
  if (!/^\d{8}$/.test(date) || !/^\d{1,4}$/.test(num)) return null;
  return { svc: parts[0], pattern: parts.slice(1, -2).join('_') };
}

// ─── 모델 학습 ──────────────────────────────────────────────────────────────
/**
 * @param {Array} DATA        data.js의 DATA 배열
 * @param {Array} categories  현재 존재하는 카테고리 폴더명
 * @param {Object} opts       { excludePatterns: Set }  (홀드아웃 테스트용)
 */
function buildModel(DATA, categories, opts) {
  opts = opts || {};
  const exclude = opts.excludePatterns || null;

  const catSet = new Set(categories.map(nfc));
  const exactCount = new Map();   // pattern -> Map(cat -> n)
  const normCount = new Map();    // normKey -> Map(cat -> n)
  const tokCount = new Map();     // token -> Map(cat -> n)
  const catTotal = new Map();     // cat -> 토큰 총량
  const catDocs = new Map();      // cat -> 문서 수
  const tokDocFreq = new Map();   // token -> 등장한 (패턴,카테고리) 문서 수

  function bump(map, key, cat, n) {
    let m = map.get(key);
    if (!m) { m = new Map(); map.set(key, m); }
    m.set(cat, (m.get(cat) || 0) + n);
  }

  // (패턴, 카테고리) 단위로 묶어 가중치를 log 스케일로 → 대형 서비스 편향 완화
  const pairCount = new Map(); // pattern\u0000cat -> n
  for (const it of DATA) {
    const cat = nfc(it.category);
    if (cat === 'icons' || !catSet.has(cat)) continue;
    const p = parseDataName(it.name);
    if (!p || !p.pattern) continue;
    const pat = nfc(p.pattern);
    if (isMeaningless(pat)) continue;
    if (exclude && exclude.has(normKey(pat))) continue;
    const k = pat + '\u0000' + cat;
    pairCount.set(k, (pairCount.get(k) || 0) + 1);
  }

  for (const [k, n] of pairCount) {
    const idx = k.indexOf('\u0000');
    const pat = k.slice(0, idx), cat = k.slice(idx + 1);
    const w = 1 + Math.log(n);           // 등장 횟수는 log로 반영

    bump(exactCount, pat, cat, n);
    bump(normCount, normKey(pat), cat, n);

    const toks = tokenize(pat);
    const uniq = new Set(toks);
    for (const t of uniq) {
      bump(tokCount, t, cat, w);
      catTotal.set(cat, (catTotal.get(cat) || 0) + w);
      tokDocFreq.set(t, (tokDocFreq.get(t) || 0) + 1);
    }
    catDocs.set(cat, (catDocs.get(cat) || 0) + 1);
  }

  // 같은 패턴명이 여러 카테고리에 걸쳐 있으면(예: '메인' → 필터 33% / 검색 21% / 간편결제 13%)
  // 이름만으로 정할 수 없다. 최다 카테고리의 점유율(share)을 함께 보관해 호출부가 판단하게 한다.
  function majority(m) {
    let best = null, bn = -1, tot = 0;
    for (const [c, n] of m) { tot += n; if (n > bn) { bn = n; best = c; } }
    return { category: best, share: tot ? bn / tot : 0, total: tot };
  }
  const exactMap = new Map(); for (const [k, m] of exactCount) exactMap.set(k, majority(m));
  const normMap = new Map(); for (const [k, m] of normCount) normMap.set(k, majority(m));

  // 카테고리명 별칭 (ㆍ · 로 나뉜 복합 카테고리는 각각도 별칭)
  const aliases = []; // {alias(normKey), category}
  for (const c of catSet) {
    aliases.push({ a: normKey(c), c: c });
    for (const part of nfc(c).split(/[ㆍ·・/]/)) {
      const k = normKey(part);
      if (k.length >= 2 && k !== normKey(c)) aliases.push({ a: k, c: c });
    }
  }

  const totalDocs = Array.from(catDocs.values()).reduce(function (a, b) { return a + b; }, 0) || 1;

  // ── 최근접 이웃 검색용 인덱스 (tf-idf 코사인) ──────────────────────────────
  // 문서 = (패턴명, 카테고리) 쌍. 카테고리명 자체도 가상 문서로 넣어 신규 카테고리도 잡히게 한다.
  const docs = [];               // {pattern, cat, weight, toks:[], norm}
  for (const [k, n] of pairCount) {
    const idx = k.indexOf('\u0000');
    docs.push({ pattern: k.slice(0, idx), cat: k.slice(idx + 1), weight: 1 + Math.log(n), toks: null, norm: 0 });
  }
  for (const c of catSet) {
    docs.push({ pattern: nfc(c), cat: c, weight: 1.5, toks: null, norm: 0 });
    for (const part of nfc(c).split(/[ㆍ·・/]/)) {
      const p = part.trim();
      if (p && normKey(p) !== normKey(c)) docs.push({ pattern: p, cat: c, weight: 1.2, toks: null, norm: 0 });
    }
  }

  const df = new Map();
  const docToks = docs.map(function (d) {
    const t = Array.from(new Set(tokenize(d.pattern)));
    for (const x of t) df.set(x, (df.get(x) || 0) + 1);
    return t;
  });
  const N = docs.length || 1;
  const idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log((N + 1) / (n + 0.5)));

  const inverted = new Map(); // token -> [docIdx]
  for (let i = 0; i < docs.length; i++) {
    const t = docToks[i];
    let sq = 0;
    for (const x of t) { const w = idf.get(x); sq += w * w; }
    docs[i].toks = t;
    docs[i].norm = Math.sqrt(sq) || 1;
    for (const x of t) {
      let a = inverted.get(x);
      if (!a) { a = []; inverted.set(x, a); }
      a.push(i);
    }
  }

  return {
    categories: Array.from(catSet),
    exactMap: exactMap, normMap: normMap,
    tokCount: tokCount, catTotal: catTotal, catDocs: catDocs,
    tokDocFreq: tokDocFreq, totalDocs: totalDocs,
    aliases: aliases,
    vocab: tokCount.size || 1,
    docs: docs, inverted: inverted, idf: idf,
    shareThreshold: opts.shareThreshold !== undefined ? opts.shareThreshold : 0.7,
  };
}

// ─── 최근접 이웃 기반 추정 ───────────────────────────────────────────────────
// 새 패턴명과 "가장 비슷한 기존 패턴명들"을 찾아 그들의 카테고리로 투표한다.
// 나이브베이즈보다 오분류가 적고, 유사도 자체가 신뢰도 신호로 쓸 수 있다.
const KNN_K = 12;
const MIN_SIM = 0.28;

function knnScore(model, pattern) {
  const toks = Array.from(new Set(tokenize(pattern)));
  if (!toks.length) return { top: [], confidence: 0, sim: 0, neighbors: [] };

  let qsq = 0;
  const qw = new Map();
  for (const t of toks) {
    const w = model.idf.get(t);
    if (w === undefined) continue;
    qw.set(t, w);
    qsq += w * w;
  }
  if (!qw.size) return { top: [], confidence: 0, sim: 0, neighbors: [] };
  const qnorm = Math.sqrt(qsq);

  const acc = new Map(); // docIdx -> dot
  for (const [t, w] of qw) {
    const list = model.inverted.get(t);
    if (!list) continue;
    if (list.length > 4000) continue;            // 너무 흔한 토큰은 후보 폭발 방지
    for (const i of list) acc.set(i, (acc.get(i) || 0) + w * model.idf.get(t));
  }
  if (!acc.size) return { top: [], confidence: 0, sim: 0, neighbors: [] };

  const cand = [];
  for (const [i, dot] of acc) {
    const d = model.docs[i];
    const sim = dot / (qnorm * d.norm);
    if (sim >= MIN_SIM) cand.push({ i: i, sim: sim, cat: d.cat, pattern: d.pattern, w: d.weight });
  }
  if (!cand.length) return { top: [], confidence: 0, sim: 0, neighbors: [] };

  cand.sort(function (a, b) { return b.sim - a.sim; });
  const near = cand.slice(0, KNN_K);

  const vote = new Map();
  let totalV = 0;
  for (const c of near) {
    const v = Math.pow(c.sim, 3) * (1 + 0.35 * Math.log(1 + c.w));
    vote.set(c.cat, (vote.get(c.cat) || 0) + v);
    totalV += v;
  }
  const arr = Array.from(vote.entries()).sort(function (a, b) { return b[1] - a[1]; });
  const top = arr.slice(0, 3).map(function (e) { return { category: e[0], p: e[1] / totalV }; });
  return {
    top: top,
    confidence: top[0].p,
    sim: near[0].sim,
    neighbors: near.slice(0, 5).map(function (c) { return c.pattern + '→' + c.cat + '(' + c.sim.toFixed(2) + ')'; }),
  };
}

// ─── 통계 추정 (나이브베이즈 + IDF 가중 + 카테고리명 보정) ────────────────────
function nbScore(model, pattern) {
  const toks = Array.from(new Set(tokenize(pattern)));
  const scores = new Map();
  const ALPHA = 0.12;

  let seen = 0;
  for (const t of toks) if (model.tokCount.has(t)) seen++;

  for (const c of model.categories) {
    const docs = model.catDocs.get(c) || 0;
    let s = Math.log((docs + 1) / (model.totalDocs + model.categories.length)) * 0.6; // 사전확률 약하게
    const tot = model.catTotal.get(c) || 0;
    for (const t of toks) {
      const m = model.tokCount.get(t);
      if (!m) continue;                                  // 처음 보는 토큰은 무시
      const df = model.tokDocFreq.get(t) || 1;
      const idf = Math.log(1 + model.totalDocs / df);    // 흔한 토큰 약화
      const n = m.get(c) || 0;
      s += idf * Math.log((n + ALPHA) / (tot + ALPHA * model.vocab));
    }
    scores.set(c, s);
  }

  // 카테고리명이 패턴에 통째로 들어있으면 가산 (예: "레벨테스트 결과리포트" → 통계ㆍ리포트)
  const pk = normKey(pattern);
  for (const al of model.aliases) {
    if (al.a.length >= 2 && pk.indexOf(al.a) !== -1) {
      const bonus = 2.2 * Math.min(3, al.a.length) / 3;
      scores.set(al.c, (scores.get(al.c) || 0) + bonus * (seen ? 1 : 2));
      if (!seen) seen = 1;
    }
  }

  const arr = Array.from(scores.entries()).sort(function (a, b) { return b[1] - a[1]; });
  if (!arr.length) return { top: [], confidence: 0, seen: 0 };

  const max = arr[0][1];
  let sum = 0;
  for (const [, v] of arr) sum += Math.exp(v - max);
  const top = arr.slice(0, 3).map(function (e) {
    return { category: e[0], p: Math.exp(e[1] - max) / sum };
  });
  return { top: top, confidence: top[0].p, seen: seen, tokens: toks.length };
}

// ─── 사용자 규칙 ────────────────────────────────────────────────────────────
function loadRules(baseDir) {
  const f = path.join(baseDir, 'pattern-rules.json');
  const empty = { patterns: {}, keywords: [] };
  if (!fs.existsSync(f)) return empty;
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf-8'));
    const patterns = {};
    for (const k of Object.keys(j.patterns || {})) patterns[normKey(k)] = nfc(j.patterns[k]);
    const keywords = (j.keywords || []).map(function (r) {
      return { match: normKey(r.match), category: nfc(r.category) };
    }).filter(function (r) { return r.match && r.category; })
      .sort(function (a, b) { return b.match.length - a.match.length; }); // 긴 키워드 우선
    return { patterns: patterns, keywords: keywords };
  } catch (e) {
    console.log('  [경고] pattern-rules.json 을 읽지 못했습니다: ' + e.message);
    return empty;
  }
}

// ─── 최종 분류 ──────────────────────────────────────────────────────────────
/**
 * @returns {{category:string|null, method:string, confidence:number, candidates:Array}}
 */
function classify(pattern, model, rules, threshold) {
  const pat = nfc(pattern);
  if (!pat || isMeaningless(pat)) {
    return { category: null, method: '패턴명 없음', confidence: 0, candidates: [] };
  }
  const key = normKey(pat);
  const catSet = new Set(model.categories);

  // 0) 사용자 규칙 — 정확일치
  if (rules.patterns[key] && catSet.has(rules.patterns[key])) {
    return { category: rules.patterns[key], method: '사용자규칙', confidence: 1, candidates: [] };
  }
  // 1) 정확 일치 / 2) 정규화 일치 (공백·기호·대소문자·NFC 차이 흡수)
  //    단, 그 이름이 여러 카테고리에 흩어져 있으면(점유율 미달) 이름만으로는 확정하지 않는다.
  const hit = model.exactMap.get(pat) || model.normMap.get(key);
  if (hit) {
    const method = model.exactMap.has(pat) ? '정확일치' : '정규화일치';
    if (hit.share >= (model.shareThreshold || 0.7)) {
      return { category: hit.category, method: method, confidence: hit.share, candidates: [] };
    }
    return {
      category: null, method: '이름 모호',
      confidence: hit.share,
      candidates: knnScore(model, pat).top,
      ambiguous: { category: hit.category, share: hit.share, total: hit.total },
    };
  }
  // 3) 사용자 규칙 — 키워드 부분일치
  for (const r of rules.keywords) {
    if (key.indexOf(r.match) !== -1 && catSet.has(r.category)) {
      return { category: r.category, method: '사용자키워드', confidence: 0.95, candidates: [] };
    }
  }
  // 4) 최근접 이웃 추정
  const nb = knnScore(model, pat);
  if (nb.top.length && nb.confidence >= threshold) {
    return { category: nb.top[0].category, method: '추정', confidence: nb.confidence, candidates: nb.top };
  }
  return { category: null, method: '확신부족', confidence: nb.confidence || 0, candidates: nb.top };
}

module.exports = {
  IMG_EXTS, nfc, normKey, tokenize, isMeaningless,
  parseFilename, parseDataName, loadData, buildModel, nbScore, knnScore, loadRules, classify,
};
