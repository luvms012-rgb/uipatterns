/*
 * sync-ybm-ds.js — ybm-ds 배포본(CSS + 글꼴)을 이 사이트의 ybm-ds/ 폴더로 복사한다.
 * 운영은 회사 서버라 GitHub 에 있는 ybm-ds 를 직접 부르지 않고, 사이트와 같은 곳에 사본을 둔다.
 * ybm-ds 저장소(../ybm-ds)의 origin/main 기준 — 다른 PC·세션이 작업 중인 미배포 변경은 가져오지 않는다.
 * 사용: node scripts/sync-ybm-ds.js   (ybm-ds 를 고친 뒤 사이트에도 반영할 때)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DS = path.join(ROOT, '..', 'ybm-ds');
const OUT = path.join(ROOT, 'ybm-ds');
// 사이트가 쓰는 것만: 입구 CSS + 레이어 5개 + 글꼴 4굵기 (base.css 가 400~700 만 선언)
const FILES = ['ybm-ds.css', 'tokens.css', 'base.css', 'icons.css', 'components.css', 'utilities.css',
  'fonts/Pretendard-Regular.woff2', 'fonts/Pretendard-Medium.woff2', 'fonts/Pretendard-SemiBold.woff2', 'fonts/Pretendard-Bold.woff2'];

if (!fs.existsSync(DS)) { console.error('ybm-ds 저장소가 없습니다: ' + DS); process.exit(1); }
const git = args => execFileSync('git', ['-C', DS, ...args], { maxBuffer: 64 * 1024 * 1024 });
git(['fetch', '-q', 'origin']);
const rev = git(['rev-parse', '--short', 'origin/main']).toString().trim();
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
for (const f of FILES) fs.writeFileSync(path.join(OUT, f), git(['show', 'origin/main:dist/' + f]));
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), `ybm-ds origin/main ${rev} (${new Date().toISOString().slice(0, 10)} 복사) - scripts/sync-ybm-ds.js 가 만든 사본, 직접 고치지 말 것\n`);
console.log(`ybm-ds ${rev} → ybm-ds/ (${FILES.length}개)`);
