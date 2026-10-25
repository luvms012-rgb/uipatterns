/**
 * uibowl 수집 스크립트 (패턴명 추출 강화판)
 *
 * 기존 스크립트가 서비스 상세 페이지에서 patternName을 못 찾아
 * "하나원큐_001_20260807.png" 처럼 패턴명 없이 저장되던 문제를 보완한다.
 *
 * 개선점
 *  1. React fiber를 더 깊게(25단계) 탐색하고, prop 키 이름에 'pattern'이
 *     포함된 모든 값을 후보로 수집한다.
 *  2. 그래도 못 찾으면 URL의 ?patterns= 값을 폴백으로 사용한다.
 *  3. 패턴명을 끝내 못 찾은 카드는 아예 다운로드하지 않고 콘솔에 목록만 출력한다.
 *     (패턴명 없는 파일이 다시 미분류로 쌓이는 것을 원천 차단)
 *
 * 사용법
 *   https://uibowl.io/name/{서비스명}?detail=1  접속 → F12 → Console에 붙여넣기
 *   패턴명이 여전히 안 잡히면 좌측 UI 패턴 필터를 하나 선택한 뒤
 *   (URL이 ...?patterns=검색 형태가 됨) 다시 실행하면 폴백이 동작한다.
 */
(async function () {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // URL의 patterns 파라미터 (폴백용)
  const urlPattern = new URLSearchParams(location.search).get('patterns') || '';

  function sanitize(s) {
    return (s || '')
      .replace(/[・·•‧]/g, '-')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/_+/g, '_').replace(/-+/g, '-')
      .replace(/^[_-]+|[_-]+$/g, '')
      .trim();
  }

  async function toPngBlob(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function dl(url, filename) {
    const blob = await toPngBlob(url);
    const burl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = burl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(burl), 2000);
    await new Promise(r => setTimeout(r, 400));
  }

  // ── 강화된 정보 추출 ────────────────────────────────────────────────
  // props 객체에서 appName / pattern 계열 값을 폭넓게 찾는다.
  function harvest(props, out) {
    if (!props || typeof props !== 'object') return;
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (typeof v !== 'string' || !v) continue;
      if (k === 'appName' && !out.app) out.app = v;
      if (/pattern/i.test(k) && !out.pattern) out.pattern = v;
    }
  }

  function getInfo(card) {
    const out = { app: '', pattern: '' };
    const fk = Object.keys(card).find(k => k.startsWith('__reactFiber'));
    let f = card[fk];

    for (let i = 0; i < 25 && f; i++) {
      const p = f.memoizedProps;
      harvest(p, out);
      if (p && p.children) {
        const ch = [p.children].flat(6);
        for (const c of ch) if (c && c.props) harvest(c.props, out);
      }
      if (out.app && out.pattern) break;
      f = f.return;
    }
    if (!out.pattern) out.pattern = urlPattern;   // 폴백
    return out;
  }

  const allItems = new Map();
  const noPattern = [];

  function collectCard(card) {
    const id = card.getAttribute && card.getAttribute('data-img-id');
    if (!id || allItems.has(id)) return;
    const img = card.querySelector('img[src*="/_next/image"]');
    if (!img || !img.getAttribute('src')) return;

    const info = getInfo(card);
    const svc = sanitize(info.app || '미분류');
    const pat = sanitize(info.pattern);

    if (!pat) {                       // 패턴명 없으면 수집 제외
      noPattern.push(id);
      return;
    }
    allItems.set(id, { src: img.getAttribute('src'), prefix: svc + '_' + pat });
    console.log('[수집 ' + allItems.size + '] ' + svc + '_' + pat);
  }

  document.querySelectorAll('[data-img-id]').forEach(collectCard);

  const scrollEl = document.querySelector('[data-radix-scroll-area-viewport]');
  const observeTarget = scrollEl || document.body;
  const observer = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.hasAttribute && node.hasAttribute('data-img-id')) collectCard(node);
      if (node.querySelectorAll) node.querySelectorAll('[data-img-id]').forEach(collectCard);
    }));
  });
  observer.observe(observeTarget, { childList: true, subtree: true });

  if (scrollEl) {
    while (true) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      if (scrollLeft + clientWidth >= scrollWidth - 5) break;
      scrollEl.scrollLeft += 400;
      await new Promise(r => setTimeout(r, 600));
    }
  } else {
    while (true) {
      const before = window.scrollY;
      window.scrollBy(0, 600);
      await new Promise(r => setTimeout(r, 600));
      if (window.scrollY === before) break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  observer.disconnect();

  console.log('\n── 수집 결과 ──');
  console.log('패턴명 확보: ' + allItems.size + '개');
  if (noPattern.length) {
    console.warn('패턴명 미확보(다운로드 제외): ' + noPattern.length + '개');
    console.warn('→ 좌측 UI 패턴 필터를 선택해 URL에 ?patterns=... 를 붙인 뒤 다시 실행하세요.');
  }
  if (!allItems.size) { console.warn('다운로드할 항목이 없습니다.'); return; }

  let count = 0;
  for (const [, item] of allItems) {
    const filename = item.prefix + '_' + String(++count).padStart(3, '0') + '_' + today + '.png';
    console.log('[' + count + '/' + allItems.size + '] ' + filename);
    await dl(item.src, filename);
  }
  console.log('\n완료: ' + count + '개');
})();
