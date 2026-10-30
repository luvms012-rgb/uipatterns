/**
 * update.js — 원클릭 업데이트 (업데이트.bat / 업데이트.command 가 실행)
 *
 *   1) GitHub에서 최신 코드 받기 (git pull)
 *   2) 이 PC에 이미지 폴더가 설정돼 있으면 새 화면 대표 색 뽑기(Windows) → 스캔 → mo/·web/ 데이터 갱신
 *   3) 이번에 새로 추가된 이미지 목록 출력 (회사 서버에 수동 업로드할 것)
 *   4) 변경사항 커밋 → GitHub 반영 (push) → 1~2분 뒤 사이트 자동 배포
 *
 * 이미지는 mo/·web/ 아래 카테고리 폴더에 있고 git에는 올라가지 않는다(.gitignore).
 * 이미지가 없는 PC(집)에서 실행하면 데이터 갱신은 건너뛰고 코드 변경만 반영한다.
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { updatePlatform, acquireLock, releaseLock } = require('./update-index');

const REPO          = path.join(__dirname, '..');
const DEPLOY_CONFIG = JSON.parse(fs.readFileSync(path.join(REPO, 'deploy.config.json'), 'utf-8'));
const NEW_LIST      = path.join(REPO, '업로드할 이미지.txt');
const PLATFORMS     = { mo: '모바일', web: '웹사이트' };

function git(args, opts = {}) {
  return execSync('git ' + args, { cwd: REPO, encoding: 'utf-8', stdio: opts.inherit ? 'inherit' : 'pipe' });
}
function ask(rl, q) { return new Promise(r => rl.question(q, a => r(a.trim()))); }
function stamp() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 이미지 폴더 = 저장소 안의 mo/·web/ 자체 (카테고리 하위 폴더는 .gitignore로 git에서 빠져 있음).
// 회사 PC처럼 카테고리 폴더에 이미지가 있으면 스캔하고, 집처럼 비어 있으면 건너뛴다.
function findImageDirs() {
  const dirs = {};
  for (const p of Object.keys(PLATFORMS)) {
    const base = path.join(REPO, p);
    const hasImages = fs.readdirSync(base, { withFileTypes: true }).some(d =>
      d.isDirectory() && !d.name.startsWith('(') && !d.name.startsWith('.') && !['icons', 'backups'].includes(d.name) &&
      fs.readdirSync(path.join(base, d.name)).some(f => /\.(png|jpe?g|webp|gif|avif)$/i.test(f)));
    if (hasImages) dirs[p] = base;
  }
  return dirs;
}

function ensureGitIdentity() {
  let name = '';
  try { name = git('config user.name').trim(); } catch (_) {}
  if (!name) {
    git(`config user.name "${DEPLOY_CONFIG.author.name}"`);
    git(`config user.email "${DEPLOY_CONFIG.author.email}"`);
  }
}

// Claude 자연어 검색용 데이터 갱신 (mcp/README.md) — 새 화면 글자 추출(OCR) → search/dist/ 다시 생성.
// 글자 추출은 Windows 내장 OCR 이라 Windows 에서만. 실패해도 업데이트 자체는 계속한다.
function updateSearch(results) {
  const added = results.reduce((n, r) => n + r.newItems.length, 0);
  if (!added && fs.existsSync(path.join(REPO, 'search', 'dist', 'uipatterns.db'))) return;
  if (process.platform !== 'win32') { console.log('  검색 데이터: 화면 글자 추출은 Windows에서만 — 건너뜀'); return; }
  try {
    console.log(`  검색 데이터: 새 화면 ${added}장 글자 추출 중…`);
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(REPO, 'search', 'run-ocr.ps1')}" -Workers 4`, { cwd: REPO, stdio: 'inherit' });
    execSync(`node --no-warnings "${path.join(REPO, 'search', 'build-index.js')}"`, { cwd: REPO, stdio: 'inherit' });
  } catch (e) {
    console.log(`  ⚠ 검색 데이터 갱신 실패 (업데이트는 계속): ${e.message.split('\n')[0]}`);
  }
}

// 컬러 필터용 화면 대표 색 — 새 화면만 뽑아 <site>/colors.json 에 더한다 (데이터 갱신 전에 해야 data.js 에 들어감).
// Windows 내장 그리기 기능이라 Windows 에서만. 실패해도 업데이트 자체는 계속한다.
function updateColors(sites) {
  if (process.platform !== 'win32') { console.log('  화면 색: Windows에서만 뽑음 — 건너뜀'); return; }
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(REPO, 'scripts', 'colors.ps1')}" -Sites ${sites.join(',')}`, { cwd: REPO, stdio: 'inherit' });
  } catch (e) {
    console.log(`  ⚠ 화면 색 뽑기 실패 (업데이트는 계속): ${e.message.split('\n')[0]}`);
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\n━━━ UI Patterns 업데이트 ━━━\n');

    // 1) 최신 코드 받기 — 집/회사에서 번갈아 작업해도 충돌 없이 이어지도록 항상 먼저 pull
    console.log('[1/4] GitHub에서 최신 내용 받는 중…');
    try {
      git('pull --rebase --autostash', { inherit: true });
    } catch (_) {
      console.log('\n❌  최신 내용을 받지 못했습니다 (인터넷 연결 또는 충돌).');
      console.log('    같은 파일을 집과 회사에서 동시에 고쳤다면 Claude에게 "uipatterns 충돌 해결"을 요청하세요.\n');
      process.exitCode = 1;
      return;
    }

    // 2) 이미지 스캔
    const dirs = findImageDirs();
    const results = [];
    if (!Object.keys(dirs).length) {
      console.log('\n[2/4] 이 PC에는 이미지가 없어 데이터 갱신은 건너뜁니다 (코드 변경만 반영).');
    } else {
      console.log('\n[2/4] 이미지 폴더 스캔 중…');
      if (!acquireLock()) { process.exitCode = 1; return; }
      updateColors(Object.keys(dirs));
      try {
        for (const [p, dir] of Object.entries(dirs)) {
          // 안전장치: 폴더를 잘못 지정했거나 드라이브가 안 붙어서 이미지가 갑자기 반 이상 사라지면 확인받는다
          const dry = updatePlatform(p, dir, { dryRun: true });
          if (dry.prevTotal > 100 && dry.total < dry.prevTotal * 0.5) {
            console.log(`\n  ⚠ ${PLATFORMS[p]}: 이미지가 ${dry.prevTotal}장 → ${dry.total}장으로 크게 줄었습니다.`);
            console.log(`    폴더: ${dir}`);
            const yes = await ask(rl, '    그래도 반영할까요? (y/N) ');
            if (yes.toLowerCase() !== 'y') { console.log('    건너뜀'); continue; }
          }
          const r = updatePlatform(p, dir);
          results.push(r);
          console.log(`  ${PLATFORMS[p]}: 총 ${r.total}장 (신규 ${r.newItems.length} · 삭제 ${r.removed.length})`);
          const t = r.typeResult;
          if (t && t.added.length) {
            console.log(`    업종 자동 분류 ${t.added.length}개: ` + t.added.map(a => `${a.svc}→${a.type}`).join(', '));
          }
          if (t && t.skipped) console.log('    ' + t.skipped.replace(/\n/g, '\n    '));
        }
      } finally {
        releaseLock();
      }
    }

    if (results.length) updateSearch(results);

    // 3) 회사 서버에 올릴 이미지 목록
    const newOnes = results.flatMap(r => r.newItems.map(i => `${r.platform}/${i.path}`));
    if (newOnes.length) {
      fs.writeFileSync(NEW_LIST,
        `# ${stamp()} 업데이트로 새로 추가된 이미지 ${newOnes.length}장\n` +
        `# 회사 서버 uipatterns/ 아래 같은 경로로 올려주세요.\n\n` + newOnes.join('\n') + '\n', 'utf-8');
      console.log(`\n[3/4] 새 이미지 ${newOnes.length}장 → 회사 서버에 업로드가 필요합니다.`);
      newOnes.slice(0, 15).forEach(l => console.log('  ' + l));
      if (newOnes.length > 15) console.log(`  … 외 ${newOnes.length - 15}장`);
      console.log(`  전체 목록: 업로드할 이미지.txt`);
    } else {
      console.log('\n[3/4] 새로 추가된 이미지 없음');
    }

    // 4) 커밋 → push
    console.log('\n[4/4] GitHub에 반영 중…');
    ensureGitIdentity();
    git('add -A');
    const staged = git('diff --cached --name-only').trim();
    if (!staged) {
      console.log('  바뀐 내용이 없습니다.\n');
      return;
    }
    const parts = results
      .filter(r => r.newItems.length || r.removed.length)
      .map(r => `${r.platform} +${r.newItems.length}${r.removed.length ? ' -' + r.removed.length : ''}`);
    const msg = (parts.length ? 'update: ' + parts.join(' · ') : 'edit: ' + staged.split('\n').slice(0, 3).join(', ')) + ` (${stamp()})`;
    git(`commit -q -m "${msg.replace(/"/g, "'")}"`);
    git('push', { inherit: true });

    console.log(`\n✅  반영 완료: ${msg}`);
    console.log(`  사이트는 1~2분 뒤 갱신됩니다 → ${DEPLOY_CONFIG.pagesUrl}`);
    if (newOnes.length) {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      console.log(`  서버 업로드 후 엑박 점검 → ${DEPLOY_CONFIG.pagesUrl}mo/?check=${day}  (web도 같은 방식)`);
    }
    console.log('');
  } finally {
    rl.close();
  }
}

main().catch(e => {
  console.error('\n❌  예외 발생:', e.message, '\n');
  process.exitCode = 1;
});
