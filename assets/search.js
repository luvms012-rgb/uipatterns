// 검색 결과 페이지 (mo/web 공용) — 시안 1 (mockups/search.html, 2026-10-28 결정)
// 검색창에 입력하고 엔터 → '검색어' 검색 결과. 칩·탭·설명 없이 결과를 섹션으로 이어서 보여준다.
//   1) 이름이 맞는 카테고리: 그 카테고리 화면 전체
//   2) 이름이 맞는 서비스: 서비스당 카드 1장 (누르면 서비스 화면)
//   3) 패턴명(파일명의 화면 이름)이 맞는 화면 — 1)에서 이미 보여준 카테고리는 뺀다
// 상태는 index.html 의 S (view: 'search', q). 주소는 #q=검색어

// opts.focus = 'pat' 이면 결과 페이지의 화면 이름 섹션으로 내려간다 (자동완성 "패턴 전체보기")
function runSearch(q, opts) {
  q = (q || '').trim();
  closeSearchDrop();
  S.selected.clear(); document.getElementById('select-bar').classList.remove('open');
  if (!q) { S.q = ''; if (S.view === 'search') backToIndex(); return; }
  if (q.length >= 2) aTrack('search', { q });
  S.q = q; S.view = 'search'; S.svc = null;
  S.checked.clear(); S.checkedComps.clear(); S.checkedColors.clear(); S.checkedTypes.clear();
  document.getElementById('hdrSearchInput').value = q;
  document.getElementById('hdrSearchInput').blur();
  window.scrollTo({ top: 0, behavior: 'auto' });
  S.srFocus = (opts && opts.focus) || null;  // renderSearch 가 위 섹션을 다 채운 뒤 그 섹션으로 내려간다
  buildSidebar(); render(); syncUrl();
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
  // 섹션: [제목, 개수 글자, 카드 HTML 배열, 종류]
  const sections = [];
  for (const cat of cats) {
    const items = DISPLAY_DATA.filter(i => i.category === cat);
    sections.push([`'${esc(catLabel(cat))}' 카테고리`, `${items.length.toLocaleString('ko-KR')}장`, items.map(i => cardTpl(i, ec)), 'cat']);
  }
  if (svcs.length) sections.push([`'${esc(q)}' 서비스`, `${svcs.length}개`, svcs.map(([svc, items]) => searchSvcCard(svc, items)), 'svc']);
  if (pats.length) sections.push([`'${esc(q)}' 화면 이름`, `${pats.length.toLocaleString('ko-KR')}장`, pats.map(i => cardTpl(i, ec)), 'pat']);

  const token = ++_renderToken;
  resetLazyObservers();
  if (!sections.length) {
    g.innerHTML = `<div class="ds-empty empty">
      <span class="ds-empty__media"><i class="ds-icon ds-icon--search" aria-hidden="true"></i></span>
      <p class="ds-empty__title">'${esc(q)}' 검색 결과가 없습니다</p>
    </div>`;
    return;
  }

  // 섹션 틀을 먼저 그리고, 카드는 섹션 순서대로 조금씩 채운다 (한 카테고리가 수천 장일 수 있음)
  g.innerHTML = sections.map(([title, cnt, , kind], k) => `<section class="sr-sec${k ? '' : ' first'}" data-kind="${kind}">
    <div class="sr-sec-hdr"><span class="sr-sec-title">${title}</span><span class="sr-sec-cnt">${cnt}</span></div>
    <div class="mini-grid" data-sr="${k}"></div>
  </section>`).join('');
  const grids = [...g.querySelectorAll('.mini-grid[data-sr]')];
  // 그리는 도중 render() 가 다시 불릴 수 있어 내려간 뒤에야 S.srFocus 를 지운다
  let focusK = sections.findIndex(x => x[3] === S.srFocus);
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
    if (focusK >= 0 && s >= focusK) { grids[focusK].parentElement.scrollIntoView({ block: 'start' }); focusK = -1; S.srFocus = null; }
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

// ── 검색 자동완성 (2026-10-29 사용자 첨부 그림대로) ──────────────────────────
// ① 전체보기: '검색어' 전체 결과 (검색 결과 페이지와 같은 화면 수)
// ② UX 패턴: '검색어' 패턴 전체보기 (결과 페이지의 화면 이름 섹션으로) → "카테고리 - 화면 이름" 줄, 화면 수 많은 순
// 검색어는 파란 글자, 나머지는 굵게. AI 이미지 분석(화면 속 글자) 줄은 넣지 않는다.
// 아이콘은 그림 기호만 쓴다 — 입력할 때마다 회사 서버 이미지를 부르지 않도록 (웹방화벽)
const AC_MAX = 6;
const AC = { rows: [], active: -1 };

function acEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// 검색어 부분만 파란 글자
function acHi(text, q) {
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (!m[0].length) break;
    out += acEsc(text.slice(last, m.index)) + '<em class="ac-hit">' + acEsc(m[0]) + '</em>';
    last = m.index + m[0].length;
  }
  return out + acEsc(text.slice(last));
}
const acNum = n => n.toLocaleString('ko-KR') + '개의 패턴';

