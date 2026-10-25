#!/usr/bin/env node
// UI 패턴 검색 — 카테고리·서비스·업종·패턴명 + 화면 텍스트(OCR)로 화면을 찾는다.
// Claude 가 자연어 질문을 이 조건들로 바꿔 실행한다 (사용법: search/README.md)
//
//   node search/find.js --text "선택 안 함" --zone bottom
//   node search/find.js --cat 장바구니 --text "품절|재고|남은 수량"
//   node search/find.js --svc 에어비앤비,부킹닷컴 --stats
//   node search/find.js --type 모빌리티 --stats
//   node search/find.js ... --html 결과 --montage 결과   (결과 페이지 / Claude 확인용 몽타주)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SERVER = 'https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns';
const OUT_DIR = path.join(__dirname, 'results');

// ── 인자 ──────────────────────────────────────────
const MULTI = new Set(['text', 'not', 'cat', 'svc', 'type', 'pat']);
const args = { site: 'all', limit: 60 };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = process.argv[i + 1];
  const val = next && !next.startsWith('--') ? (i++, next) : true;
  if (MULTI.has(key)) (args[key] = args[key] || []).push(val);
  else args[key] = val;
}
if (args.help || process.argv.length <= 2) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n').replace(/^\/\/ ?/gm, ''));
  process.exit(0);
}

// 띄어쓰기·대소문자·OCR이 헷갈리는 I/l 을 무시하고 비교
const norm = s => String(s).normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/i/g, 'l');
const list = v => (v || []).flatMap(x => String(x).split(',')).map(s => s.trim()).filter(Boolean);
// "a|b" = 하나라도, 여러 --text = 모두
const textGroups = (args.text || []).map(t => String(t).split('|').map(norm).filter(Boolean));
const notTerms = list(args.not).flatMap(t => t.split('|')).map(norm);
const ZONES = { top: [0, 350], middle: [300, 700], bottom: [500, 1001] };
const zone = args.zone ? ZONES[args.zone] || String(args.zone).split('-').map(Number) : null;

// ── 데이터 로드 ────────────────────────────────────
function loadSite(site) {
  const html = fs.readFileSync(path.join(ROOT, site, 'index.html'), 'utf8');
  const s = html.indexOf('[', html.indexOf('const DATA', html.indexOf('__DATA_START__')));
  const e = html.lastIndexOf(']', html.indexOf('__DATA_END__'));
  const data = JSON.parse(html.slice(s, e + 1));
  const st = html.indexOf('const SVC_TYPES');
  const block = html.slice(st, html.indexOf('};', st));
  const types = {};
  for (const m of block.matchAll(/'((?:[^'\\]|\\.)+)'\s*:\s*'([^']+)'/g)) types[m[1].normalize('NFC')] = m[2];

  const ocr = new Map();
  const dir = path.join(__dirname, 'ocr', site);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { const r = JSON.parse(line); if (r.l) ocr.set(r.p.normalize('NFC'), r); } catch { /* 쓰는 중인 줄 */ }
      }
    }
  }
  return data.map(d => {
    const name = d.name.normalize('NFC');
    const parts = name.split('_');
    const svc = parts[0].trim();
    return {
      site, cat: d.category, svc, type: types[svc] || '미분류',
      pat: parts.length > 3 ? parts.slice(1, -2).join(' ') : '',
      path: d.path.normalize('NFC'), ocr: ocr.get(d.path.normalize('NFC')),
    };
  });
}

const sites = args.site === 'all' ? ['mo', 'web'] : list([args.site]);
let rows = sites.flatMap(loadSite);
const ocrCount = rows.filter(r => r.ocr).length;

// ── 필터 ──────────────────────────────────────────
const anyIn = (val, terms) => !terms.length || terms.some(t => norm(val).includes(norm(t)));
const cats = list(args.cat), svcs = list(args.svc), typesF = list(args.type), pats = list(args.pat);
rows = rows.filter(r => anyIn(r.cat, cats) && anyIn(r.svc, svcs) && anyIn(r.type, typesF) && anyIn(r.pat, pats));

if (textGroups.length || notTerms.length) {
  rows = rows.filter(r => {
    if (!r.ocr) return false;
    const lines = r.ocr.l.map(([y, t]) => ({ y, t, n: norm(t) }));
    const all = lines.map(l => l.n).join('|');
    if (notTerms.some(t => all.includes(t))) return false;
    const hits = [];
    for (const group of textGroups) {
      const hit = lines.find(l => group.some(g => l.n.includes(g)) && (!zone || (l.y >= zone[0] && l.y < zone[1])));
      if (!hit) return false;
      hits.push(hit);
    }
    r.hits = hits;
    return true;
  });
}

// ── 출력 ──────────────────────────────────────────
const url = r => `${SERVER}/${r.site}/${r.path.split('/').map(encodeURIComponent).join('/')}`;
const local = r => path.join(ROOT, r.site, ...r.path.split('/'));
const summary = `검색 대상 ${sites.join('+')} · 결과 ${rows.length}장 (OCR 완료 ${ocrCount}장 기준${textGroups.length ? '' : ', 텍스트 조건 없음'})`;

