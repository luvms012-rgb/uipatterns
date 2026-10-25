'use strict';
/**
 * zip-upload.js  (2026-10-21)
 *
 * {site}/(업로드)/ 전체를 95MB 이하 zip 여러 개로 나눠 압축한다.
 *   - 파일명: 오늘 날짜(KST).  1개면 20261021.zip, 여러 개면 20261021_1.zip, 20261021_2.zip ...
 *   - 저장 위치: {site}/(업로드)/ 바로 아래 (기존 *.zip 은 먼저 지운다)
 *   - 각 zip은 단독으로 풀 수 있다 (분할 볼륨 .z01 방식이 아님). 폴더 구조는 그대로 유지.
 *   - index.html / version.js / stats.js 는 항상 1번 zip에 넣는다.
 *   - PNG는 이미 압축된 형식이라 무압축(store)으로 담는다 → 빠르고, 용량 계산이 정확하다.
 *   - 외부 프로그램 없이 Node만으로 동작 (Windows/Linux 동일). 한글 파일명은 UTF-8 플래그로 기록.
 *
 * 사용: node zip-upload.js --site web      (mo|web, 생략 시 둘 다)
 *       --limit 95                          (MB, 기본 95)
 * classify-local.js 와 prepare-upload.bat 이 마지막 단계로 자동 호출한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SITES = arg('--site', '') ? [arg('--site', '')] : ['mo', 'web'];
const LIMIT = Math.floor(parseFloat(arg('--limit', '95')) * 1024 * 1024);
const FIRST = ['index.html', 'version.js', 'stats.js'];

function today() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // KST 고정 (TZ 설정과 무관)
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function dosTime(dt) {
  const time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1);
  const date = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
  return { time, date };
}

function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, rel, out);
    else if (e.isFile() && !/\.zip$/i.test(e.name) && !/^(desktop\.ini|thumbs\.db|\.ds_store)$/i.test(e.name)) {
      out.push({ abs, rel: rel.normalize('NFC'), size: fs.statSync(abs).size });
    }
  }
  return out;
}

// 무압축 zip 작성 (스트리밍: 파일을 하나씩 읽어 바로 기록)
function writeZip(outPath, files) {
  const fd = fs.openSync(outPath, 'w');
  let off = 0;
  const central = [];
  const w = b => { fs.writeSync(fd, b); off += b.length; };
  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const name = Buffer.from(f.rel, 'utf8');
    const crc = crc32(data);
    const { time, date } = dosTime(fs.statSync(f.abs).mtime);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const at = off;
    w(lh); w(name); w(data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(at, 42);
    central.push(Buffer.concat([ch, name]));
  }
  const cdStart = off;
  for (const c of central) w(c);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(off - cdStart, 12); end.writeUInt32LE(cdStart, 16);
  w(end);
  fs.closeSync(fd);
  return off;
}

// 파일당 zip 오버헤드: 로컬헤더 30 + 중앙헤더 46 + 이름 2번
const cost = f => f.size + 76 + 2 * Buffer.byteLength(f.rel, 'utf8');

function run(site) {
  const stage = path.join(ROOT, site, '(업로드)');
  if (!fs.existsSync(stage)) { console.log('  [zip-upload] ' + site + ': (업로드) 폴더 없음 — 건너뜀'); return; }

  for (const f of fs.readdirSync(stage)) if (/\.zip$/i.test(f)) fs.rmSync(path.join(stage, f), { force: true });

  const files = walk(stage, '', []);
  if (!files.length) { console.log('  [zip-upload] ' + site + ': (업로드)가 비어 있음 — 건너뜀'); return; }
  const big = files.filter(f => cost(f) + 22 > LIMIT);
  if (big.length) big.forEach(f => console.log('  [경고] 단일 파일이 한도보다 큼(그대로 단독 zip): ' + f.rel));

  // 1번 zip에 index.html 등 고정 파일, 그 뒤로 경로순(같은 카테고리끼리 모이게)
  const head = files.filter(f => FIRST.includes(f.rel));
  const rest = files.filter(f => !FIRST.includes(f.rel)).sort((a, b) => a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0);
  const parts = [];
  let cur = [], curSize = 22;
  for (const f of head.concat(rest)) {
    if (cur.length && curSize + cost(f) > LIMIT) { parts.push(cur); cur = []; curSize = 22; }
    cur.push(f); curSize += cost(f);
  }
  if (cur.length) parts.push(cur);

  const day = today();
  const names = parts.length === 1 ? [day + '.zip'] : parts.map((_, i) => day + '_' + (i + 1) + '.zip');
  const total = files.reduce((s, f) => s + f.size, 0);
  console.log('\n  [zip-upload] ' + site + '/(업로드) 파일 ' + files.length + '개, ' + (total / 1048576).toFixed(1) + 'MB → ' + parts.length + '개로 분할 (한도 ' + (LIMIT / 1048576) + 'MB)');
  parts.forEach((p, i) => {
    const out = path.join(stage, names[i]);
    const tmp = out + '.part';
    const sz = writeZip(tmp, p);
    fs.renameSync(tmp, out);
    // 검증: 방금 쓴 zip의 끝 레코드에서 파일 수를 다시 읽어 맞는지 확인
    const fd = fs.openSync(out, 'r'); const tail = Buffer.alloc(22);
    fs.readSync(fd, tail, 0, 22, fs.statSync(out).size - 22); fs.closeSync(fd);
    if (tail.readUInt32LE(0) !== 0x06054b50 || tail.readUInt16LE(10) !== p.length) throw new Error('zip 검증 실패: ' + names[i]);
    const cats = [...new Set(p.map(f => f.rel.split('/')[0]))].filter(c => !FIRST.includes(c));
    console.log('    ' + names[i] + '  ' + (sz / 1048576).toFixed(1) + 'MB  (' + p.length + '개)  ' + cats[0] + ' ~ ' + cats[cats.length - 1]);
  });
  const URL = 'https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/' + site + '/index.html?check=' + day;
  console.log('  → zip ' + parts.length + '개를 빠짐없이 올린 뒤, 반영되면 아래 주소로 엑박 점검 (✅ 이상 없음이 떠야 끝):');
  console.log('    ' + URL);
}

for (const s of SITES) run(s);
