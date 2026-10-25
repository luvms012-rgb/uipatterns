/*
 * uibowl-capture.js  (v4, 2026-10-21)
 * uibowl 서비스 페이지의 스크린샷 전체 + 아이콘 + 매니페스트를 한 번에 다운로드한다.
 *   모바일: https://uibowl.io/name/{서비스명}
 *   웹    : https://uibowl.io/website/name/{서비스명}
 *
 * 핵심: 카드마다 uibowl이 붙여둔 카테고리(patternCodeName)와 화면 이름(patternName)을
 *       매니페스트(UB__..__manifest.json)에 기록한다 → classify-local.js 가 이 값으로 바로 분류.
 *       (예전 스크립트는 patternName만 파일명에 넣어서, 이름이 비어 있으면 분류가 불가능했다)
 *
 * 다운로드 파일명: UB__{mo|web}__{서비스명}__{MMDDHHmm}__{NNN}.png / __icon.png / __manifest.json
 *   → capture-import.js 가 Chrome 저장 위치(현재 바탕화면)에서 찾아 {mo|web}/(업데이트)/{서비스명}/ 으로 옮긴다.
 * 인터랙션 영상(mp4) 카드는 영상 중간 프레임을 PNG로 저장한다 (manifest item.video=true).
 *
 * 진행 상태는 window.__UB 에 있다: { phase, total, dl, fail, done, summary }
 */
