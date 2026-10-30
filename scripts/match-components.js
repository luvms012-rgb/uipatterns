/**
 * match-components.js — 예전에 캡처한 화면에 uibowl 컴포넌트를 채운다 (2026-10-30)
 *
 * 재료: uibowl 서비스 페이지에서 uibowl-components.js 로 읽은 카드 목록(JSON, 이미지는 안 받음)
 *   { site, svc, items: [{ n, category, pattern, components: [이름...] }] }
 *
 * 맞추는 법: 로컬 파일 이름은 "서비스_화면이름_번호_날짜" 이고, 번호는 같은 카테고리 안에서 캡처한 순서다
 * (classify-local.js 의 nextNum). 그래서 카테고리마다
 *   로컬 파일(번호 순)  ↔  uibowl 카드(페이지 순, 카테고리는 uibowl-category-map.json 으로 로컬 이름에 맞춤)
 * 을 화면 이름이 같은 것끼리 순서를 지키며 짝짓는다(가장 긴 공통 순서). 화면 이름이 다른 짝은 붙이지 않는다
 * — 캡처 뒤 uibowl 에 화면이 늘거나 순서가 바뀌었을 수 있어서, 틀릴 바엔 비워 둔다.
 *
 * 사용:
 *   node scripts/match-components.js <카드 JSON>... [--check] [--write]
 *     --check  components.json 에 이미 정답이 있는 화면으로 정확도를 잰다 (10/26 이후 캡처한 서비스로 먼저 확인)
 *     --write  짝지은 화면 중 아직 컴포넌트가 없는 것만 {site}/components.json 에 더한다 (있는 건 안 건드림)
 *   → 그 뒤 업데이트.bat 이 components.json 을 data.js 의 comps 로 합친다
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const WRITE = args.includes('--write');
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) { console.log('사용: node scripts/match-components.js <카드 JSON>... [--check] [--write]'); process.exit(1); }

const nfc = s => String(s || '').normalize('NFC');
// 이름 비교용: 가운뎃점·하이픈·밑줄·공백·파일에 못 쓰는 글자를 모두 무시, 소문자
const key = s => nfc(s).replace(/[・·•‧ㆍ\-_\\/:*?"<>|\s]/g, '').toLowerCase();

function readData(site) {
  const src = fs.readFileSync(path.join(REPO, site, 'data.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('[', src.indexOf('const DATA')), src.lastIndexOf(']') + 1));
}
const CAT_MAP = JSON.parse(fs.readFileSync(path.join(REPO, 'uibowl-category-map.json'), 'utf8'));

// uibowl 카테고리 → 로컬 카테고리 (없거나 제외면 null)
function mapCategory(ubCat, site, localCats) {
  if (!ubCat || (CAT_MAP.skip || []).includes(ubCat)) return null;
  const alias = Object.assign({}, CAT_MAP.alias || {}, (CAT_MAP[site] || {}).alias || {});
  const target = alias[ubCat] || ubCat;
  return localCats.find(c => key(c) === key(target)) || null;
}

// 두 목록에서 화면 이름이 같은 짝을 순서를 지키며 가장 많이 (LCS)
function align(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i].k === b[j].k ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].k === b[j].k) { pairs.push([a[i], b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
}

const dataCache = {}, compCache = {};
const sameSet = (x, y) => x.length === y.length && x.every(v => y.includes(v));
let tot = { local: 0, cards: 0, paired: 0, check: 0, checkOk: 0, added: 0 };

for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const site = r.site;
  if (!['mo', 'web'].includes(site)) { console.log(`건너뜀 (site 없음): ${f}`); continue; }
  const D = dataCache[site] || (dataCache[site] = readData(site));
  const compFile = path.join(REPO, site, 'components.json');
  const comps = compCache[site] || (compCache[site] = fs.existsSync(compFile) ? JSON.parse(fs.readFileSync(compFile, 'utf8')) : {});
  const localCats = [...new Set(D.map(i => i.category))];

  // 로컬: 이 서비스 화면을 카테고리별로, 번호 순
  const local = D.filter(i => key(nfc(i.name).split('_')[0]) === key(r.svc)).map(i => {
    const p = nfc(i.name).split('_');
    return { path: nfc(i.path), cat: i.category, num: parseInt(p[p.length - 2], 10) || 0, k: key(p.slice(1, -2).join('_')) };
  });
  // uibowl: 카드를 로컬 카테고리로 옮겨 페이지 순서대로
  const cards = r.items.map(c => ({ cat: mapCategory(c.category, site, localCats), k: key(c.pattern), comps: c.components || [] })).filter(c => c.cat);

  let paired = 0, check = 0, checkOk = 0, added = 0;
  const miss = [];
  for (const cat of new Set(local.map(l => l.cat))) {
    const L = local.filter(l => l.cat === cat).sort((a, b) => a.num - b.num);
    const C = cards.filter(c => c.cat === cat);
    const pairs = align(L, C);
    paired += pairs.length;
    if (pairs.length < L.length) miss.push(`${cat} ${pairs.length}/${L.length}`);
    for (const [l, c] of pairs) {
      const have = comps[l.path];
      if (have) { check++; if (sameSet(have, c.comps)) checkOk++; continue; }
      if (WRITE && c.comps.length) { comps[l.path] = [...new Set(c.comps)]; added++; }
    }
  }
  tot.local += local.length; tot.cards += cards.length; tot.paired += paired; tot.check += check; tot.checkOk += checkOk; tot.added += added;
  console.log(`[${site}] ${r.svc}: 로컬 ${local.length}장, uibowl 카드 ${r.items.length}장(분류 대상 ${cards.length}) → 짝 ${paired}장` +
    (CHECK && check ? `, 정답 대조 ${checkOk}/${check} (${Math.round(checkOk * 100 / check)}%)` : '') +
    (WRITE ? `, 더함 ${added}장` : ''));
  if (miss.length) console.log(`   못 짝지은 카테고리: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? ' 외 ' + (miss.length - 12) : ''}`);
}

console.log(`\n합계: 로컬 ${tot.local}장 중 짝 ${tot.paired}장` +
  (CHECK && tot.check ? ` · 정답 대조 ${tot.checkOk}/${tot.check} (${Math.round(tot.checkOk * 100 / tot.check)}%)` : '') +
  (WRITE ? ` · components.json 에 ${tot.added}장 더함` : ' · (--write 를 붙이면 저장)'));

// classify-local.js 의 addComps 와 같은 모양: 한 줄 = 화면 1장, 경로 순 (git diff 에서 줄 단위로 보이도록)
if (WRITE) for (const site of Object.keys(compCache)) {
  const all = compCache[site], keys = Object.keys(all).sort();
  fs.writeFileSync(path.join(REPO, site, 'components.json'), '{\n' + keys.map(k => ' ' + JSON.stringify(k) + ': ' + JSON.stringify(all[k])).join(',\n') + '\n}\n');
}
