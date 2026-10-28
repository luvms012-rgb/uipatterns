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

// ── 검색 자동완성 — 시안 A "추천 검색어 중심" (2026-10-28 결정) ──────────────
// 종류 제목·종류 글자·아래 안내 없이 한 목록(종류는 아이콘으로만 구분), 최대 6줄:
// ① 카테고리(모바일·웹 개수를 한 줄에) ② 서비스 ③ 이어지는 검색어
// (화면 이름 — 같은 이름은 서비스가 달라도 한 줄로 합치고 화면 수). 입력한 글자는 보통 굵기, 이어지는 말만 굵게.
// 아이콘은 그림 기호만 쓴다 — 입력할 때마다 회사 서버 이미지를 부르지 않도록 (웹방화벽)
const AC_MAX = 6;
const AC = { rows: [], active: -1 };
const AC_SVG = {
  cat: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  svc: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>',
  q:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

function acEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// 입력한 부분은 보통, 나머지는 굵게
function acBold(text, q) {
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out += '<b>' + acEsc(text.slice(last, m.index)) + '</b>';
    out += acEsc(m[0]); last = m.index + m[0].length;
    if (!m[0].length) break;
  }
  if (last < text.length) out += '<b>' + acEsc(text.slice(last)) + '</b>';
  return out;
}
// "모바일 338 · 웹 255" — 0인 쪽은 뺀다
function acCounts(byPlat) {
  return ['mo', 'web'].filter(p => byPlat[p]).map(p => `${p === 'mo' ? '모바일' : '웹'} ${byPlat[p].toLocaleString('ko-KR')}`).join(' · ');
}

function buildAutocomplete(q) {
  const nq = normCat(q);
  const has = s => !!s && normCat(s).includes(nq);
  const other = PLATFORM === 'mo' ? 'web' : 'mo';
  const X = crossSearchIndex || {};
  const rows = [];

  // ① 카테고리 — 두 사이트를 표시 이름 기준으로 합친다
  const catMap = new Map();
  for (const c of ALL_CATS) if (has(c) || has(catLabel(c))) {
    const k = normCat(catLabel(c));
    catMap.set(k, Object.assign(catMap.get(k) || {}, { label: catLabel(c), mine: c, n: { [PLATFORM]: CAT_COUNTS[c] || 0 } }));
  }
  for (const c of (X.cats || [])) {
    const label = CAT_ALIAS[c] || c;
    if (!has(c) && !has(label)) continue;
    const k = normCat(label), e = catMap.get(k) || { label, n: {} };
    e.theirs = c; e.n[other] = (X.catCounts || {})[c] || 0;
    catMap.set(k, e);
  }
  for (const e of [...catMap.values()].slice(0, 2)) rows.push({
    icon: 'cat', title: acBold(e.label, q), cnt: acCounts(e.n),
    pick: () => e.mine ? searchSelectCat(encodeURIComponent(e.mine)) : crossSearchSelectCat(other, encodeURIComponent(e.theirs)),
  });

  // ② 서비스
  const svcMap = new Map();
  for (const item of DISPLAY_DATA) {
    const svc = extractService(item.name);
    if (!has(svc)) continue;
    const e = svcMap.get(svc) || { svc, n: { [PLATFORM]: 0 } };
    e.n[PLATFORM]++; svcMap.set(svc, e);
  }
  for (const s of (X.svcs || [])) if (has(s.svc)) {
    const e = svcMap.get(s.svc) || { svc: s.svc, n: {}, theirsOnly: true };
    e.n[other] = s.count; svcMap.set(s.svc, e);
  }
  const svcs = [...svcMap.values()].sort((a, b) => (normCat(a.svc) === nq ? -1 : 0) - (normCat(b.svc) === nq ? -1 : 0) || sortMixed(a.svc, b.svc));
  for (const e of svcs.slice(0, 2)) rows.push({
    icon: 'svc', title: acBold(e.svc, q), cnt: acCounts(e.n),
    pick: () => e.theirsOnly ? crossSearchSelectSvc(other, encodeURIComponent(e.svc)) : searchSelectSvc(encodeURIComponent(e.svc)),
  });

  // ③ 이어지는 검색어 — 화면 이름을 합쳐 많은 순
  const patMap = new Map();
  for (const item of DISPLAY_DATA) {
    const pat = extractPattern(item.name).replace(/\s+/g, ' ').trim();
    if (!has(pat) || normCat(pat) === nq) continue;
    const k = normCat(pat), e = patMap.get(k) || { forms: new Map(), n: 0 };
    e.n++; e.forms.set(pat, (e.forms.get(pat) || 0) + 1); patMap.set(k, e);
  }
  const pats = [...patMap.values()].map(e => ({ text: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], n: e.n }))
    .sort((a, b) => b.n - a.n || a.text.length - b.text.length);
  for (const p of pats.slice(0, Math.max(0, AC_MAX - rows.length))) rows.push({
    icon: 'q', title: acBold(p.text, q), cnt: p.n.toLocaleString('ko-KR'),
    pick: () => runSearch(p.text),
  });

  AC.rows = rows; AC.active = -1;
  if (!rows.length) return `<div class="ac-empty">'${acEsc(q)}'와 이름이 맞는 항목이 없어요</div>`;
  return `<div class="ac-list">` + rows.map((r, i) => `
    <div class="ac-row" data-i="${i}" onmousedown="event.preventDefault()" onmouseenter="acSetActive(${i})" onclick="acPick(${i})">
      <span class="ac-ic">${AC_SVG[r.icon]}</span>
      <span class="ac-title">${r.title}</span>
      <span class="ac-cnt">${r.cnt || ''}</span>
    </div>`).join('') + `</div>`;
}

function acSetActive(i) {
  AC.active = i;
  document.querySelectorAll('#searchDrop .ac-row').forEach(r => r.classList.toggle('on', +r.dataset.i === i));
}
function acPick(i) { const r = AC.rows[i]; if (r) r.pick(); }

// 검색창 키: ↑↓ 줄 이동, Enter = 고른 줄 또는 전체 결과. 처리했으면 true
function acKey(e) {
  if (e.isComposing) return false;
  const open = document.getElementById('searchDrop').classList.contains('open');
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && open && AC.rows.length) {
    e.preventDefault();
    const n = AC.rows.length, d = e.key === 'ArrowDown' ? 1 : -1;
    acSetActive(AC.active < 0 ? (d > 0 ? 0 : n - 1) : (AC.active + d + n) % n);
    return true;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (open && AC.active >= 0) acPick(AC.active); else runSearch(e.target.value);
    return true;
  }
  return false;
}