(async function UBCAPTURE() {
  if (window.__UB && window.__UB.running) { console.warn('[uibowl-capture] 이미 실행 중'); return; }
  const U = window.__UB = { running: true, phase: 'collect', items: new Map(), total: 0, dl: 0, fail: [], done: false, summary: null };
  const sleep = t => new Promise(r => setTimeout(r, t));
  const site = location.pathname.startsWith('/website/') ? 'web' : 'mo';
  const now = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const today = now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate());       // 로컬(KST) 날짜
  const stamp = p2(now.getMonth() + 1) + p2(now.getDate()) + p2(now.getHours()) + p2(now.getMinutes());

  function sanitize(s) {
    return (s || '').replace(/[・·•‧]/g, '-').replace(/[<>:"/\\|?*]/g, '')
      .replace(/_+/g, '_').replace(/-+/g, '-').replace(/^[_-]+|[_-]+$/g, '').trim();
  }
  function getInfo(card) {
    const fk = Object.keys(card).find(k => k.startsWith('__reactFiber'));
    let f = card[fk];
    for (let i = 0; i < 15; i++) {
      const p = f && f.memoizedProps;
      if (p && p.children) {
        const ch = Array.isArray(p.children) ? p.children : [p.children];
        for (const c of ch) { if (c && c.props && c.props.appName) return c.props; }
      }
      f = f && f.return;
      if (!f) break;
    }
    return null;
  }
  function collect() {
    document.querySelectorAll('[data-img-id]').forEach(c => {
      const id = c.getAttribute('data-img-id');
      if (!id || U.items.has(id)) return;
      const p = getInfo(c);
      let src = p && p.src;
      if (!src) { const im = c.querySelector('img'); src = im && (im.currentSrc || im.src); }
      if (!src) return;
      U.items.set(id, {
        imgId: id, app: (p && p.appName) || '', category: (p && p.patternCodeName) || '',
        pattern: (p && p.patternName) || '', isPush: !!(p && p.isPush), src: src, order: U.items.size,
      });
    });
  }
  function scrollers() {
    const s = new Set();
    document.querySelectorAll('[data-img-id]').forEach(c => {
      let el = c.parentElement;
      while (el && el !== document.body) {
        const st = getComputedStyle(el);
        if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 5) { s.add(el); break; }
        el = el.parentElement;
      }
    });
    return [...s];
  }

  // ── 1) 수집: 세로로 섹션을 모두 로드하면서, 섹션마다 가로 스크롤을 끝까지 ──
  await sleep(1500);
  const seen = new WeakSet();
  let stable = 0;
  while (stable < 5) {
    const before = U.items.size;
    collect();
    for (const sc of scrollers()) {
      if (seen.has(sc)) continue;
      seen.add(sc);
      let st = 0;
      while (st < 4) {
        const b = U.items.size;
        const atEnd = sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 5;
        sc.scrollLeft += 600;
        await sleep(350);
        collect();
        if (U.items.size === b && atEnd) st++; else st = 0;
      }
    }
    const el = document.scrollingElement || document.documentElement;
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 5;
    window.scrollBy(0, 700);
    await sleep(700);
    collect();
    if (U.items.size === before && atBottom) stable++; else stable = 0;
  }
  window.scrollTo(0, 0);

  const items = [...U.items.values()].sort((a, b) => a.order - b.order);
  const svc = sanitize((items[0] && items[0].app) || decodeURIComponent(location.pathname.split('/').pop()));
  const tag = 'UB__' + site + '__' + svc + '__' + stamp + '__';
  U.total = items.length;
  U.phase = 'download';
  console.log('[uibowl-capture] ' + svc + ' (' + site + ') 카드 ' + items.length + '개 수집 — 다운로드 시작');

  // ── 2) 다운로드 (원본 PNG, 실패 시 재시도) ──
  async function fetchBlob(url, tries) {
    let last;
    for (let i = 0; i < (tries || 4); i++) {
      try {
        const r = await fetch(url, { cache: 'force-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.blob();
      } catch (e) { last = e; await sleep(600 * Math.pow(2, i)); }
    }
    throw last;
  }
  // 인터랙션 영상(mp4) 카드는 영상 중간 프레임을 PNG로 저장한다
  async function videoFrame(blob) {
    const u = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = u;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video decode')); });
    v.currentTime = Math.min(v.duration * 0.5, Math.max(0, v.duration - 0.1));
    await new Promise(r => { v.onseeked = r; });
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d').drawImage(v, 0, 0);
    URL.revokeObjectURL(u);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  async function toPng(blob) {
    if (blob.type === 'image/png') return blob;
    if (/^video\//.test(blob.type)) return videoFrame(blob);
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  async function save(blob, filename) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    await sleep(350);
  }

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const n = String(i + 1).padStart(3, '0');
    const file = tag + n + '.png';
    let ok = false;
    for (let t = 0; t < 2 && !ok; t++) {
      try { await save(await toPng(await fetchBlob(it.src)), file); ok = true; }
      catch (e) { if (t === 1) U.fail.push({ n: i + 1, src: it.src, err: String(e && e.message || e) }); else await sleep(1500); }
    }
    if (ok) U.dl++;
    out.push({ n: i + 1, file: ok ? file : null, imgId: it.imgId, category: it.category, pattern: it.pattern, isPush: it.isPush, video: /\.(mp4|webm|mov)(\?|$)/i.test(it.src) });
  }

  let iconFile = null;
  const iconImg = document.querySelector('img[alt="icon"]');
  if (iconImg && iconImg.src) {
    try { await save(await toPng(await fetchBlob(iconImg.src)), tag + 'icon.png'); iconFile = tag + 'icon.png'; }
    catch (e) { console.warn('[uibowl-capture] 아이콘 실패', e); }
  }

  // ── 3) 매니페스트 (마지막에 저장 = 배치 완료 신호) ──
  const manifest = {
    tool: 'uibowl-capture', version: 4, site: site, svc: svc, url: location.href,
    capturedAt: now.toISOString(), date: today, tag: tag, icon: iconFile,
    count: items.length, downloaded: U.dl, failed: U.fail, items: out,
  };
  await sleep(1500);
  await save(new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }), tag + 'manifest.json');

  const cats = {};
  out.forEach(o => { cats[o.category || '(없음)'] = (cats[o.category || '(없음)'] || 0) + 1; });
  U.summary = { svc: svc, site: site, tag: tag, total: items.length, downloaded: U.dl, failed: U.fail.length, icon: !!iconFile, categories: cats };
  U.phase = 'done'; U.done = true; U.running = false;
  console.log('[uibowl-capture] 완료', U.summary);
})();
