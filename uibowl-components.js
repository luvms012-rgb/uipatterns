/*
 * uibowl-components.js  (2026-10-30) — 이미지는 받지 않고, 카드 정보(카테고리·화면 이름·컴포넌트)만 읽는다
 * 예전에 캡처한 서비스(10/26 이전)에 컴포넌트를 채우기 위한 것. uibowl-capture.js 의 1) 수집 단계와 같다.
 *   모바일: https://uibowl.io/name/{서비스명}   웹: https://uibowl.io/website/name/{서비스명}
 * 사용: 서비스 페이지에서 이 파일 내용을 그대로 실행 → 끝나면 window.__UBC.result 에 결과
 *   { site, svc, url, readAt, count, items: [{ n, category, pattern, components: [이름...] }] }
 *   → JSON 으로 저장해서 node scripts/match-components.js 에 넘긴다
 * 다운로드 창을 열지 않는다 (10/28 다운로드 창 폭주로 PC 재부팅한 일 이후 규칙)
 */
(async function UBCOMPONENTS() {
  if (window.__UBC && window.__UBC.running) { console.warn('[uibowl-components] 이미 실행 중'); return; }
  const U = window.__UBC = { running: true, phase: 'collect', items: new Map(), done: false, result: null };
  const sleep = t => new Promise(r => setTimeout(r, t));
  const site = location.pathname.startsWith('/website/') ? 'web' : 'mo';

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
      if (!p) return;
      U.items.set(id, {
        app: p.appName || '', category: p.patternCodeName || '', pattern: p.patternName || '', order: U.items.size,
        components: (p.components || []).map(c => c.componentCodeName).filter(Boolean),
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

  // uibowl-capture.js 와 같은 순서로 훑는다: 세로로 섹션을 모두 로드하면서, 섹션마다 가로 스크롤을 끝까지
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
  U.result = {
    tool: 'uibowl-components', site, svc: (items[0] && items[0].app) || decodeURIComponent(location.pathname.split('/').pop()),
    url: location.href, readAt: new Date().toISOString(), count: items.length,
    items: items.map((it, i) => ({ n: i + 1, category: it.category, pattern: it.pattern, components: it.components })),
  };
  U.phase = 'done'; U.done = true; U.running = false;
  console.log('[uibowl-components] 완료', U.result.svc, U.result.count);
})();