function buildAutocomplete(q) {
  const nq = normCat(q);
  const has = s => !!s && normCat(s).includes(nq);
  const { cats, svcs, pats } = searchResults(q);
  const all = new Set(pats.map(i => i.path));
  for (const c of cats) for (const i of DISPLAY_DATA) if (i.category === c) all.add(i.path);
  for (const [, items] of svcs) for (const i of items) all.add(i.path);

  // "카테고리 - 화면 이름" 묶음
  const grp = new Map();
  for (const item of DISPLAY_DATA) {
    const pat = extractPattern(item.name).replace(/\s+/g, ' ').trim();
    if (!has(pat)) continue;
    const cat = catLabel(item.category), k = cat + '\u0000' + normCat(pat);
    const e = grp.get(k) || { cat, pat, n: 0 };
    e.n++; grp.set(k, e);
  }
  const rows = [...grp.values()].sort((a, b) => b.n - a.n || a.pat.length - b.pat.length).slice(0, AC_MAX);

  const ALL = all.size ? [{ tile: 'ALL', title: `${acHi(q, q)} 전체보기`, desc: acNum(all.size), pick: () => runSearch(q) }] : [];
  const UX = [];
  if (pats.length) UX.push({ title: `${acHi(q, q)} 패턴 전체보기`, desc: acNum(pats.length), pick: () => runSearch(q, { focus: 'pat' }) });
  for (const r of rows) UX.push({ title: `${acEsc(r.cat)} - ${acHi(r.pat, q)}`, desc: acNum(r.n), pick: () => runSearch(r.pat) });

  AC.rows = [...ALL, ...UX]; AC.active = -1;
  if (!AC.rows.length) return `<p class="ds-select-content__label">'${acEsc(q)}'와 이름이 맞는 항목이 없어요</p>`;
  const shot = PLATFORM === 'mo' ? 'ds-icon--smartphone' : 'ds-icon--monitor';
  let i = 0;
  const item = r => `
    <li><button type="button" class="ds-select-item ac-row" role="option" tabindex="-1" data-i="${i}" onmousedown="event.preventDefault()" onmouseenter="acSetActive(${i})" onclick="acPick(${i++})">
      <span class="ac-tile" aria-hidden="true">${r.tile || `<i class="ds-icon ${shot}"></i>`}</span>
      <span class="ds-select-item__body"><span class="ds-select-item__label ac-title">${r.title}</span><span class="ds-select-item__desc">${r.desc}</span></span>
    </button></li>`;
  return (ALL.length ? `<div class="ds-select-content__group"><ul class="ds-select-list">${ALL.map(item).join('')}</ul></div>` : '')
    + (UX.length ? `<div class="ds-select-content__group" role="group" aria-labelledby="ac-ux"><div class="ds-select-content__label" id="ac-ux">UX 패턴</div><ul class="ds-select-list">${UX.map(item).join('')}</ul></div>` : '');
}

function acSetActive(i) {
  AC.active = i;
  document.querySelectorAll('#searchDrop .ac-row').forEach(r => r.toggleAttribute('data-highlighted', +r.dataset.i === i));
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
