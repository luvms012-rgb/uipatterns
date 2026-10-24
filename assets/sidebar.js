// 사이드바 (mo/web 공용) — uibowl 구성: UI 패턴(그룹별) → 컴포넌트 → 카테고리 유형
// 분류 기준은 각 플랫폼의 taxonomy.js (PATTERN_GROUPS · CAT_ALIAS · COMPONENTS).
// 필터 상태는 index.html의 S(checked · checkedComps · checkedTypes)를 그대로 쓴다.

const SB_COLLAPSE_KEY = 'uip_sb_collapsed_v1';
const SB = { q: { pat: '', comp: '' }, collapsed: null };

// ㆍ(U+318D)·・·(U+00B7) 같은 가운뎃점과 띄어쓰기 차이를 무시하고 비교
function normCat(s) {
  return s.normalize('NFC').replace(/[ㆍ・·‧∙]/g, '·').replace(/\s+/g, '').toLowerCase();
}

// 로컬 카테고리 → { label: 사이드바 표시명(uibowl 표기), group: 그룹명 }
let _catMeta = null;
function catMeta() {
  if (_catMeta) return _catMeta;
  const byNorm = new Map();
  PATTERN_GROUPS.forEach(g => g.cats.forEach(c => byNorm.set(normCat(c), { label: c, group: g.name })));
  _catMeta = {};
  for (const cat of ALL_CATS) {
    const alias = CAT_ALIAS[cat];
    _catMeta[cat] = byNorm.get(normCat(alias || cat)) || { label: alias || cat, group: '기타 패턴' };
  }
  return _catMeta;
}
function catLabel(cat) { return (catMeta()[cat] || {}).label || cat; }

// 이미지별 컴포넌트(comps) 집계 — 데이터가 아직 없으면 전부 0
let _compCounts = null;
function compCounts() {
  if (_compCounts) return _compCounts;
  _compCounts = {};
  for (const item of DISPLAY_DATA) for (const c of (item.comps || [])) _compCounts[c] = (_compCounts[c] || 0) + 1;
  return _compCounts;
}

function sbCollapsed() {
  if (!SB.collapsed) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SB_COLLAPSE_KEY)); } catch (_) {}
    // 처음 방문: 컴포넌트는 아직 데이터가 없으면 접어 둔다 (0개 목록이 길게 늘어지지 않도록)
    SB.collapsed = new Set(Array.isArray(saved) ? saved : (Object.keys(compCounts()).length ? [] : ['comp']));
  }
  return SB.collapsed;
}
function toggleSbGroup(id) {
  const c = sbCollapsed();
  c.has(id) ? c.delete(id) : c.add(id);
  try { localStorage.setItem(SB_COLLAPSE_KEY, JSON.stringify([...c])); } catch (_) {}
  const el = document.querySelector(`.sb-grp[data-id="${CSS.escape(id)}"]`);
  if (el) el.classList.toggle('collapsed', c.has(id));
}

