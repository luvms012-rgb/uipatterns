// 검색 도구 — Cloudflare D1(원격)과 node:sqlite(로컬)에서 똑같이 동작한다.
// db 는 { all(sql, params) → Promise<행 배열> } 하나만 있으면 된다.
//
// D1 무료 요금은 Worker 계산 시간(요청당 10ms)과 하루 읽는 행 수에 한도가 있어서
//   - 카테고리·서비스 이름은 작은 요약 표(cats·svcs)에서 먼저 정확한 이름으로 바꾼 뒤 색인으로 찾고
//   - 글자·위치 조건은 전문 검색 색인(screens_fts, 위치 구간별 열)에서 바로 찾는다 (Worker 에서 줄을 다시 훑지 않음)
import { norm, bigrams, catKey, ZONES, zoneCol } from './text.js';

const IMG_BASE = 'https://imagesisa.ybmnet.co.kr/platform/design_ybmnet_co_kr/uipatterns/';
const SITE_BASE = 'https://luvms012-rgb.github.io/uipatterns/';
const PLATFORM_NAME = { mo: '모바일', web: '웹' };
const ZONE_NAME = ['위', '가운데', '가운데 아래', '아래'];   // ZONE_COLS 구간 이름
const POOL = 1000;   // 결과를 섞고 넘겨 보는 범위 (이보다 많으면 앞의 1000장 안에서 — Worker 계산 시간 때문)

const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
const imageUrl = r => IMG_BASE + r.site + '/' + encodePath(r.path);
// 화면 1장으로 바로 가는 링크 (사이트가 #img= 로 열면 그 화면을 크게 보기로 연다, 10/30)
const pageUrl = r => SITE_BASE + r.site + '/#img=' + encodeURIComponent(r.path);
const parseLines = s => (s ? s.split('\n').map(l => { const i = l.indexOf('\t'); return { y: +l.slice(0, i), t: l.slice(i + 1) }; }) : []);
const asList = v => (v == null ? [] : Array.isArray(v) ? v : [v]).map(x => String(x).trim()).filter(Boolean);
const sites = p => (p === 'mo' || p === 'web' ? [p] : ['mo', 'web']);
const lit = v => `'${String(v).replace(/'/g, "''")}'`;     // 이름 목록이 길어 바인딩 개수 한도(100)를 넘을 수 있어 직접 넣는다
const inList = vs => `(${vs.map(lit).join(',')})`;
// 같은 결과 집합 안에서는 늘 같은 순서지만 카테고리·서비스가 고르게 섞이는 순서
const MIX_ORDER = '(s.id * 7919) % 10007, s.id';

// ── 이름 → 정확한 값 (요약 표에서) ───────────────────────────────
async function resolveCats(db, ss, cats) {
  if (!cats.length) return null;
  const rows = await db.all(`SELECT DISTINCT cat FROM cats WHERE site IN ${inList(ss)} AND (${cats.map(() => '(grp = ? OR cat_key LIKE ?)').join(' OR ')})`,
    cats.flatMap(c => [c, '%' + catKey(c) + '%']));
  return rows.map(r => r.cat);
}
async function resolveSvcs(db, ss, svcs) {
  if (!svcs.length) return null;
  const rows = await db.all(`SELECT DISTINCT svc FROM svcs WHERE site IN ${inList(ss)} AND (${svcs.map(() => 'svc_key LIKE ?').join(' OR ')}) LIMIT 300`,
    svcs.map(s => '%' + norm(s) + '%'));
  return rows.map(r => r.svc);
}

// "선택 안 함|선택안함" 처럼 | 는 '하나라도', 배열의 각 항목은 '모두'
const textGroups = text => asList(text).map(t => t.split('|').map(norm).filter(Boolean)).filter(g => g.length);
const phrase = t => `"${bigrams(t).join(' ')}"`;
const oneChar = t => Array.from(t).length < 2;

function toItem(r) {
  const item = {
    platform: PLATFORM_NAME[r.site], category: r.cat, group: r.grp, service: r.svc, industry: r.industry,
    screen: r.pattern || undefined, date: r.date || undefined,
    image: imageUrl(r), page: pageUrl(r), path: r.path,
  };
  if (!r.ocr) item.note = '화면 글자 추출 전';
  return item;
}

