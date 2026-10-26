#!/usr/bin/env node
/*
 * capture-import.js  (2026-10-21)
 * 다운로드 폴더에 떨어진 uibowl-capture 결과(UB__*__manifest.json + 이미지)를 찾아
 *   {mo|web}/(업데이트)/{서비스명}/ 으로 옮기고, 분류용 .uibowl.json 을 남긴다.
 *
 * 사용:  node capture-import.js [--downloads <폴더>] [--wait <초>] [--site mo|web]
 *   --downloads  기본값: 바탕화면/다운로드 중 UB__ 매니페스트가 있는 곳 자동 탐지
 *   --wait       매니페스트/이미지가 다 내려올 때까지 기다릴 최대 시간 (기본 90초)
 *   --site       해당 사이트 배치만 가져온다 (기본: 전부)
 *
 * 결과 파일명: {서비스명}_{화면이름}_{NNN}_{YYYYMMDD}.png  (화면이름이 없으면 {서비스명}_{NNN}_{날짜})
 * .uibowl.json : { files: { "<결과파일명>": { category, pattern, imgId } } }  ← classify-local.js 가 읽는다
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const nfc = s => String(s == null ? '' : s).normalize('NFC');

// Chrome 저장 위치 후보 (Cowork VM 마운트 → Windows 실제 경로). 매니페스트가 있는 폴더를 쓴다.
// 2026-10-21 기준 이 PC의 Chrome은 "바탕화면"에 저장한다.
const CANDS = [
  path.join(os.homedir(), 'mnt', 'Desktop'), path.join(os.homedir(), 'mnt', 'Downloads'),
  path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'OneDrive', '바탕 화면'), path.join(os.homedir(), 'OneDrive', 'Desktop'),
].filter(p => fs.existsSync(p));
const hasBatch = d => { try { return fs.readdirSync(d).some(f => /^UB__(mo|web)__.+__manifest/.test(nfc(f))); } catch (_) { return false; } };
let DL = arg('--downloads', '');
const WAIT = Number(arg('--wait', 90)) * 1000;
const ONLY_SITE = arg('--site', '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function safe(s) {
  return nfc(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/[・·•‧]/g, '-').replace(/_+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);
}
function moveFile(src, dest) {
  try { fs.renameSync(src, dest); return; } catch (e) { if (e.code !== 'EXDEV' && e.code !== 'EPERM') throw e; }
  fs.copyFileSync(src, dest);
  try { fs.unlinkSync(src); } catch (e) { console.log('    [경고] 원본 삭제 실패(다운로드 폴더에 남음): ' + path.basename(src)); }
}
function listManifests() {
  return fs.readdirSync(DL).map(nfc)
    .filter(f => /^UB__(mo|web)__.+__manifest( \(\d+\))?\.json$/.test(f))
    .filter(f => !ONLY_SITE || f.startsWith('UB__' + ONLY_SITE + '__'));
}
function findFile(name) {
  // 크롬이 같은 이름을 " (1)" 로 바꿔 저장한 경우까지 찾는다
  const p = path.join(DL, name);
  if (fs.existsSync(p)) return p;
  const ext = path.extname(name), base = name.slice(0, -ext.length);
  const hit = fs.readdirSync(DL).map(nfc).find(f => f.startsWith(base + ' (') && f.endsWith(ext));
  return hit ? path.join(DL, hit) : null;
}

async function main() {
  // 매니페스트가 나타날 때까지 대기 (저장 위치 후보를 모두 본다)
  const t0 = Date.now();
  if (!DL) {
    for (;;) {
      DL = CANDS.find(hasBatch) || '';
      if (DL || Date.now() - t0 >= WAIT) break;
      await sleep(2000);
    }
    if (!DL) { console.log('  가져올 캡처 배치가 없습니다 (UB__*__manifest.json 없음). 찾아본 곳: ' + CANDS.join(', ')); return { batches: [] }; }
  }
  console.log('  [capture-import] 캡처 파일 위치: ' + DL);
  if (!fs.existsSync(DL)) { console.log('  [오류] 폴더가 없습니다: ' + DL); process.exit(1); }
  let mans = listManifests();
  while (!mans.length && Date.now() - t0 < WAIT) { await sleep(2000); mans = listManifests(); }
  if (!mans.length) { console.log('  가져올 캡처 배치가 없습니다 (UB__*__manifest.json 없음).'); return { batches: [] }; }

  const report = [];
  for (const mf of mans) {
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(DL, mf), 'utf8')); }
    catch (e) { console.log('  [건너뜀] 매니페스트 읽기 실패: ' + mf); continue; }
    const svc = safe(m.svc);
    const site = m.site === 'web' ? 'web' : 'mo';
    const date = m.date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const want = m.items.filter(i => i.file);

    // 이미지가 다 내려올 때까지(.crdownload 없음) 대기
    const t1 = Date.now();
    let missing;
    for (;;) {
      missing = want.filter(i => !findFile(i.file));
      const partial = fs.readdirSync(DL).some(f => nfc(f).startsWith(m.tag) && /\.(crdownload|tmp|part)$/i.test(f));
      if ((!missing.length && !partial) || Date.now() - t1 > WAIT) break;
      await sleep(2000);
    }

    const destDir = path.join(ROOT, site, '(업데이트)', svc);
    fs.mkdirSync(destDir, { recursive: true });
    const metaPath = path.join(destDir, '.uibowl.json');
    let meta = { files: {} };
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); meta.files = meta.files || {}; } catch (_) {}

    console.log('\n  [' + site + '/' + svc + '] 카드 ' + m.count + '개, 이미지 ' + want.length + '개');
    let moved = 0;
    for (const it of want) {
      const src = findFile(it.file);
      if (!src) continue;
      const pat = safe(it.pattern);
      const num = String(it.n).padStart(3, '0');
      let name = svc + '_' + (pat ? pat + '_' : '') + num + '_' + date + '.png';
      let dest = path.join(destDir, name);
      for (let k = 1; fs.existsSync(dest) && k < 100; k++) {
        name = svc + '_' + (pat ? pat + '_' : '') + num + '-' + k + '_' + date + '.png';
        dest = path.join(destDir, name);
      }
      moveFile(src, dest);
      // components: 화면 속 컴포넌트 (매니페스트 v5~). classify-local.js 가 최종 경로로 {site}/components.json 에 기록한다
      meta.files[name] = { category: nfc(it.category), pattern: nfc(it.pattern), imgId: it.imgId, isPush: !!it.isPush, video: !!it.video,
        components: [...new Set((it.components || []).map(c => nfc(c.name)).filter(Boolean))] };
      moved++;
    }
    if (m.icon) {
      const src = findFile(m.icon);
      if (src) moveFile(src, path.join(destDir, svc + '.png'));
    }
    meta.svc = svc; meta.site = site; meta.url = m.url; meta.capturedAt = m.capturedAt;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
    const withComps = want.filter(i => (i.components || []).length).length;
    if (withComps) console.log('    컴포넌트 정보 ' + withComps + '장 (분류할 때 ' + site + '/components.json 에 기록)');

    // 매니페스트는 backups/captures 로 보관
    const arch = path.join(ROOT, site, 'backups', 'captures');
    fs.mkdirSync(arch, { recursive: true });
    moveFile(path.join(DL, mf), path.join(arch, nfc(mf).replace(/^UB__/, '')));

    const cats = {};
    want.forEach(i => { const c = i.category || '(없음)'; cats[c] = (cats[c] || 0) + 1; });
    console.log('    -> ' + moved + '개 이동 (누락 ' + missing.length + ', 캡처실패 ' + (m.failed || []).length + ')');
    console.log('    uibowl 카테고리: ' + Object.entries(cats).map(([k, v]) => k + ' ' + v).join(', '));
    report.push({ site, svc, cards: m.count, moved, missing: missing.map(i => i.file), failed: (m.failed || []).length });
  }
  console.log('\n  [capture-import] 완료: ' + JSON.stringify(report));
  return { batches: report };
}

main().catch(e => { console.error('  [오류] ' + (e && e.stack || e)); process.exit(1); });
