// 사이드바 (mo/web 공용) — uibowl 구성: UI 패턴(그룹별) → 컴포넌트 → 카테고리 유형
// 분류 기준은 각 플랫폼의 taxonomy.js (PATTERN_GROUPS · CAT_ALIAS · COMPONENTS).
// 필터 상태는 index.html의 S(checked · checkedComps · checkedTypes)를 그대로 쓴다.

const SB_COLLAPSE_KEY = 'uip_sb_collapsed_v2';  // v2: 컴포넌트·카테고리 유형 기본 닫힘 (예전 저장값 무시)
const SB = { collapsed: null };

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
    // 처음 방문: 컴포넌트·카테고리 유형은 닫아 둔다 (UI 패턴만 펼침). 열고 닫은 상태는 저장된다
    SB.collapsed = new Set(Array.isArray(saved) ? saved : ['comp', 'type']);
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

const CHEVRON_SVG = `<i class="ds-icon ds-icon--sm ds-icon--chevron-up sb-chev" aria-hidden="true"></i>`;

function makeCatRow(label, count, isOn, action, disabled) {
  return `<label class="ds-checkbox cat-row" data-label="${label.replace(/"/g, '&quot;')}">
    <input type="checkbox" class="ds-checkbox__control"${isOn ? ' checked' : ''}${disabled ? ' disabled' : ''} onchange="${action}">
    <span class="ds-checkbox__label">${label}</span>
    <span class="cat-cnt">(${count})</span>
  </label>`;
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
      `toggleCat('${encodeURIComponent(cat)}')`)).join(''), { sub: true })).join('');

  // 2) 컴포넌트 — 수집된 이미지가 없으면 목록만 보여주고 선택은 막는다
  const cc = compCounts();
  const hasComps = Object.keys(cc).length > 0;
  const compRows = COMPONENTS.map(c => makeCatRow(c, cc[c] || 0, S.checkedComps.has(c),
    `toggleComp('${encodeURIComponent(c)}')`, !cc[c])).join('');
  const compNote = hasComps ? '' : `<p class="sb-note">컴포넌트 정보는 새로 캡처하는 이미지부터 모입니다.</p>`;

  // 3) 카테고리 유형 — 맨 아래. 미분류(SVC_TYPES 미등록) 항목이 있으면 목록 끝에 자동 추가
  const typeList = TYPE_COUNTS[UNCLASSIFIED] ? [...ALL_INDUSTRY_TYPES, UNCLASSIFIED] : ALL_INDUSTRY_TYPES;
  const typeRows = typeList.map(t =>
    makeCatRow(t, TYPE_COUNTS[t] || 0, S.checkedTypes.has(t), `toggleType('${encodeURIComponent(t)}')`)
  ).join('');

  // 검색은 사이드바에 두지 않는다 — 헤더 통합 검색으로 일원화 예정
  el.innerHTML =
    `<section class="sb-sec" data-sec="pat"><div class="sb-sec-hdr">UI 패턴</div>${patGroups}</section>` +
    `<section class="sb-sec" data-sec="comp">${sbGroup('comp', '컴포넌트', compRows, { note: compNote })}</section>` +
    `<section class="sb-sec" data-sec="type">${sbGroup('type', '카테고리 유형', typeRows)}</section>`;
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