if (args.stats) {
  const by = (key) => {
    const m = new Map();
    for (const r of rows) { const k = `${r.site}\t${key(r)}`; m.set(k, (m.get(k) || 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  console.log(summary);
  const groupBy = args.stats === true ? (svcs.length ? 'cat' : 'svc') : args.stats;
  const keyFn = { svc: r => `${r.svc}\t${r.type}`, cat: r => (svcs.length > 1 ? `${r.svc}\t${r.cat}` : r.cat), type: r => r.type, pat: r => `${r.svc}\t${r.pat || '(이름 없음)'}` }[groupBy];
  for (const [k, n] of by(keyFn).slice(0, Number(args.limit) * 3)) console.log(`${n}\t${k}`);
  process.exit(0);
}

// 같은 서비스가 결과를 독차지하지 않게 서비스별로 번갈아 담는다
const perSvc = new Map();
for (const r of rows) { const k = r.site + r.svc; if (!perSvc.has(k)) perSvc.set(k, []); perSvc.get(k).push(r); }
const picked = [];
const limit = Number(args.limit);
for (let i = 0; picked.length < limit && [...perSvc.values()].some(v => v.length > i); i++) {
  for (const v of perSvc.values()) if (v[i] && picked.length < limit) picked.push(v[i]);
}

if (args.json) {
  console.log(JSON.stringify({ summary, items: picked.map(r => ({ ...r, ocr: undefined, url: url(r), file: local(r), hits: r.hits?.map(h => h.t) })) }, null, 1));
} else {
  console.log(summary);
  picked.forEach((r, i) => {
    const hit = r.hits ? `  「${r.hits.map(h => h.t).join(' / ')}」` : '';
    console.log(`#${i + 1}\t${r.site}\t${r.cat}\t${r.svc}\t${r.pat || '-'}${hit}\n\t${url(r)}`);
  });
}

const stamp = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/\D/g, '');
const baseName = v => (typeof v === 'string' ? v : stamp()).replace(/[\\/:*?"<>|]/g, '_');

if (args.montage && picked.length) {
  // Claude 가 결과를 눈으로 확인할 때 쓰는 번호 붙은 모아보기 이미지
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const listFile = path.join(OUT_DIR, '_montage-list.txt');
  fs.writeFileSync(listFile, '﻿' + picked.map(local).join('\r\n'), 'utf8');
  const out = path.join(OUT_DIR, baseName(args.montage));
  const res = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'montage.ps1'),
    '-ListFile', listFile, '-Out', out, '-Web', sites.length === 1 && sites[0] === 'web' ? '1' : '0'], { encoding: 'utf8' });
  console.log('\n몽타주:\n' + res.trim());
}

if (args.html && picked.length) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, baseName(args.html) + '.html');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const title = args.title || [args.text, args.cat, args.svc, args.type].flat().filter(Boolean).join(' · ') || 'UI 패턴 검색';
  const cards = picked.map((r, i) => {
    const rel = path.relative(OUT_DIR, local(r)).split(path.sep).map(encodeURIComponent).join('/');
    return `<a class="card" href="${esc(url(r))}" target="_blank">
  <span class="no">#${i + 1}</span><img loading="lazy" src="${esc(rel)}" onerror="this.onerror=null;this.src='${esc(url(r))}'" alt="">
  <b>${esc(r.svc)}</b><span>${esc(r.cat)}${r.pat ? ' · ' + esc(r.pat) : ''}</span>${r.hits ? `<em>${esc(r.hits.map(h => h.t).join(' / '))}</em>` : ''}</a>`;
  }).join('\n');
  fs.writeFileSync(file, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root{--bg:#0c0c0e;--bg-card:#17181c;--border:#32343e;--text-1:#f0f0f2;--text-2:#a4a6b0;--accent:#3182f6}
body{margin:0;background:var(--bg);color:var(--text-1);font-family:Pretendard,system-ui,sans-serif;padding:24px 16px}
h1{font-size:20px;margin:0 0 4px}p{color:var(--text-2);margin:0 0 20px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${sites.includes('web') && sites.length === 1 ? 360 : 200}px,1fr));gap:16px}
.card{position:relative;display:flex;flex-direction:column;gap:4px;color:inherit;text-decoration:none;font-size:13px}
.card img{width:100%;border-radius:20px;border:1px solid var(--border);background:var(--bg-card)}
.card span{color:var(--text-2)}.card em{color:var(--accent);font-style:normal;font-size:12px}
.no{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);color:#fff!important;border-radius:8px;padding:2px 8px;font-size:12px}
</style></head><body><h1>${esc(title)}</h1><p>${esc(summary)}</p><div class="grid">
${cards}
</div></body></html>`, 'utf8');
  console.log('\n결과 페이지: ' + file);
}
