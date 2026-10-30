/*
 * pack-site.js — 회사 서버에 올릴 사이트 파일(이미지 제외)을 zip 하나로 묶는다.
 * 저장: (사이트업로드)/site_YYYYMMDD.zip — 압축을 풀면 uipatterns/ 아래 그대로 놓이는 구조 (mo/index.html 등)
 * 이미지와 서비스 아이콘은 지금처럼 {mo,web}/(업로드) zip 으로 따로 올린다.
 * 사용: node scripts/pack-site.js
 */
const fs = require('fs');
const path = require('path');
const { writeZip, today } = require('../zip-upload.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '(사이트업로드)');
const PAGE = ['index.html', 'data.js', 'svc-types.js', 'icons.js', 'taxonomy.js', 'search-index.js', 'version.js', 'stats.js'];
const list = [
  'index.html', 'config.js', 'robots.txt',
  ...fs.readdirSync(path.join(ROOT, 'assets')).filter(f => /\.(css|js)$/.test(f)).map(f => 'assets/' + f),
  ...fs.readdirSync(path.join(ROOT, 'ybm-ds')).filter(f => /\.css$/.test(f)).map(f => 'ybm-ds/' + f),
  ...fs.readdirSync(path.join(ROOT, 'ybm-ds', 'fonts')).filter(f => /\.woff2$/.test(f)).map(f => 'ybm-ds/fonts/' + f),
  ...['mo', 'web'].flatMap(s => PAGE.map(f => s + '/' + f)),
  // 화면 속 글자 색인 — 있을 때만 (search/build-words.js, 없으면 사이트가 글자 검색만 쉰다)
  ...['mo', 'web'].map(s => s + '/words.js').filter(f => fs.existsSync(path.join(ROOT, f))),
];
const missing = list.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) { console.error('없는 파일: ' + missing.join(', ')); process.exit(1); }

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.zip$/i.test(f)) fs.unlinkSync(path.join(OUT, f)); // rmSync 는 Node 24 + 한글 경로에서 죽음
const files = list.map(rel => ({ abs: path.join(ROOT, rel), rel, size: fs.statSync(path.join(ROOT, rel)).size }));
const name = 'site_' + today() + '.zip';
const size = writeZip(path.join(OUT, name), files);
console.log(`(사이트업로드)/${name}  ${(size / 1048576).toFixed(1)}MB  ${files.length}개`);
for (const f of files) console.log('  ' + f.rel);
