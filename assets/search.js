// 검색 결과 페이지 (mo/web 공용) — 시안 1 (mockups/search.html, 2026-10-28 결정) + 조합 검색 (2026-10-30)
// 검색창에 입력하고 엔터 → '검색어' 검색 결과. 칩·탭·설명 없이 결과를 섹션으로 이어서 보여준다.
// 단어 하나:
//   1) 이름이 맞는 카테고리: 그 카테고리 화면 전체
//   2) 이름이 맞는 서비스: 서비스당 카드 1장 (누르면 서비스 화면)
//   3) 업종 / 컴포넌트: 그 업종의 서비스, 그 컴포넌트가 있는 화면
//   4) 패턴명(파일명의 화면 이름)이 맞는 화면 — 1)에서 이미 보여준 카테고리는 뺀다
//   5) 컬러: 그 색 화면
// 여러 단어 (쉼표, +, 띄어쓰기): 단어마다 위 어느 것이든 맞는 화면만 한 섹션으로. 없으면 단어 하나씩 보기를 안내
// 비슷한 말은 synonyms.js. 정확히 맞는 것(이름 전체 > 낱말 > 낱말 앞부분 > 일부) 먼저 보여준다.
// 상태는 index.html 의 S (view: 'search', q). 주소는 #q=검색어

// opts.focus = 'pat' 이면 결과 페이지의 화면 이름 섹션으로 내려간다 (자동완성 "패턴 전체보기")
function runSearch(q, opts) {
  q = (q || '').trim();
  closeSearchDrop();
  S.selected.clear(); document.getElementById('select-bar').classList.remove('open');
  if (!q) { S.q = ''; if (S.view === 'search') backToIndex(); return; }
  if (q.length >= 2) aTrack('search', { q });
  srRemember(q);
  S.q = q; S.view = 'search'; S.svc = null;
  S.checked.clear(); S.checkedComps.clear(); S.checkedColors.clear(); S.checkedTypes.clear();
  document.getElementById('hdrSearchInput').value = q;
  document.getElementById('hdrSearchInput').blur();
  window.scrollTo({ top: 0, behavior: 'auto' });
  S.srFocus = (opts && opts.focus) || null;  // renderSearch 가 위 섹션을 다 채운 뒤 그 섹션으로 내려간다
  buildSidebar(); render(); syncUrl();
}

// ── 찾기 ──────────────────────────────────────────────────────────────────
// 이름 = 전체(띄어쓰기 없이) + 낱말들. 낱말은 띄어쓰기, &, /, 괄호, - 로 나눈다
function srName(s) {
  s = String(s || '');
  return { w: normCat(s), t: s.split(/[&·ㆍ・\s\/()\-]+/).map(normCat).filter(Boolean) };
}
// 단어가 이름에 얼마나 맞는지: 이름 전체 4, 낱말 하나 3, 낱말 앞부분 2, 일부 1, 안 맞음 0
function srNameScore(n, w) {
  if (!w || !n.w.includes(w)) return 0;
  if (n.w === w) return 4;
  if (n.t.includes(w)) return 3;
  if (n.t.some(x => x.startsWith(w))) return 2;
  return 1;
}

// 화면마다 찾을 이름을 한 번만 만들어 둔다
let _srIdx = null;
function srIndex() {
  if (_srIdx) return _srIdx;
  return (_srIdx = DISPLAY_DATA.map(item => {
    const svc = extractService(item.name);
    const x = {
      item, svc,
      cat: [srName(item.category), srName(catLabel(item.category))],
      sv: srName(svc), pat: srName(extractPattern(item.name)),
      comp: (item.comps || []).map(srName), type: srName(getSvcType(svc)), color: normCat(item.color || ''),
    };
    x.all = [x.sv.w, x.pat.w, x.type.w, x.color, ...x.cat.map(n => n.w), ...x.comp.map(n => n.w)].join('|');  // 빨리 거르기용
    return x;
  }));
}
// 첫 검색이 느리지 않게 페이지가 한가할 때 미리 만든다 (모바일 5.7만 장 약 0.3초)
(window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => { if (typeof DISPLAY_DATA !== 'undefined') srIndex(); });

let _srSvcItems = null;
function srSvcItems() {
  if (_srSvcItems) return _srSvcItems;
  _srSvcItems = new Map();
  for (const x of srIndex()) { if (!_srSvcItems.has(x.svc)) _srSvcItems.set(x.svc, []); _srSvcItems.get(x.svc).push(x.item); }
  return _srSvcItems;
}

