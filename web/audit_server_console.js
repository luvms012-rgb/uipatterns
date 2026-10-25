/* UI Patterns 서버 무결성 검사 — 서버의 mo/ 또는 web/ index.html 콘솔에서 실행.
   업로드 직후 반드시 1회 실행할 것. HEAD 200 만으로는 0바이트를 못 잡으므로
   Content-Length(실제 바이트)까지 확인한다. */
(async () => {
  const base = location.href.replace(/index\.html.*$/, '');
  const A = { zero: [], missing: [], nfd: [] };
  const CONC = 50;
  for (let i = 0; i < DATA.length; i += CONC) {
    const chunk = DATA.slice(i, i + CONC);
    await Promise.all(chunk.map(async d => {
      if (d.path.normalize('NFC') !== d.path) A.nfd.push(d.path);   // NFD 파일명(서버 404 유발)
      try {
        const r = await fetch(base + encodeURI(d.path), { method: 'HEAD' });
        if (r.status !== 200) A.missing.push(d.path + ' [' + r.status + ']');       // 404 등: 아예 없음
        else if (r.headers.get('content-length') === '0') A.zero.push(d.path);      // 0바이트: 이름만 있고 빈 파일
      } catch (e) { A.missing.push(d.path + ' [ERR]'); }
    }));
    if (i % 3000 === 0) console.log('...검사중', i, '/', DATA.length);
  }
  console.log('===== 서버 무결성 결과 (' + DATA.length + '개) =====');
  console.log('0바이트(빈 파일):', A.zero.length);
  console.log('누락(404 등):', A.missing.length);
  console.log('NFD 파일명:', A.nfd.length);
  window.__AUDIT = A;
  console.log('상세: window.__AUDIT.zero / .missing / .nfd');
  if (A.zero.length + A.missing.length + A.nfd.length === 0) console.log('✅ 이상 없음 — 모든 이미지 정상');
  else console.log('⚠️ 위 목록을 재업로드/정규화 후 이 검사를 다시 실행');
})();
