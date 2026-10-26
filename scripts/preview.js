/**
 * preview.js — 이 PC에서 사이트 미리보기 (미리보기.bat / 미리보기.command 가 실행)
 *
 *   node scripts/preview.js            → http://localhost:5180/mo/ 를 브라우저로 연다
 *   node scripts/preview.js --port 5181 --no-open   (브라우저를 열지 않음)
 *
 * 이미지 위치는 자동: 이 PC의 mo/·web/ 카테고리 폴더에 이미지가 있으면(회사 PC) 그 이미지를,
 * 없으면(집 PC) 회사 서버 이미지를 쓴다. config.js 의 imgBase 만 바꿔서 내려주고 저장소 파일은 건드리지 않는다.
 * 회사 서버 이미지를 쓸 때는 페이지와 서버가 달라서 다운로드는 새 창으로 열린다 (README 다운로드 참고).
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.join(__dirname, '..');
const arg  = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = +arg('--port', 5180);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

// update.js 와 같은 기준: 카테고리 폴더에 이미지가 하나라도 있으면 이 PC에 이미지가 있다
function hasLocalImages() {
  return ['mo', 'web'].some(p => {
    const base = path.join(ROOT, p);
    return fs.existsSync(base) && fs.readdirSync(base, { withFileTypes: true }).some(d =>
      d.isDirectory() && !d.name.startsWith('(') && !d.name.startsWith('.') && !['icons', 'backups'].includes(d.name) &&
      fs.readdirSync(path.join(base, d.name)).some(f => /\.(png|jpe?g|webp|gif|avif)$/i.test(f)));
  });
}
const LOCAL = hasLocalImages();

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([\\/])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (p === '/config.js' && LOCAL) {
    // 이 PC 이미지로 보기: imgBase 를 상대 경로로 (페이지와 이미지가 같은 서버 → 다운로드도 바로 됨)
    const code = fs.readFileSync(file, 'utf8').replace(/imgBase:[\s\S]*?,\n/, "imgBase: '../',  // 미리보기: 이 PC 이미지\n");
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end(code);
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': TYPES['.txt'] }); return res.end('없는 파일: ' + p); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}/mo/`;
  console.log(`\nUI Patterns 미리보기: ${url}`);
  console.log(`이미지: ${LOCAL ? '이 PC 폴더' : '회사 서버 (이 PC에 이미지 없음)'}`);
  console.log('끝내려면 이 창을 닫으세요.\n');
  if (process.argv.includes('--no-open')) return;   // Claude 등이 띄울 때는 브라우저를 열지 않음
  const open = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(open);
}).on('error', e => {
  if (e.code === 'EADDRINUSE') console.log(`\n이미 미리보기가 켜져 있어요 → http://localhost:${PORT}/mo/\n`);
  else console.log('\n미리보기를 켜지 못했습니다: ' + e.message + '\n');
});