// 검색어 한 단어 → 비슷한 말까지 (words: 서비스 말고 전부에서 찾을 말, svcs: 서비스 이름에서 찾을 말). 첫 번째가 입력한 말
function srTerm(t) {
  const n = normCat(t);
  const grp = list => list.find(g => g.some(w => normCat(w) === n)) || [];
  const syn = grp(typeof SEARCH_SYNONYMS !== 'undefined' ? SEARCH_SYNONYMS : []);  // synonyms.js 를 못 불러와도 검색은 되게
  const ali = grp(typeof SERVICE_ALIASES !== 'undefined' ? SERVICE_ALIASES : []);
  return {
    t, n,
    words: [...new Set([n, ...syn.map(normCat)])],
    svcs: [...new Set([n, ...ali.map(normCat)])],
    alts: [...new Set([...syn, ...ali].filter(w => normCat(w) !== n))],
  };
}

// 화면 하나가 단어에 얼마나 맞는지 (0 = 안 맞음). 비슷한 말로 맞으면 조금 뒤로
// 카테고리, 서비스, 화면 이름은 일부만 맞아도 되고, 컴포넌트, 업종, 컬러는 이름이나 낱말이 그대로 맞아야 한다
function srScore(x, v) {
  if (!v.words.some(w => x.all.includes(w)) && !v.svcs.some(w => x.sv.w.includes(w))) return 0;
  let best = 0;
  const up = (s, syn) => { if (s) best = Math.max(best, s - (syn ? 0.5 : 0)); };
  v.svcs.forEach((w, k) => up(srNameScore(x.sv, w), k > 0));
  v.words.forEach((w, k) => {
    const syn = k > 0;
    for (const c of x.cat) up(srNameScore(c, w), syn);
    up(srNameScore(x.pat, w), syn);
    for (const c of x.comp) { const s = srNameScore(c, w); if (s >= 3) up(s, syn); }
    const ts = srNameScore(x.type, w); if (ts >= 3) up(ts, syn);
    if (x.color && x.color === w) up(3, syn);
  });
  return best;
}

// 검색어 → 단어들. 쉼표, + 는 항상 나누고, 띄어쓰기는 붙인 말이 이름 그대로 있으면(네이버 지도, 빈 화면) 한 단어로 둔다
function srTerms(q) {
  const out = [];
  for (const part of String(q || '').split(/[,，+]/).map(s => s.trim()).filter(Boolean)) {
    if (/\s/.test(part)) {
      const v = srTerm(part);
      if (!srIndex().some(x => srScore(x, v) >= 3.5)) { out.push(...part.split(/\s+/)); continue; }
    }
    out.push(part);
  }
  const seen = new Set();
  return out.filter(t => { const n = normCat(t); return n && !seen.has(n) && seen.add(n); }).map(srTerm);
}

// 점수 높은 것 먼저 (같으면 원래 순서)
const srByScore = arr => arr.map((e, i) => [e, i]).sort((a, b) => b[0][1] - a[0][1] || a[1] - b[1]).map(([e]) => e[0]);

