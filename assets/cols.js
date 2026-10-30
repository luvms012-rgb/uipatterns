// ════════════════════════════════════════════
// 열 필터 — 화면 목록을 몇 열로 볼지 고른다 (기본 = 사이트 기본 열 수)
// 넓은 화면은 2~7열, 좁은 화면(768px 이하)은 1~3열. 고른 값은 이 브라우저에만, 사이트(mo/web)와 화면 폭마다 따로 기억한다
// ════════════════════════════════════════════
const COLS_SITE = location.pathname.includes('/web/') ? 'web' : 'mo';
const COLS_NARROW = window.matchMedia('(max-width: 768px)');

function colsOpts() { return COLS_NARROW.matches ? [0, 1, 2, 3] : [0, 2, 3, 4, 5, 6, 7]; } // 0 = 기본
function colsKey() { return 'uip_cols_' + COLS_SITE + (COLS_NARROW.matches ? '_s' : ''); }
function colsGet() {
  let n = 0;
  try { n = +localStorage.getItem(colsKey()) || 0; } catch (_) {}
  return colsOpts().includes(n) ? n : 0;
}

function colsApply(n) {
  const r = document.documentElement;
  if (n) { r.dataset.cols = n; r.style.setProperty('--grid-cols-user', n); }
  else { delete r.dataset.cols; r.style.removeProperty('--grid-cols-user'); }
  const v = document.getElementById('colsValue');
  if (v) v.textContent = n ? n + '열' : '기본';
  document.querySelectorAll('#colsMenu .ds-select-item').forEach(b => b.setAttribute('aria-selected', String(+b.dataset.cols === n)));
  if (typeof updateCardIntrinsic === 'function') updateCardIntrinsic();
}

function colsPick(n) {
  try { n ? localStorage.setItem(colsKey(), n) : localStorage.removeItem(colsKey()); } catch (_) {}
  colsApply(n);
  colsToggle(false);
}

function colsToggle(open) {
  const t = document.getElementById('colsTrigger'), m = document.getElementById('colsMenu');
  if (!t || !m) return;
  if (open == null) open = t.getAttribute('aria-expanded') !== 'true';
  t.setAttribute('aria-expanded', String(open));
  m.classList.toggle('open', open);
}

function colsBuild() {
  const m = document.getElementById('colsMenu');
  if (m) m.innerHTML = '<ul class="ds-select-list">' + colsOpts().map(n =>
    `<li><button type="button" class="ds-select-item" role="option" data-cols="${n}" aria-selected="false" onclick="colsPick(${n})"><span class="ds-select-item__label">${n ? n + '열' : '기본'}</span></button></li>`
  ).join('') + '</ul>';
  colsApply(colsGet());
}

document.addEventListener('click', e => { if (!e.target.closest('.cols-filter')) colsToggle(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') colsToggle(false); });
// 넓은 화면 ↔ 좁은 화면을 넘나들면 고를 수 있는 열과 기억한 값이 바뀐다
COLS_NARROW.addEventListener('change', () => { colsToggle(false); colsBuild(); });

// 페이지의 render() 보다 먼저 열 수를 정해 둔다 (이 스크립트가 페이지 스크립트보다 먼저 불린다)
document.addEventListener('DOMContentLoaded', colsBuild);