const CHECK_SVG = `<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="1.5 6 5 9.5 10.5 2.5"/></svg>`;
const CHEVRON_SVG = `<svg class="sb-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
const SEARCH_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;

function makeCatRow(label, count, isOn, onclickAttr, disabled) {
  return `<div class="cat-row${isOn ? ' on' : ''}${disabled ? ' disabled' : ''}" data-label="${label.replace(/"/g, '&quot;')}" ${disabled ? '' : onclickAttr}>
    <div class="cb-box">${isOn ? CHECK_SVG : ''}</div>
    <span class="cat-label">${label}</span>
    <span class="cat-cnt">(${count})</span>
  </div>`;
}

function sbGroup(id, title, rowsHtml, { sub = false, note = '' } = {}) {
  const collapsed = sbCollapsed().has(id);
  return `<div class="sb-grp${sub ? ' sub' : ''}${collapsed ? ' collapsed' : ''}" data-id="${id}">
    <button class="sb-grp-hdr" onclick="toggleSbGroup('${id.replace(/'/g, "\\'")}')" aria-expanded="${!collapsed}">
      <span class="sb-grp-title">${title}</span>${CHEVRON_SVG}
    </button>
    <div class="sb-grp-body">${note}${rowsHtml}</div>
  </div>`;
}

function sbSearch(key, placeholder) {
  return `<label class="sb-search">${SEARCH_SVG}
    <input type="search" placeholder="${placeholder}" value="${SB.q[key].replace(/"/g, '&quot;')}" oninput="sbFilter('${key}', this.value)">
  </label>`;
}

function buildSidebar() {
  const el = document.getElementById('cat-rows');
  const meta = catMeta();

  // 1) UI 패턴 — uibowl 그룹 순서, 그룹 안은 uibowl 순서. 데이터 없는 패턴은 숨김
  const groups = PATTERN_GROUPS.map(g => ({ name: g.name, order: g.cats.map(normCat), cats: [] }));
  const etc = { name: '기타 패턴', order: [], cats: [] };
  for (const cat of ALL_CATS) (groups.find(g => g.name === meta[cat].group) || etc).cats.push(cat);
  groups.forEach(g => g.cats.sort((a, b) => g.order.indexOf(normCat(meta[a].label)) - g.order.indexOf(normCat(meta[b].label))));
  const patGroups = [...groups, etc].filter(g => g.cats.length).map(g => sbGroup('pat:' + g.name, g.name,
    g.cats.map(cat => makeCatRow(meta[cat].label, CAT_COUNTS[cat] || 0, S.checked.has(cat),
      `onclick="toggleCat('${encodeURIComponent(cat)}')"`)).join(''), { sub: true })).join('');

  // 2) 컴포넌트 — 수집된 이미지가 없으면 목록만 보여주고 선택은 막는다
  const cc = compCounts();
  const hasComps = Object.keys(cc).length > 0;
  const compRows = COMPONENTS.map(c => makeCatRow(c, cc[c] || 0, S.checkedComps.has(c),
    `onclick="toggleComp('${encodeURIComponent(c)}')"`, !cc[c])).join('');
  const compNote = hasComps ? '' : `<p class="sb-note">컴포넌트 정보는 새로 캡처하는 이미지부터 모입니다.</p>`;

  // 3) 카테고리 유형 — 맨 아래. 미분류(SVC_TYPES 미등록) 항목이 있으면 목록 끝에 자동 추가
  const typeList = TYPE_COUNTS[UNCLASSIFIED] ? [...ALL_INDUSTRY_TYPES, UNCLASSIFIED] : ALL_INDUSTRY_TYPES;
  const typeRows = typeList.map(t =>
    makeCatRow(t, TYPE_COUNTS[t] || 0, S.checkedTypes.has(t), `onclick="toggleType('${encodeURIComponent(t)}')"`)
  ).join('');

  el.innerHTML =
    `<section class="sb-sec" data-sec="pat"><div class="sb-sec-hdr">UI 패턴</div>${sbSearch('pat', '패턴 검색')}${patGroups}</section>` +
    `<section class="sb-sec" data-sec="comp">${sbGroup('comp', '컴포넌트', sbSearch('comp', '컴포넌트 검색') + compRows, { note: compNote })}</section>` +
    `<section class="sb-sec" data-sec="type">${sbGroup('type', '카테고리 유형', typeRows)}</section>`;

  applySbFilter('pat'); applySbFilter('comp');
}

// 사이드바 검색 — 다시 그리지 않고 행만 숨긴다 (입력 중 포커스 유지)
function sbFilter(key, v) { SB.q[key] = v; applySbFilter(key); }
function applySbFilter(key) {
  const sec = document.querySelector(`.sb-sec[data-sec="${key}"]`);
  if (!sec) return;
  const q = normCat(SB.q[key] || '');
  sec.querySelectorAll('.cat-row').forEach(r => { r.style.display = !q || normCat(r.dataset.label).includes(q) ? '' : 'none'; });
  if (key === 'pat') {
    sec.querySelectorAll('.sb-grp').forEach(g => {
      const any = [...g.querySelectorAll('.cat-row')].some(r => r.style.display !== 'none');
      g.style.display = any ? '' : 'none';
      g.classList.toggle('searching', !!q);  // 검색 중에는 접힌 그룹도 펼쳐 보여준다
    });
  }
}

function toggleComp(enc) {
  S.selected.clear(); document.getElementById('select-bar').classList.remove('open');
  const c = decodeURIComponent(enc);
  S.checkedComps.has(c) ? S.checkedComps.delete(c) : S.checkedComps.add(c);
  S.view = 'index'; S.svc = null;
  buildSidebar(); render(); syncUrl();
  window.scrollTo({ top: 0, behavior: 'auto' });
  closeSidebarOnMobile();
}