function searchResults(q) {
  const terms = srTerms(q);
  const r = { terms, multi: terms.length > 1, cats: [], svcs: [], types: [], comps: { names: [], items: [] }, pats: [], colors: { names: [], items: [] }, combo: [], all: new Set() };
  if (!terms.length) return r;

  if (r.multi) {
    const hit = [];
    for (const x of srIndex()) {
      let sum = 0;
      for (const v of terms) { const s = srScore(x, v); if (!s) { sum = 0; break; } sum += s; }
      if (sum) hit.push([x.item, sum]);
    }
    r.combo = srByScore(hit);
    r.combo.forEach(i => r.all.add(i.path));
    return r;
  }

  const v = terms[0];
  const best = (n, list, min = 1) => Math.max(0, ...list.map((w, k) => { const s = srNameScore(n, w); return s >= min ? s - (k ? 0.5 : 0) : 0; }));

  r.cats = srByScore(ALL_CATS.map(c => [c, Math.max(best(srName(c), v.words), best(srName(catLabel(c)), v.words))]).filter(e => e[1]));
  const catSet = new Set(r.cats);

  const svcScore = new Map();
  for (const [svc] of srSvcItems()) { const s = best(srName(svc), v.svcs); if (s) svcScore.set(svc, s); }
  r.svcs = [...svcScore].sort((a, b) => b[1] - a[1] || sortMixed(a[0], b[0])).map(([svc]) => [svc, srSvcItems().get(svc)]);

  const typeNames = (typeof ALL_INDUSTRY_TYPES !== 'undefined' ? ALL_INDUSTRY_TYPES : []).filter(t => best(srName(t), v.words, 3));
  r.types = typeNames.map(t => [t, [...srSvcItems()].filter(([svc]) => getSvcType(svc) === t).sort((a, b) => sortMixed(a[0], b[0]))]).filter(e => e[1].length);

  r.comps.names = (typeof COMPONENTS !== 'undefined' ? COMPONENTS : []).filter(c => best(srName(c), v.words, 3));
  if (r.comps.names.length) r.comps.items = DISPLAY_DATA.filter(i => (i.comps || []).some(c => r.comps.names.includes(c)));

  r.colors.names = COLOR_LIST.map(c => c.name).filter(c => v.words.includes(normCat(c)));
  if (r.colors.names.length) r.colors.items = DISPLAY_DATA.filter(i => r.colors.names.includes(i.color));

  r.pats = srByScore(srIndex().filter(x => !catSet.has(x.item.category)).map(x => [x.item, best(x.pat, v.words)]).filter(e => e[1]));

  for (const c of r.cats) for (const i of DISPLAY_DATA) if (i.category === c) r.all.add(i.path);
  for (const [, items] of r.svcs) items.forEach(i => r.all.add(i.path));
  for (const [, svcs] of r.types) for (const [, items] of svcs) items.forEach(i => r.all.add(i.path));
  for (const list of [r.comps.items, r.pats, r.colors.items]) list.forEach(i => r.all.add(i.path));
  return r;
}

