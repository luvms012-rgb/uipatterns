// 예전 경로 호환용 — 기존 스크립트(classify-local.js 등)나 손에 익은 `node update-index.js`를
// 그대로 써도 되도록 새 스크립트(../scripts/update-index.js)로 넘긴다. 이 폴더 이름(mo/web)이 플랫폼.
const path = require('path');
const { updatePlatform, acquireLock, releaseLock } = require('../scripts/update-index');

const platform = path.basename(__dirname);
if (!acquireLock()) process.exit(0);
try {
  const r = updatePlatform(platform, __dirname);
  console.log(`\n[완료] ${platform}: 총 ${r.total}장 (신규 ${r.newItems.length} · 삭제 ${r.removed.length})`);
  console.log('   GitHub 반영은 저장소 폴더의 업데이트.bat 으로 하세요.\n');
} catch (e) {
  console.error('\n❌  예외 발생:', e.message, '\n');
  process.exitCode = 1;
} finally {
  releaseLock();
}