// 보여줄 화면에서 조건에 맞은 줄 찾기 (결과 표시용 — 몇 장만 하므로 계산이 적다)
function foundText(r, groups, cols) {
  const lines = parseLines(r.lines);
  return groups.map(g => {
    const l = lines.find(l => g.some(t => norm(l.t).includes(t)) && (!cols || cols.includes(zoneCol(l.y))));
    return l && `${l.t} (${ZONE_NAME[zoneCol(l.y)] ?? ''})`;
  }).filter(Boolean);
}

// 같은 서비스가 결과를 독차지하지 않게 서비스별로 번갈아 담는다
function mixByService(rows) {
  const by = new Map();
  for (const r of rows) { const k = r.site + '\t' + r.svc; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const lists = [...by.values()], out = [];
  for (let i = 0; out.length < rows.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

async function coverage(db, platform) {
  const [m] = await db.all(`SELECT v FROM meta WHERE k = 'stats'`, []);
  const stats = m ? JSON.parse(m.v) : {};
  return sites(platform).filter(s => stats[s]).map(s => `${PLATFORM_NAME[s]} ${stats[s].ocr}/${stats[s].screens}장 글자 추출됨`).join(' · ');
}

// ── 도구 ──────────────────────────────────────────────────────
async function searchScreens(db, a) {
  const limit = Math.min(Math.max(+a.limit || 20, 1), 50);
  const offset = Math.max(+a.offset || 0, 0);
  const ss = sites(a.platform);
  const groups = textGroups(a.text);
  const nots = asList(a.exclude_text).flatMap(t => t.split('|')).map(norm).filter(Boolean);
  const cols = a.zone ? ZONES[a.zone] : null;

  const where = [`s.site IN ${inList(ss)}`];
  const cats = await resolveCats(db, ss, asList(a.categories));
  const svcs = await resolveSvcs(db, ss, asList(a.services));
  const empty = (cats && !cats.length && '카테고리') || (svcs && !svcs.length && '서비스');
  if (empty) return { summary: `일치하는 ${empty} 이름이 없음 — list_filters 로 이름을 확인`, total: 0, items: [] };
  if (cats) where.push(`s.cat IN ${inList(cats)}`);
  if (svcs) where.push(`s.svc IN ${inList(svcs)}`);
  const inds = asList(a.industries);
  if (inds.length) where.push(`s.industry IN ${inList(inds)}`);
  for (const c of asList(a.components)) where.push(`s.comps LIKE ${lit('%,' + c + ',%')}`);

  // 글자 조건 → 전문 검색 식. 위치 조건이 있으면 그 구간 열에서만 ({z2 z3} : "…")
  const params = [];
  const colPrefix = cols ? `{${cols.map(i => 'z' + i).join(' ')}} : ` : '';
  const fts = [];
  for (const g of groups) {
    if (g.some(oneChar)) {   // 한 글자는 색인으로 못 찾음 → 원문에서 (위치 조건은 무시)
      where.push('(' + g.map(() => 's.lines LIKE ?').join(' OR ') + ')'); params.push(...g.map(t => '%' + t + '%'));
    } else fts.push('(' + g.map(t => colPrefix + phrase(t)).join(' OR ') + ')');
  }
  if (groups.length || nots.length || cols) where.push('s.ocr = 1');
  const multi = nots.filter(t => !oneChar(t));
  if (multi.length) { where.push('s.id NOT IN (SELECT rowid FROM screens_fts WHERE screens_fts MATCH ?)'); params.push(multi.map(phrase).join(' OR ')); }
  if (cols && !groups.length) return { summary: 'zone 은 text 와 함께 써야 합니다', total: 0, items: [] };

  const from = fts.length ? 'screens_fts f JOIN screens s ON s.id = f.rowid' : 'screens s';
  const cond = [...(fts.length ? ['screens_fts MATCH ?'] : []), ...where].join(' AND ');
  const p = fts.length ? [fts.join(' AND '), ...params] : params;

  const [{ n: total }] = await db.all(`SELECT COUNT(*) AS n FROM ${from} WHERE ${cond}`, p);
  // 섞는 데는 서비스 이름만 필요 — 보여줄 화면만 전체 정보를 읽는다
  const ids = mixByService(await db.all(`SELECT s.id, s.site, s.svc FROM ${from} WHERE ${cond} ORDER BY ${MIX_ORDER} LIMIT ${POOL}`, p))
    .slice(offset, offset + limit).map(r => r.id);
  const full = ids.length ? await db.all(`SELECT * FROM screens WHERE id IN (${ids.join(',')})`, []) : [];
  const byId = new Map(full.map(r => [r.id, r]));
  const rows = ids.map(i => byId.get(i));

  const partial = total > POOL;
  return {
    summary: `${total}장 찾음` + (rows.length ? ` · ${offset + 1}~${offset + rows.length}번째 결과` : '')
      + (partial ? ` (결과가 많아 ${POOL}장 안에서 보여줌 — 조건을 좁히면 정확해짐)` : ''),
    total, partial: partial || undefined,
    next_offset: offset + rows.length < Math.min(total, POOL) ? offset + rows.length : undefined,
    text_coverage: groups.length || nots.length ? await coverage(db, a.platform) : undefined,
    items: rows.map(r => ({ ...toItem(r), text_found: groups.length ? foundText(r, groups, cols) : undefined })),
  };
}

async function listFilters(db, a) {
  const ss = sites(a.platform);
  const cats = await db.all(`SELECT grp, cat, SUM(n) AS n FROM cats WHERE site IN ${inList(ss)} GROUP BY grp, cat ORDER BY grp, n DESC`, []);
  const groups = {};
  for (const c of cats) (groups[c.grp] ||= []).push(`${c.cat} (${c.n})`);
  const inds = await db.all(`SELECT industry, COUNT(DISTINCT svc) AS svcs, SUM(n) AS n FROM svcs WHERE site IN ${inList(ss)} GROUP BY industry ORDER BY n DESC`, []);
  const out = {
    pattern_groups: groups,
    industries: inds.map(i => `${i.industry} (서비스 ${i.svcs}개 · ${i.n}장)`),
  };
  const q = asList(a.service_query), ind = asList(a.industry);
  if (q.length || ind.length) {
    const where = [`site IN ${inList(ss)}`], params = [];
    if (q.length) { where.push('(' + q.map(() => 'svc_key LIKE ?').join(' OR ') + ')'); params.push(...q.map(s => '%' + norm(s) + '%')); }
    if (ind.length) where.push(`industry IN ${inList(ind)}`);
    const svcs = await db.all(`SELECT svc, industry, GROUP_CONCAT(site) AS sites, SUM(n) AS n FROM svcs WHERE ${where.join(' AND ')} GROUP BY svc, industry ORDER BY n DESC LIMIT 200`, params);
    out.services = svcs.map(s => `${s.svc} · ${s.industry} · ${s.sites.split(',').map(x => PLATFORM_NAME[x]).join('/')} ${s.n}장`);
  }
  const [meta] = await db.all(`SELECT v FROM meta WHERE k = 'built'`, []);
  const [cc] = await db.all(`SELECT COUNT(*) AS n FROM screens WHERE comps != '' AND site IN ${inList(ss)}`, []);
  out.data = { built: meta?.v, text_coverage: await coverage(db, a.platform), components: `컴포넌트 정보가 있는 화면 ${cc.n}장 (2026-10-26 이후 캡처분)` };
  return out;
}

async function serviceOverview(db, a) {
  const queries = asList(a.services).slice(0, 4);
  if (!queries.length) throw new Error('services 에 서비스 이름을 1~4개 넣어 주세요');
  const ss = sites(a.platform);
  const per = Math.min(Math.max(a.samples_per_category == null ? 2 : +a.samples_per_category, 0), 5);
  const result = [];
  for (const q of queries) {
    // 이름이 똑같은 서비스 → 이름이 질문으로 시작하는 서비스 → 화면이 많은 서비스 순
    const k = norm(q);
    const found = await db.all(`SELECT svc, industry, SUM(n) AS n FROM svcs WHERE site IN ${inList(ss)} AND svc_key LIKE ? GROUP BY svc, industry
      ORDER BY MAX(svc_key = ?) DESC, MAX(svc_key LIKE ?) DESC, n DESC LIMIT 10`, ['%' + k + '%', k, k + '%']);
    if (!found.length) { result.push({ query: q, error: '일치하는 서비스 없음 — list_filters 의 service_query 로 이름 확인' }); continue; }
    const svc = found[0].svc;
    const cats = await db.all(`SELECT site, cat, grp, COUNT(*) AS n FROM screens WHERE svc = ? AND site IN ${inList(ss)} GROUP BY site, cat, grp ORDER BY n DESC`, [svc]);
    const entry = {
      query: q, service: svc, industry: found[0].industry,
      other_matches: found.length > 1 ? found.slice(1).map(f => `${f.svc} (${f.n}장)`) : undefined,
      total: cats.reduce((s, c) => s + c.n, 0),
      categories: cats.map(c => `${PLATFORM_NAME[c.site]} · ${c.grp} · ${c.cat} ${c.n}장`),
    };
    if (per) {
      const cat = asList(a.categories);
      const order = cats.filter(c => !cat.length || cat.some(x => catKey(c.cat).includes(catKey(x)) || c.grp === x)).slice(0, 10).map(c => c.site + '\t' + c.cat);
      // 카테고리마다 앞의 몇 장 — 한 번의 쿼리로
      const rows = await db.all(`SELECT * FROM (SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.site, s.cat ORDER BY ${MIX_ORDER}) AS rn
        FROM screens s WHERE s.svc = ? AND s.site IN ${inList(ss)}) WHERE rn <= ?`, [svc, per]);
      entry.samples = rows.filter(r => order.includes(r.site + '\t' + r.cat))
        .sort((x, y) => order.indexOf(x.site + '\t' + x.cat) - order.indexOf(y.site + '\t' + y.cat) || x.rn - y.rn)
        .map(toItem);
    }
    result.push(entry);
  }
  const listed = result.filter(r => r.categories);
  if (listed.length > 1) {
    // 비교: 모든 서비스에 있는 카테고리
    const sets = listed.map(r => new Set(r.categories.map(c => c.replace(/ \d+장$/, ''))));
    return { services: result, shared_categories: [...sets[0]].filter(c => sets.every(s => s.has(c))) };
  }
  return { services: result };
}

async function getScreen(db, a) {
  let site = a.platform, p = String(a.path || '').trim();
  const m = p.match(/uipatterns\/(mo|web)\/(.+)$/);   // 이미지 주소를 그대로 넣어도 된다
  if (m) { site = m[1]; p = decodeURIComponent(m[2]); }
  p = p.normalize('NFC');
  const rows = await db.all(`SELECT * FROM screens WHERE site IN ${inList(sites(site))} AND path = ? LIMIT 2`, [p]);
  if (!rows.length) throw new Error('화면을 찾지 못했습니다. search_screens 결과의 path 또는 image 주소를 넣어 주세요');
  const r = rows[0];
  return { ...toItem(r), text: r.ocr ? parseLines(r.lines).map(l => `${l.y}\t${ZONE_NAME[zoneCol(l.y)] ?? ''}\t${l.t}`) : undefined };
}

// ── 도구 정의 (MCP tools/list) ─────────────────────────────────
const PLATFORM = { type: 'string', enum: ['mo', 'web', 'all'], description: 'mo=모바일 앱, web=웹사이트, all=둘 다 (기본)' };
const STR_LIST = d => ({ type: 'array', items: { type: 'string' }, description: d });
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'search_screens',
    title: '화면 검색',
    description: 'UI 패턴 레퍼런스 화면(모바일 약 5.7만·웹 약 2.6만 장)을 조건으로 찾는다. 화면 속 글자(OCR)·글자 위치·카테고리(패턴)·서비스·업종 조건을 함께 쓸 수 있다. '
      + '결과마다 이미지 주소(image)와 사이트 링크(page)가 있다. 글자는 OCR 이라 오타가 있을 수 있으니 비슷한 표현을 | 로 함께 넣는다.',
    inputSchema: {
      type: 'object',
      properties: {
        text: STR_LIST('화면에 보이는 글자. 항목마다 모두 있어야 하고, 한 항목 안의 | 는 "하나라도". 띄어쓰기·기호 무시. 예: ["선택 안 함|선택안함"], ["품절|재고|남은 수량"]'),
        exclude_text: STR_LIST('이 글자가 있는 화면은 뺀다'),
        zone: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'text 가 화면의 어디에 있어야 하는지 (top=위 35%, middle=35~65%, bottom=55% 아래). 바텀시트·하단 버튼은 bottom' },
        categories: STR_LIST('카테고리(패턴) 이름 일부 또는 패턴 그룹(진입·탐색·프로모션·활동·거래·관리·AI·도구). 예: ["장바구니"], ["로그인"]'),
        services: STR_LIST('서비스 이름 일부. 예: ["에어비앤비", "토스"]'),
        industries: STR_LIST('업종 (list_filters 로 확인). 예: ["모빌리티"]'),
        components: STR_LIST('UI 컴포넌트 (uibowl 태그. 예: 모달·바텀시트·드롭다운·탭). 2026-10-26 이후 캡처한 화면에만 있음 — 결과가 적으면 빼고 text·zone 으로'),
        platform: PLATFORM,
        limit: { type: 'integer', description: '결과 수 (기본 20, 최대 50)' },
        offset: { type: 'integer', description: '다음 결과를 볼 때 next_offset 값' },
      },
    },
    annotations: READ_ONLY,
    run: searchScreens,
  },
  {
    name: 'list_filters',
    title: '검색 조건 목록',
    description: '검색에 쓸 수 있는 패턴 그룹·카테고리·업종 목록과 화면 수, 데이터 상태를 보여준다. service_query 나 industry 를 주면 해당 서비스 이름 목록도 준다. 서비스 이름이 정확하지 않을 때 먼저 쓴다.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: PLATFORM,
        service_query: STR_LIST('서비스 이름 일부로 서비스 찾기'),
        industry: STR_LIST('이 업종의 서비스 목록 보기'),
      },
    },
    annotations: READ_ONLY,
    run: listFilters,
  },
  {
    name: 'service_overview',
    title: '서비스 화면 · 비교',
    description: '서비스 1~4개의 화면 구성(카테고리별 화면 수)과 카테고리별 예시 화면을 보여준다. 2개 이상이면 공통 카테고리도 알려줘서 서비스 간 UI/UX 비교에 쓴다.',
    inputSchema: {
      type: 'object',
      properties: {
        services: STR_LIST('서비스 이름 (1~4개). 예: ["에어비앤비", "부킹닷컴"]'),
        categories: STR_LIST('예시 화면을 이 카테고리·패턴 그룹으로 한정'),
        samples_per_category: { type: 'integer', description: '카테고리마다 예시 화면 수 (기본 2, 0~5)' },
        platform: PLATFORM,
      },
      required: ['services'],
    },
    annotations: READ_ONLY,
    run: serviceOverview,
  },
  {
    name: 'get_screen',
    title: '화면 글자 보기',
    description: '화면 1장의 전체 글자(OCR)와 세로 위치(0=맨 위, 1000=맨 아래)를 보여준다. 검색 결과가 질문에 맞는지 확인할 때 쓴다.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'search_screens 결과의 path 또는 image 주소' },
        platform: PLATFORM,
      },
      required: ['path'],
    },
    annotations: READ_ONLY,
    run: getScreen,
  },
];

export const INSTRUCTIONS = `UI Patterns — 사내 UI 패턴 레퍼런스(uibowl 벤치마킹) 화면 검색. 읽기 전용.
- 글자로 찾기("더보기" 들어간 화면): search_screens text
- 컴포넌트+글자("바텀시트에 '선택 안 함' 버튼"): components 로 먼저 찾고(최근 캡처분만 있음), 부족하면 text + zone(bottom) 으로 찾아 get_screen 글자나 이미지로 바텀시트인지 확인해 답한다
- 상황("장바구니에서 재고 부족"): categories + 상황을 나타낼 만한 표현 여러 개를 text 에 | 로 (품절|재고|남은 수량|일시품절)
- 서비스 비교("에어비앤비와 부킹닷컴"): service_overview 에 두 서비스
- 대상·업종("30대 여성 모빌리티"): list_filters 로 업종·서비스를 확인한 뒤 industries 로 검색하고, 서비스 특성은 일반 지식으로 보완
- 답변에는 화면마다 image(이미지)와 page(사이트) 링크를 붙인다. 글자는 OCR 결과라 일부 화면은 아직 추출 전이거나 오타가 있을 수 있다`;