// "비슷한 말도 함께 찾았어요" 한 줄 (없으면 빈 글자)
function srSynNote(terms, esc) {
  const parts = terms.filter(v => v.alts.length).map(v => `${esc(v.t)} → ${v.alts.map(esc).join(', ')}`);
  return parts.length ? `<p class="sr-note">비슷한 말도 함께 찾았어요: ${parts.join(' / ')}</p>` : '';
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
  const num = n => n.toLocaleString('ko-KR');
  const q = S.q;
  const r = searchResults(q);
  const qt = r.terms.length ? r.terms.map(v => `'${esc(v.t)}'`).join(' + ') : `'${esc(q)}'`;
  document.getElementById('detail-header').style.display = 'none';
  setToolbarTitle(`${qt} 검색 결과`);
  g.classList.add('filter-mode');

  // 섹션: [제목, 개수 글자, 카드 HTML 배열, 종류]
  const sections = [];
  if (r.multi) {
    if (r.combo.length) sections.push([`${qt} 모두 맞는 화면`, `${num(r.combo.length)}장`, r.combo.map(i => cardTpl(i, ec)), 'combo']);
  } else {
    for (const cat of r.cats) {
      const items = DISPLAY_DATA.filter(i => i.category === cat);
      sections.push([`'${esc(catLabel(cat))}' 카테고리`, `${num(items.length)}장`, items.map(i => cardTpl(i, ec)), 'cat']);
    }
    if (r.svcs.length) sections.push([`'${esc(q)}' 서비스`, `${r.svcs.length}개`, r.svcs.map(([svc, items]) => searchSvcCard(svc, items)), 'svc']);
    for (const [type, svcs] of r.types) sections.push([`'${esc(type)}' 업종`, `서비스 ${svcs.length}개`, svcs.map(([svc, items]) => searchSvcCard(svc, items)), 'type']);
    if (r.comps.items.length) sections.push([`${r.comps.names.map(c => `'${esc(c)}'`).join(', ')} 컴포넌트`, `${num(r.comps.items.length)}장`, r.comps.items.map(i => cardTpl(i, ec)), 'comp']);
    if (r.pats.length) sections.push([`'${esc(q)}' 화면 이름`, `${num(r.pats.length)}장`, r.pats.map(i => cardTpl(i, ec)), 'pat']);
    if (r.colors.items.length) sections.push([`${r.colors.names.map(c => `'${esc(c)}'`).join(', ')} 컬러`, `${num(r.colors.items.length)}장`, r.colors.items.map(i => cardTpl(i, ec)), 'color']);
  }

  const token = ++_renderToken;
  resetLazyObservers();
  if (!sections.length) {
    // 여러 단어인데 모두 맞는 화면이 없으면 단어 하나씩 보기를 안내
    const each = r.multi ? r.terms.map(v => [v.t, searchResults(v.t).all.size]).filter(e => e[1]) : [];
    const acts = each.map(([t, n]) => `<button type="button" class="ds-btn" data-variant="neutralWeak" data-size="small" data-q="${esc(t)}" onclick="runSearch(this.dataset.q)">${esc(t)}만 보기 <span class="sr-btn-cnt">${num(n)}</span></button>`).join('');
    g.innerHTML = `<div class="ds-empty empty">
      <span class="ds-empty__media"><i class="ds-icon ds-icon--search" aria-hidden="true"></i></span>
      <p class="ds-empty__title">${r.multi ? `${qt} 모두 맞는 화면이 없습니다` : `${qt} 검색 결과가 없습니다`}</p>
      ${r.multi ? `<p class="ds-empty__desc">${acts ? '단어 하나씩 볼 수 있어요' : '다른 말로 찾아보세요'}</p>` : ''}
      ${acts ? `<div class="ds-empty__actions">${acts}</div>` : ''}
    </div>`;
    return;
  }

  // 섹션 틀을 먼저 그리고, 카드는 섹션 순서대로 조금씩 채운다 (한 카테고리가 수천 장일 수 있음)
  g.innerHTML = srSynNote(r.terms, esc) + sections.map(([title, cnt, , kind], k) => `<section class="sr-sec${k ? '' : ' first'}" data-kind="${kind}">
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

// ── 최근 검색어 (이 브라우저에만 저장) ─────────────────────────────────────
const SR_RECENT_KEY = 'uip_recent_q';
function srRecent() {
  try { const a = JSON.parse(localStorage.getItem(SR_RECENT_KEY)); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (_) { return []; }
}
function srRemember(q) {
  try { localStorage.setItem(SR_RECENT_KEY, JSON.stringify([q, ...srRecent().filter(x => x !== q)].slice(0, 5))); } catch (_) {}
}
function srForget() {
  try { localStorage.removeItem(SR_RECENT_KEY); } catch (_) {}
  onSearchInput('');
}

// 빈 검색창 추천 조합 — 이 사이트에서 결과가 있는 것만 4개
const SR_EXAMPLES = ['지도, 리스트', '쿠팡 장바구니', '금융 온보딩', '블랙 메인', '바텀시트 결제', '토스 로그인', '배달 리뷰', '카트'];
let _srExamples = null;
function srExamples() {
  if (!_srExamples) _srExamples = SR_EXAMPLES.map(q => [q, searchResults(q).all.size]).filter(e => e[1]).slice(0, 4);
  return _srExamples;
}

// ── 검색 자동완성 (2026-10-29 사용자 첨부 그림대로, 10-30 조합 검색) ──────────
// 단어 하나: ① 전체보기 ② UX 패턴: '검색어' 패턴 전체보기 → "카테고리 - 화면 이름" 줄 (정확히 맞는 것, 화면 수 많은 순)
// 여러 단어: ① 조합 보기 ② 단어별로 보기
// 빈 검색창: 최근 검색어, 이렇게 찾아보세요(추천 조합)
// 검색어는 파란 글자, 나머지는 굵게. AI 이미지 분석(화면 속 글자) 줄은 넣지 않는다.
// 아이콘은 그림 기호만 쓴다 — 입력할 때마다 회사 서버 이미지를 부르지 않도록 (웹방화벽)
const AC_MAX = 6;
const AC = { rows: [], active: -1 };

function acEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// 찾은 말 부분만 파란 글자 (words: 입력한 말과 비슷한 말)
function acHi(text, words) {
  const ws = [].concat(words).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ws.length) return acEsc(text);
  const re = new RegExp(ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (!m[0].length) break;
    out += acEsc(text.slice(last, m.index)) + '<em class="ac-hit">' + acEsc(m[0]) + '</em>';
    last = m.index + m[0].length;
  }
  return out + acEsc(text.slice(last));
}
const acNum = n => n.toLocaleString('ko-KR') + '개의 패턴';

// 묶음들 → 드롭다운 HTML. 줄은 AC.rows 에 모여 ↑↓ 로 고를 수 있다
function acRender(groups) {
  AC.rows = []; AC.active = -1;
  const shot = PLATFORM === 'mo' ? 'ds-icon--smartphone' : 'ds-icon--monitor';
  return groups.filter(gr => gr.rows.length).map((gr, k) => {
    const items = gr.rows.map(r => {
      const i = AC.rows.push(r) - 1;
      return `
    <li><button type="button" class="ds-select-item ac-row" role="option" tabindex="-1" data-i="${i}" onmousedown="event.preventDefault()" onmouseenter="acSetActive(${i})" onclick="acPick(${i})">
      <span class="ac-tile" aria-hidden="true">${r.tile || `<i class="ds-icon ${shot}"></i>`}</span>
      <span class="ds-select-item__body"><span class="ds-select-item__label ac-title">${r.title}</span>${r.desc ? `<span class="ds-select-item__desc">${r.desc}</span>` : ''}</span>
    </button></li>`;
    }).join('');
    const label = gr.label ? `<div class="ds-select-content__label ac-label" id="ac-g${k}"><span>${gr.label}</span>${gr.extra || ''}</div>` : '';
    return `<div class="ds-select-content__group"${gr.label ? ` role="group" aria-labelledby="ac-g${k}"` : ''}>${label}<ul class="ds-select-list">${items}</ul></div>`;
  }).join('');
}

function buildAutocomplete(q) {
  const r = searchResults(q);
  const hiWords = v => [v.t, ...v.alts];

  if (r.multi) {
    const qt = r.terms.map(v => `<em class="ac-hit">${acEsc(v.t)}</em>`).join(' + ');
    return acRender([
      { rows: [{ tile: 'ALL', title: `${qt} 조합 보기`, desc: acNum(r.all.size), pick: () => runSearch(q) }] },
      { label: '단어 하나씩 보기', rows: r.terms.map(v => ({ title: `${acHi(v.t, v.t)} 전체보기`, desc: acNum(searchResults(v.t).all.size), pick: () => runSearch(v.t) })) },
    ]);
  }

  const v = r.terms[0];
  if (!v || !r.all.size) return `<p class="ds-select-content__label">'${acEsc(q)}'와 이름이 맞는 항목이 없어요</p>`;

  // "카테고리 - 화면 이름" 묶음: 정확히 맞는 이름 먼저, 같으면 화면 수 많은 순
  const grp = new Map();
  for (const x of srIndex()) {
    const s = Math.max(0, ...v.words.map((w, k) => { const sc = srNameScore(x.pat, w); return sc ? sc - (k ? 0.5 : 0) : 0; }));
    if (!s) continue;
    const pat = extractPattern(x.item.name).replace(/\s+/g, ' ').trim();
    const cat = catLabel(x.item.category), key = cat + '\u0000' + x.pat.w;
    const e = grp.get(key) || { cat, pat, s, n: 0 };
    e.n++; grp.set(key, e);
  }
  const rows = [...grp.values()].sort((a, b) => b.s - a.s || b.n - a.n || a.pat.length - b.pat.length).slice(0, AC_MAX);

  const UX = [];
  if (r.pats.length) UX.push({ title: `${acHi(q, q)} 패턴 전체보기`, desc: acNum(r.pats.length), pick: () => runSearch(q, { focus: 'pat' }) });
  for (const e of rows) UX.push({ title: `${acEsc(e.cat)} - ${acHi(e.pat, hiWords(v))}`, desc: acNum(e.n), pick: () => runSearch(e.pat) });
  return acRender([
    { rows: [{ tile: 'ALL', title: `${acHi(q, q)} 전체보기`, desc: acNum(r.all.size), pick: () => runSearch(q) }] },
    { label: 'UX 패턴', rows: UX },
  ]);
}

// 빈 검색창을 눌렀을 때: 최근 검색어 + 추천 조합
function buildSearchHome() {
  const clock = '<i class="ds-icon ds-icon--clock"></i>', spark = '<i class="ds-icon ds-icon--sparkles"></i>';
  return acRender([
    { label: '최근 검색어', extra: `<button type="button" class="ds-link ac-clear" onmousedown="event.preventDefault()" onclick="srForget()">지우기</button>`,
      rows: srRecent().map(q => ({ tile: clock, title: acEsc(q), pick: () => runSearch(q) })) },
    { label: '이렇게 찾아보세요', rows: srExamples().map(([q, n]) => ({ tile: spark, title: acEsc(q), desc: acNum(n), pick: () => runSearch(q) })) },
  ]);
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
