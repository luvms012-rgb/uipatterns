#!/usr/bin/env node
// 검색 데이터 생성 — data.js(이미지 목록) + svc-types.js(업종) + taxonomy.js(패턴 그룹) + OCR(화면 글자)를 합쳐
// MCP 검색 서버가 쓰는 SQLite 데이터를 만든다.
//
//   node search/build-index.js
//     → search/dist/uipatterns.sql  Cloudflare D1 에 넣을 SQL (스키마 + 데이터)
//     → search/dist/uipatterns.db   같은 내용의 로컬 SQLite (mcp/local.mjs 로 이 PC에서 바로 검색)
//
// 글자 검색: 화면 글자를 "두 글자씩"(bigram) 잘라 전문 검색(FTS5) 색인에 넣는다.
//   "선택 안 함" → 선택안함 → [선택][택안][안함] 이 연속으로 있는 화면 = 글자가 그대로 들어간 화면.
//   한국어 두 글자 단어("품절", "쿠폰")도 찾을 수 있고, 띄어쓰기·기호·대소문자는 무시한다.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { norm, bigrams, LINE_SEP, catKey, ZONE_COLS, zoneCol } = require('../mcp/src/text.js');   // MCP 서버와 같은 규칙 (ESM — Node 22.12+ 는 require 가능)

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'dist');
const SITES = ['mo', 'web'];

// 저장소의 설정 파일(const 선언)을 그대로 실행해서 값만 꺼낸다
function loadJs(file, names) {
  const code = fs.readFileSync(file, 'utf8');
  return vm.runInNewContext(`${code}\n;({${names.join(',')}})`, {}, { filename: file });
}

