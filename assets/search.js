// 검색 결과 페이지 (mo/web 공용) — 시안 1 (mockups/search.html, 2026-10-28 결정)
// 검색창에 입력하고 엔터 → '검색어' 검색 결과. 칩·탭·설명 없이 결과를 섹션으로 이어서 보여준다.
//   1) 이름이 맞는 카테고리: 그 카테고리 화면 전체
//   2) 이름이 맞는 서비스: 서비스당 카드 1장 (누르면 서비스 화면)
//   3) 패턴명(파일명의 화면 이름)이 맞는 화면 — 1)에서 이미 보여준 카테고리는 뺀다
// 상태는 index.html 의 S (view: 'search', q). 주소는 #q=검색어

function runSearch(q) {
  q = (q || '').trim();
  closeSearchDrop();
  S.selected.clear(); document.getElementById('select-bar').classList.remove('open');
  if (!q) { S.q = ''; if (S.view === 'search') backToIndex(); return; }
  if (q.length >= 2) aTrack('search', { q });
  S.q = q; S.view = 'search'; S.svc = null;
  S.checked.clear(); S.checkedComps.clear(); S.checkedTypes.clear();
  document.getElementById('hdrSearchInput').value = q;
  document.getElementById('hdrSearchInput').blur();
  buildSidebar(); render(); syncUrl();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function searchResults(q) {
  const nq = normCat(q);
  const has = s => normCat(s).includes(nq);

  const cats = ALL_CATS.filter(c => has(c) || has(catLabel(c)));
  const catSet = new Set(cats);

  const svcMap = new Map();
  for (const item of DISPLAY_DATA) {
    const svc = extractService(item.name);
    if (!has(svc)) continue;
    if (!svcMap.has(svc)) svcMap.set(svc, []);
    svcMap.get(svc).push(item);
  }
  const svcs = [...svcMap.entries()].sort((a, b) => sortMixed(a[0], b[0]));

  const pats = DISPLAY_DATA.filter(i => !catSet.has(i.category) && has(extractPattern(i.name)));
  return { cats, svcs, pats };
}

function searchSvcCard(svc, svcItems) {
  const rep = svcItems.find(i => i.category === '메인') || svcItems.find(i => i.category === '랜딩페이지') || svcItems[0];
  const safeSvc = svc.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<div class="svc-item" onclick="showService('${safeSvc}')">
    <div class="svc-thumb${rep.category === '푸시알림' ? ' push-notif' : ''}">
      <img class="svc-thumb-img" data-src="${imgUrl(rep.path)}" alt="${svc}" decoding="async" />
    </div>
    <div class="svc-info">
      <img class="svc-info-icon" src="${iconBase()}${encodeURIComponent(svc)}.png" alt="${svc}"
        data-svc="${svc.replace(/"/g, '&quot;')}" onerror="tryNextIconExt(this)" />
      <div class="svc-info-text">
        <div class="svc-info-name">${svc}</div>
        <div class="svc-info-cat">${getSvcType(svc)} · ${svcItems.length}장</div>
      </div>
    </div>
  </div>`;
}

// render() 가 S.view === 'search' 일 때 부른다
function renderSearch() {
  const g = document.getElementById('grid');
  const ec = encodeURIComponent;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = S.q;
  document.getElementById('detail-header').style.display = 'none';
  setToolbarTitle(`'${esc(q)}' 검색 결과`);
  g.classList.add('filter-mode');

  const { cats, svcs, pats } = searchResults(q);
  // 섹션: [제목, 개수 글자, 카드 HTML 배열]
  const sections = [];
  for (const cat of cats) {
    const items = DISPLAY_DATA.filter(i => i.category === cat);
    sections.push([`'${esc(catLabel(cat))}' 카테고리`, `${items.length.toLocaleString('ko-KR')}장`, items.map(i => cardTpl(i, ec))]);
  }
  if (svcs.length) sections.push([`'${esc(q)}' 서비스`, `${svcs.length}개`, svcs.map(([svc, items]) => searchSvcCard(svc, items))]);
  if (pats.length) sections.push([`'${esc(q)}' 화면 이름`, `${pats.length.toLocaleString('ko-KR')}장`, pats.map(i => cardTpl(i, ec))]);

  const token = ++_renderToken;
  resetLazyObservers();
  if (!sections.length) {
    g.innerHTML = `<div class="empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <p>'${esc(q)}' 검색 결과가 없습니다</p>
    </div>`;
    return;
  }

  // 섹션 틀을 먼저 그리고, 카드는 섹션 순서대로 조금씩 채운다 (한 카테고리가 수천 장일 수 있음)
  g.innerHTML = sections.map(([title, cnt], k) => `<section class="sr-sec${k ? '' : ' first'}">
    <div class="sr-sec-hdr"><span class="sr-sec-title">${title}</span><span class="sr-sec-cnt">${cnt}</span></div>
    <div class="mini-grid" data-sr="${k}"></div>
  </section>`).join('');
  const grids = [...g.querySelectorAll('.mini-grid[data-sr]')];
  const tmp = document.createElement('div');
  let s = 0, i = 0;
  (function step() {
    if (token !== _renderToken) return;  // 다른 화면으로 바뀜
    let budget = 60;
    while (budget > 0 && s < sections.length) {
      const cards = sections[s][2];
      const end = Math.min(i + budget, cards.length);
      tmp.innerHTML = cards.slice(i, end).join('');
      const imgs = [...tmp.querySelectorAll('img[data-src]')];
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      grids[s].appendChild(frag);
      imgs.forEach(img => { _lazyObserver.observe(img); _unloadObserver.observe(img); });
      budget -= end - i; i = end;
      if (i >= cards.length) { s++; i = 0; }
    }
    if (s < sections.length) requestAnimationFrame(step);
  })();
}

// 툴바 제목: 검색 중엔 '검색어' 검색 결과, 아니면 원래 제목(모바일/웹사이트)
let _toolbarTitle = null;
function setToolbarTitle(html) {
  const el = document.querySelector('#toolbar .tb-title');
  if (!el) return;
  if (_toolbarTitle === null) _toolbarTitle = el.innerHTML;
  el.innerHTML = html == null ? _toolbarTitle : html;
}
