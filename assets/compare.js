// 나란히 비교 (mo/web 공용, 2026-11-02) — 화면 여러 장을 한 줄로 놓고 보기
//   1) 고른 화면 바의 "나란히 비교": 고른 2장 이상
//   2) 툴바의 "서비스별 비교": 지금 필터 결과에서 서비스마다 1장씩 (예: 장바구니 카테고리를 서비스별로)
//   3) 모음 링크: 비교 화면의 "링크 복사" → 주소 #pick=경로|경로… 로 들어오면 그 화면들로 바로 비교가 열린다
// 화면 틀은 처음 열 때 만든다 (index.html 은 버튼과 이 파일 불러오기만)
const CMP = { paths: [], title: '' };
const CMP_LINK_MAX = 40;   // 링크 하나에 담는 최대 장수 (주소 길이)

function cmpIsOpen() { const el = document.getElementById('compare'); return !!el && el.classList.contains('open'); }

function cmpEnsure() {
  let el = document.getElementById('compare');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'compare';
  el.className = 'cmp cmp--' + PLATFORM;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'cmp-title');
  el.innerHTML = `
    <div class="cmp-head">
      <span class="cmp-title" id="cmp-title"></span><span class="cmp-cnt" id="cmp-cnt"></span>
      <div class="cmp-actions">
        <button type="button" class="ds-btn" data-variant="neutralWeak" data-size="small" onclick="cmpCopyLink()"><i class="ds-icon ds-icon--link" aria-hidden="true"></i>링크 복사</button>
        <button type="button" class="ds-btn" data-variant="neutralWeak" data-size="small" data-layout="iconOnly" onclick="cmpClose()" aria-label="닫기"><i class="ds-icon ds-icon--x" aria-hidden="true"></i></button>
      </div>
    </div>
    <div class="cmp-row" id="cmp-row"></div>`;
  document.body.appendChild(el);
  return el;
}

// paths: 화면 경로 목록, title: 머리 글자
function cmpOpen(paths, title) {
  CMP.paths = [...new Set(paths)].filter(p => DATA_BY_PATH.has(p));
  CMP.title = title || '나란히 비교';
  if (!CMP.paths.length) return;
  const el = cmpEnsure();
  cmpRender();
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('cmp-row').scrollLeft = 0;
  syncUrl();
}

function cmpRender() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const ec = encodeURIComponent;
  document.getElementById('cmp-title').textContent = CMP.title;
  document.getElementById('cmp-cnt').textContent = CMP.paths.length + '장';
  const row = document.getElementById('cmp-row');
  row.style.setProperty('--cmp-n', Math.min(CMP.paths.length, 2));   // 웹 화면: 한 화면에 2장씩 (가로로 넘겨 나머지)
  row.innerHTML = CMP.paths.map((p, i) => {
    const item = DATA_BY_PATH.get(p);
    const svc = extractService(item.name), pat = extractPattern(item.name);
    return `<figure class="cmp-col">
      <div class="cmp-shot">
        <img src="${imgUrl(p)}" alt="${esc(item.name)}" loading="lazy" decoding="async" />
        <button type="button" class="ds-btn cmp-remove" data-variant="neutralWeak" data-size="xsmall" data-layout="iconOnly" onclick="cmpRemove(${i})" aria-label="이 화면 빼기" title="빼기"><i class="ds-icon ds-icon--x" aria-hidden="true"></i></button>
      </div>
      <figcaption class="cmp-cap">
        <button type="button" class="cmp-svc" onclick="cmpGoSvc('${ec(svc)}')" title="${esc(svc)} 전체 화면">${esc(svc)}</button>
        <span class="cmp-sub">${esc(catLabel(item.category))}${pat ? ' / ' + esc(pat) : ''}</span>
      </figcaption>
    </figure>`;
  }).join('');
}

function cmpRemove(i) {
  CMP.paths.splice(i, 1);
  if (!CMP.paths.length) { cmpClose(); return; }
  cmpRender(); syncUrl();
}

function cmpClose() {
  const el = document.getElementById('compare');
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
  syncUrl();
}

function cmpGoSvc(enc) { cmpClose(); lbGo('svc', enc); }

async function cmpCopyLink() {
  const paths = CMP.paths.slice(0, CMP_LINK_MAX);
  const url = new URL('../' + PLATFORM + '/', location.href).href + '#' + new URLSearchParams({ pick: paths.join('|') }).toString();
  try { await navigator.clipboard.writeText(url); }
  catch {  // 클립보드 권한이 없을 때
    const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch {} t.remove();
  }
  showToast(CMP.paths.length > CMP_LINK_MAX ? `앞의 ${CMP_LINK_MAX}장만 링크에 담았어요` : `${paths.length}장 모음 링크를 복사했어요`);
}

// 1) 고른 화면 바
function cmpSelected() {
  const paths = DISPLAY_DATA.filter(i => S.selected.has(i.path)).map(i => i.path);
  if (paths.length < 2) { showToast('2장 이상 고르면 나란히 볼 수 있어요'); return; }
  cmpOpen(paths, '고른 화면 비교');
}

// 2) 지금 필터 결과에서 서비스마다 1장씩 (목록과 같은 순서: 최근 캡처한 서비스 먼저)
function cmpBySvcPaths() {
  const first = new Map(), latest = new Map();
  for (const item of getItems()) {
    const svc = extractService(item.name), d = item.name.split('_').pop();
    if (!first.has(svc)) first.set(svc, item.path);
    if (d > (latest.get(svc) || '')) latest.set(svc, d);
  }
  return [...first.keys()].sort((a, b) => (latest.get(b) || '').localeCompare(latest.get(a) || '') || sortMixed(a, b)).map(s => first.get(s));
}
function cmpBySvc() {
  const label = [...S.checked].map(catLabel).concat([...S.checkedComps], [...S.checkedColors], [...S.checkedTypes]).map(x => `'${x}'`).join(', ');
  cmpOpen(cmpBySvcPaths(), `${label} 서비스별 비교`);
}
// render() 가 부른다: 필터 결과에 서비스가 2개 이상일 때만 툴바에 버튼을 보인다
function cmpSyncToolbar() {
  const btn = document.getElementById('cmpBySvcBtn');
  if (!btn) return;
  const filtered = S.view === 'index' && (S.checked.size || S.checkedComps.size || S.checkedColors.size || S.checkedTypes.size);
  btn.hidden = !(filtered && new Set(getItems().map(i => extractService(i.name))).size >= 2);
}

// 3) 모음 링크로 들어왔을 때 (readUrl 이 넣어 둠)
let _pendingPick = null;
function openPendingPick() {
  const p = _pendingPick; _pendingPick = null;
  if (p && p.length) cmpOpen(p, '모음');
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !cmpIsOpen()) return;
  if (document.getElementById('lightbox').classList.contains('open')) return;
  cmpClose();
});