function loadOcr(site) {
  const map = new Map();
  const dir = path.join(__dirname, 'ocr', site);
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

const q = v => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// D1 무료 요금은 하루 읽는 행 수에 한도가 있어서, 목록·집계는 작은 요약 표(cats·svcs)로 하고
// screens 는 정확한 이름(색인)으로만 찾는다. 글자 색인은 화면 위치 구간별 열(z0~z3)로 나눠 위치 조건도 색인에서 바로 찾는다.
const SCHEMA = `
DROP TABLE IF EXISTS screens_fts;
DROP TABLE IF EXISTS screens;
DROP TABLE IF EXISTS cats;
DROP TABLE IF EXISTS svcs;
DROP TABLE IF EXISTS meta;
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE cats (site TEXT, cat TEXT, cat_key TEXT, grp TEXT, n INTEGER, ocr INTEGER);
CREATE TABLE svcs (site TEXT, svc TEXT, svc_key TEXT, industry TEXT, n INTEGER, ocr INTEGER);
CREATE TABLE screens (
  id INTEGER PRIMARY KEY,
  site TEXT NOT NULL,       -- mo | web
  path TEXT NOT NULL,       -- 카테고리/파일.png (회사 서버 이미지 경로)
  cat TEXT NOT NULL,        -- 카테고리 이름 (uibowl 이름으로 맞추고 'ㆍ'→'·' — mo/web 폴더 표기 차이 통일)
  cat_key TEXT NOT NULL,    -- 비교용 카테고리 이름 (띄어쓰기·기호 제거)
  grp TEXT NOT NULL,        -- 패턴 그룹 (진입·탐색·거래 …)
  svc TEXT NOT NULL,        -- 서비스명
  svc_key TEXT NOT NULL,    -- 비교용 서비스명
  industry TEXT NOT NULL,   -- 업종
  pattern TEXT NOT NULL,    -- 파일명 속 화면 이름 (없으면 빈 값)
  date TEXT NOT NULL,       -- 캡처 날짜 YYYYMMDD
  comps TEXT NOT NULL,      -- ,버튼,바텀시트,  (캡처에 컴포넌트가 있을 때)
  ocr INTEGER NOT NULL,     -- 1 = 화면 글자 추출 완료
  lines TEXT NOT NULL       -- 화면 글자 원문: 줄마다 "세로위치(0~1000)<TAB>글자", 줄바꿈으로 구분
);
CREATE UNIQUE INDEX screens_path ON screens (site, path);
CREATE INDEX screens_cat ON screens (cat, site);
CREATE INDEX screens_svc ON screens (svc, site, cat);
CREATE INDEX screens_ind ON screens (industry, site);
CREATE VIRTUAL TABLE screens_fts USING fts5 (${ZONE_COLS.map((_, i) => 'z' + i).join(', ')}, content='', tokenize='unicode61 remove_diacritics 0');
`;

function build() {
  const sql = [SCHEMA.trim()];
  const stats = {};
  const catCount = new Map(), svcCount = new Map();   // "site\t이름\t…" → [화면 수, 글자 추출 수]
  let id = 0;
  for (const site of SITES) {
    const dir = path.join(ROOT, site);
    const { DATA } = loadJs(path.join(dir, 'data.js'), ['DATA']);
    const { SVC_TYPES } = loadJs(path.join(dir, 'svc-types.js'), ['SVC_TYPES']);
    const { PATTERN_GROUPS, CAT_ALIAS } = loadJs(path.join(dir, 'taxonomy.js'), ['PATTERN_GROUPS', 'CAT_ALIAS']);
    const types = new Map(Object.entries(SVC_TYPES).map(([k, v]) => [k.normalize('NFC'), v]));
    const groupOf = new Map();
    for (const g of PATTERN_GROUPS) for (const c of g.cats) groupOf.set(catKey(c), g.name);
    const alias = new Map(Object.entries(CAT_ALIAS || {}).map(([k, v]) => [catKey(k), v]));
    const ocr = loadOcr(site);

    let withText = 0;
    for (const d of DATA) {
      id++;
      const p = d.path.normalize('NFC');
      const name = d.name.normalize('NFC');
      const parts = name.split('_');
      const svc = parts[0].trim();
      const ui = (alias.get(catKey(d.category)) || d.category).normalize('NFC').replace(/ㆍ/g, '·');
      const key = catKey(ui);
      const lines = ocr.get(p);
      if (lines) withText++;
      const text = (lines || []).map(([y, t]) => `${y}\t${String(t).replace(/[\t\n]/g, ' ')}`).join('\n');
      const comps = Array.isArray(d.comps) && d.comps.length ? `,${d.comps.join(',')},` : '';
      const date = /^\d{8}$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : '';
      sql.push(`INSERT INTO screens VALUES (${[id, site, p, ui, key, groupOf.get(key) || '기타 패턴',
        svc, norm(svc), types.get(svc) || '미분류', parts.length > 3 ? parts.slice(1, -2).join(' ') : '', date, comps,
        lines ? 1 : 0, text].map(q).join(',')});`);
      if (lines && lines.length) {
        const cols = ZONE_COLS.map(() => []);
        for (const [y, t] of lines) { const g = bigrams(norm(t)).join(' '); if (g) cols[Math.max(zoneCol(y), 0)].push(g); }
        if (cols.some(c => c.length)) {
          sql.push(`INSERT INTO screens_fts (rowid, ${cols.map((_, i) => 'z' + i).join(', ')}) VALUES (${id}, ${cols.map(c => q(c.join(` ${LINE_SEP} `))).join(', ')});`);
        }
      }
      const cv = `${site}\t${ui}\t${key}\t${groupOf.get(key) || '기타 패턴'}`;
      const sv = `${site}\t${svc}\t${norm(svc)}\t${types.get(svc) || '미분류'}`;
      for (const [m, k] of [[catCount, cv], [svcCount, sv]]) { const c = m.get(k) || [0, 0]; c[0]++; if (lines) c[1]++; m.set(k, c); }
    }
    stats[site] = { screens: DATA.length, ocr: withText };
  }
  for (const [table, m] of [['cats', catCount], ['svcs', svcCount]]) {
    for (const [k, [n, o]] of m) sql.push(`INSERT INTO ${table} VALUES (${[...k.split('\t'), n, o].map(q).join(',')});`);
  }
  const built = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  sql.push(`INSERT INTO meta VALUES ('built', ${q(built)}), ('stats', ${q(JSON.stringify(stats))});`);
  return { sql: sql.join('\n') + '\n', stats, built };
}

const { sql, stats, built } = build();
fs.mkdirSync(OUT, { recursive: true });
const sqlFile = path.join(OUT, 'uipatterns.sql');
fs.writeFileSync(sqlFile, sql);

// 로컬 SQLite 도 같은 SQL 로 만든다 (D1 과 똑같은 결과를 이 PC에서 확인)
const dbFile = path.join(OUT, 'uipatterns.db');
const { DatabaseSync } = require('node:sqlite');
const tmp = dbFile + '.tmp';
if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
const db = new DatabaseSync(tmp);
db.exec('BEGIN');
db.exec(sql);
db.exec('COMMIT');
db.exec("INSERT INTO screens_fts (screens_fts) VALUES ('optimize')");
db.close();
fs.renameSync(tmp, dbFile);

const mb = f => (fs.statSync(f).size / 1e6).toFixed(1) + 'MB';
console.log(`검색 데이터 생성 (${built})`);
for (const [site, s] of Object.entries(stats)) console.log(`  ${site}: 화면 ${s.screens}장 · 글자 추출 ${s.ocr}장`);
console.log(`  ${path.relative(ROOT, sqlFile)} ${mb(sqlFile)} · ${path.relative(ROOT, dbFile)} ${mb(dbFile)}`);
