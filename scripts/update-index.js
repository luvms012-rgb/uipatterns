/**
 * update-index.js
 * 이미지 폴더(카테고리별 하위 폴더)를 스캔해서 <platform>/data.js 를 갱신합니다.
 * + 새로 발견된 서비스는 <platform>/svc-types.js 의 SVC_TYPES(업종)에도 자동 매핑합니다 (API 키 불필요, 완전 오프라인).
 *
 * 보통은 직접 실행하지 않고 scripts/update.js(업데이트.bat / 업데이트.command)가 불러 씁니다.
 * 단독 실행: node scripts/update-index.js <mo|web> <이미지 폴더 경로>
 *
 * 업종 자동 매핑 (ANTHROPIC_API_KEY 없이 동작):
 *   1) 반대편 사이트(mo↔web)의 SVC_TYPES에 같은 서비스가 있으면 그 업종을 재사용
 *   2) 없으면 로컬 키워드 사전으로 추정
 *   3) 그래도 모르면 '미분류'로 남김 (사이드바에 '미분류'로 표시, 수동 지정 가능)
 *
 * 예전(서버 폴더에서 index.html을 직접 고치던 버전)과 달라진 점:
 *   - 데이터는 index.html이 아니라 data.js, 업종은 svc-types.js 에 쓴다.
 *   - 이미지 폴더와 저장소 폴더가 분리됐다 (이미지는 회사 PC에만 있고 서버엔 수동 업로드).
 *   - backups/ 폴더 대신 git 기록이 백업 역할을 한다.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const REPO      = path.join(__dirname, '..');
const LOCK_FILE = path.join(REPO, '.update.lock');
const LOCK_MAX_AGE_MS = 5 * 60 * 1000; // 5분 이상 지난 락은 죽은 프로세스로 간주하고 무시
const IMG_EXTS  = /\.(png|jpg|jpeg|webp|gif|avif)$/i;

// 이미지 폴더 안에서 카테고리로 보지 않을 폴더
const EXCLUDE = new Set(['node_modules', '.git', 'images', '$RECYCLE.BIN', '(업데이트)', '(업로드)', 'icons', 'backups']);

// ─── 공용 유틸: JS 소스에서 리터럴 블록 추출 ──────────────────────────────────
// (DATA/SVC_TYPES/ALL_INDUSTRY_TYPES 모두 `const NAME = [...]` 또는 `{...}` 형태)
function findLiteralBlock(src, varName) {
  const marker = `const ${varName} = `;
  const s = src.indexOf(marker);
  if (s === -1) return null;
  let i = src.indexOf('=', s) + 1;
  while (src[i] === ' ' || src[i] === '\n') i++;
  const openChar  = src[i];
  const closeChar = openChar === '[' ? ']' : '}';
  if (openChar !== '[' && openChar !== '{') return null;
  let depth = 0, start = i;
  for (; i < src.length; i++) {
    if (src[i] === openChar) depth++;
    else if (src[i] === closeChar) { depth--; if (depth === 0) { i++; break; } }
  }
  return { text: src.slice(start, i), start, end: i };
}

function parseLiteral(text) {
  // svc-types.js의 SVC_TYPES/ALL_INDUSTRY_TYPES는 작은따옴표 JS 객체/배열 리터럴이라
  // JSON.parse 대신 실제 JS로 평가한다 (신뢰된 로컬 파일이므로 안전).
  return new Function('"use strict"; return (' + text + ');')();
}

// ─── 오프라인 업종 키워드 사전 ──────────────────────────────────────────────────
// 서비스명 + 수집된 카테고리·화면명을 합친 문자열에서 부분일치로 찾는다.
// 오분류를 피하려 브랜드명·도메인 고유어 위주의 고정밀 키워드만 넣었다(모르면 미분류가 기본).
// 값(업종)이 그 사이트의 ALL_INDUSTRY_TYPES에 없으면 자동으로 건너뛴다
// (예: web에는 없는 '메신저'·'소개팅' 항목은 web 실행 시 무시됨).
// 위에서부터 먼저 맞는 업종을 채택하므로, 구체적/저모호 업종을 앞쪽에 둔다.
const TYPE_KEYWORDS = [
  ['금융',           ['뱅크','bank','pay','증권','보험','대출','송금','계좌','자산','투자','금융','은행','적금','예금','핀테크','토스','카카오뱅크','케이뱅크','신한','국민카드','미래에셋','삼성증권','키움','나무증권','뱅크샐러드']],
  ['의료',           ['병원','의료','진료','처방','약국','클리닉','메디','medi','치과','안과','한의원','비대면진료','굿닥','똑닥','닥터','doctor','환자','건강검진']],
  ['배달&음식&주류', ['배달','맛집','레시피','delivery','배민','요기요','쿠팡이츠','와인','맥주','주류','식당','메뉴','푸드','food','먹거리','다이닝']],
  ['부동산',         ['부동산','매물','아파트','전세','월세','직방','다방','호갱노노','청약','분양','realestate']],
  ['모빌리티',       ['택시','대리운전','주차','킥보드','따릉이','모빌리티','렌터카','내비','navigation','코레일','카셰어','쏘카','그린카','지하철','버스노선','mobility']],
  ['여행',           ['여행','항공','호텔','숙소','여기어때','야놀자','항공권','travel','투어','마이리얼트립','트리바고','agoda','여권','트립','trip']],
  ['채용',           ['채용','구인','이력서','취업','잡코리아','사람인','워크넷','recruit','알바','인크루트','링크드인','linkedin','커리어']],
  ['교육&도서',      ['교육','강의','인강','학원','전자책','ebook','밀리의서재','리디','교보문고','토익','수능','어학','클래스101','단어장','학습지','스터디','study']],
  ['운동&건강',      ['운동','헬스','피트니스','fitness','홈트','요가','러닝','만보','걸음','다이어트','칼로리','workout','스포츠','골프','바디프로필']],
  ['뷰티',           ['뷰티','화장품','메이크업','코스메틱','beauty','올리브영','네일','미용','스킨케어','화해','glowpick']],
  ['반려동물',       ['반려','펫케어','petcare','강아지','고양이','사료','멍냥','펫프렌즈']],
  ['육아',           ['육아','아기','베이비','baby','키즈','kids','임신','출산','어린이집','분유','기저귀','유아']],
  ['게임',           ['게임','game','pubg','배틀그라운드','rpg','puzzle','스팀','steam','e스포츠']],
  ['음악',           ['음악','music','멜론','지니뮤직','플로','벅스','스포티파이','spotify','플레이리스트','가사','앨범']],
  ['OTT',            ['ott','넷플릭스','netflix','왓챠','티빙','웨이브','디즈니','disney','쿠팡플레이','스트리밍','라프텔','애니메이션']],
  ['소개팅',         ['소개팅','데이팅','dating','틴더','tinder','아만다','글램','위피','이상형','매칭앱']],
  ['메신저',         ['메신저','messenger','카카오톡','텔레그램','telegram','왓츠앱','whatsapp','디스코드','discord']],
  ['SNS',            ['인스타','instagram','페이스북','facebook','틱톡','tiktok','스레드','threads','트위터']],
  ['커뮤니티',       ['커뮤니티','community','동호회','모임','포럼','forum','에브리타임','블라인드','오픈채팅','게시판','디시']],
  ['심리',           ['심리','멘탈','명상','mental','힐링','상담','마음챙김','mindfulness','트로스트','감정일기','무드']],
  ['AI',             ['챗gpt','chatgpt','gpt','챗봇','chatbot','인공지능','클로바','뤼튼','생성형','프롬프트','llm']],
  ['IoT',            ['iot','스마트홈','스마트싱스','사물인터넷','기기연동']],
  ['농업',           ['농업','농장','farm','작물','농산물','스마트팜','축산','농협']],
  ['적립',           ['적립','포인트','리워드','reward','캐시백','cashback','스탬프','멤버십','membership','캐시워크','오퀴즈']],
  ['비즈니스툴',     ['협업','crm','erp','비즈니스','노션','notion','슬랙','slack','jira','컨플루언스','근태','전자결재','세금계산서','사업자','관리자툴','admin']],
  ['콘텐츠',         ['웹툰','웹소설','툰','만화','포스타입','매거진','아티클','뉴스레터','블로그','카툰']],
  ['커머스',         ['쇼핑','커머스','commerce','마켓','쿠팡','11번가','지마켓','옥션','무신사','에이블리','지그재그','브랜디','오늘의집','당근마켓','중고거래','장바구니','쇼핑몰','스토어','이커머스']],
  ['도구',           ['계산기','변환기','qr코드','캘린더','calendar','메모장','todo','번역','translate','날씨','weather','알람','타이머','스캐너','유틸리티']],
  ['일상',           ['가계부','습관','routine','체크리스트','버킷리스트','생활관리','다이어리앱']],
];

// ─── 동시 실행 방지 락 ──────────────────────────────────────────────────────
// 두 번 연달아 실행해 data.js 쓰기가 겹치면 파일이 잘릴(truncate) 수 있다. 락 파일은
// 삭제하지 않고 내용만 덮어써서 상태를 표시한다 (일부 폴더는 삭제/이름변경이 막혀 있고 덮어쓰기만 가능하기 때문).
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      const age = Date.now() - state.ts;
      if (state.status === 'running' && age < LOCK_MAX_AGE_MS) {
        console.log('\n[대기중] 다른 업데이트가 진행 중인 것 같습니다.');
        console.log('   잠시 후 다시 실행해 주세요.\n');
        return false;
      }
    } catch (_) {
      // 락 파일이 깨져 있으면 무시하고 진행
    }
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, status: 'running', ts: Date.now() }), 'utf-8');
  return true;
}
function releaseLock() {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, status: 'idle', ts: Date.now() }), 'utf-8');
  } catch (_) {}
}

/**
 * items(이번 스캔 결과) 기준으로 SVC_TYPES에 없는 서비스의 업종을 API 없이 채운다.
 *  1) 반대편 사이트(mo↔web)의 SVC_TYPES에 같은 서비스가 있으면 그 업종을 재사용(정확)
 *  2) 없으면 TYPE_KEYWORDS 사전으로 추정
 *  3) 그래도 모르면 '미분류'로 남긴다(SVC_TYPES에 넣지 않음 → 사이드바 '미분류')
 * 어느 경로든 그 사이트의 ALL_INDUSTRY_TYPES에 실제로 존재하는 업종만 사용한다
 * (web에 없는 '메신저' 같은 mo 전용 업종이 섞이지 않도록 클램프).
 * 반환: 갱신된 svc-types.js 소스와 처리 요약
 */
function autoClassifyTypes(src, items, platform) {
  const svcBlock  = findLiteralBlock(src, 'SVC_TYPES');
  const typeBlock = findLiteralBlock(src, 'ALL_INDUSTRY_TYPES');

  if (!svcBlock || !typeBlock) {
    return { src, added: [], skipped: 'SVC_TYPES/ALL_INDUSTRY_TYPES 블록을 찾을 수 없음' };
  }

  let SVC_TYPES, ALL_TYPES;
  try {
    SVC_TYPES = parseLiteral(svcBlock.text);
    ALL_TYPES = parseLiteral(typeBlock.text);
  } catch (e) {
    return { src, added: [], skipped: 'SVC_TYPES/ALL_INDUSTRY_TYPES 파싱 실패: ' + e.message };
  }
  const typeSet = new Set(ALL_TYPES);

  // 서비스별 맥락(이번 스캔에서 등장한 카테고리·화면명) 수집
  const bySvc = {};
  for (const item of items) {
    if (item.category === 'icons') continue;
    const parts = item.name.split('_');
    const svc = parts[0].trim().normalize('NFC');
    if (!bySvc[svc]) bySvc[svc] = { cats: new Set(), pats: new Set() };
    bySvc[svc].cats.add(item.category);
    if (parts.length > 3) bySvc[svc].pats.add(parts.slice(1, -2).join(' '));
  }

  const unmapped = Object.keys(bySvc).filter(s => !SVC_TYPES[s]);
  if (!unmapped.length) return { src, added: [], skipped: null };

  // 1) 반대편 사이트의 SVC_TYPES 로드(재사용용). 없거나 깨져도 조용히 건너뜀.
  const sibling      = platform === 'mo' ? 'web' : 'mo';
  const siblingFile  = path.join(REPO, sibling, 'svc-types.js');
  const siblingTypes = {};
  try {
    if (fs.existsSync(siblingFile)) {
      const sSrc   = fs.readFileSync(siblingFile, 'utf-8');
      const sBlock = findLiteralBlock(sSrc, 'SVC_TYPES');
      if (sBlock) {
        const parsed = parseLiteral(sBlock.text);
        for (const k of Object.keys(parsed)) siblingTypes[k.normalize('NFC')] = parsed[k];
      }
    }
  } catch (_) { /* 재사용 실패는 무시하고 키워드로 진행 */ }

  // 2) 키워드 매칭 (그 사이트 ALL_TYPES에 있는 업종만)
  function keywordType(svc) {
    const ctx = bySvc[svc];
    const hay = (svc + ' ' + [...ctx.cats].join(' ') + ' ' + [...ctx.pats].join(' ')).toLowerCase();
    for (const [type, kws] of TYPE_KEYWORDS) {
      if (!typeSet.has(type)) continue;
      for (const kw of kws) { if (hay.includes(kw)) return type; }
    }
    return null;
  }

  const added = [];          // 실제로 매핑된 것
  const stillUnmapped = [];   // 미분류로 남는 것
  let reuseCount = 0, kwCount = 0;
  let insertText = '';
  for (const svc of unmapped) {
    let type = null, via = null;
    const reused = siblingTypes[svc];
    // 반대편이 '미분류'/'기타'로 뒀거나 이 사이트에 없는 업종이면 재사용하지 않고 키워드로 넘어감
    if (reused && typeSet.has(reused) && reused !== '미분류' && reused !== '기타') {
      type = reused; via = 'reuse';
    }
    if (!type) { const kt = keywordType(svc); if (kt) { type = kt; via = 'keyword'; } }
    if (!type) { stillUnmapped.push(svc); continue; }
    const esc = svc.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    insertText += `  '${esc}':'${type}',\n`;
    added.push({ svc, type, via });
    if (via === 'reuse') reuseCount++; else kwCount++;
  }

  let newSrc = src;
  if (added.length) {
    const header = `\n  // 자동 매핑 (오프라인, update, ${new Date().toISOString().slice(0, 10)})\n`;
    newSrc = src.slice(0, svcBlock.end - 1) + header + insertText + src.slice(svcBlock.end - 1);
  }

  let skipped = null;
  if (stillUnmapped.length) {
    skipped = `미분류로 남긴 서비스 ${stillUnmapped.length}개 (재사용·키워드 모두 실패 — 사이드바 '미분류'로 표시, 필요시 ${platform}/svc-types.js에 직접 추가):\n` +
              `  ${stillUnmapped.slice(0, 12).join(', ')}${stillUnmapped.length > 12 ? ' 외 ' + (stillUnmapped.length - 12) + '개' : ''}`;
  }

  return { src: newSrc, added, skipped, reuseCount, kwCount };
}

// ─── data.js 읽기/쓰기 ───────────────────────────────────────────────────────
// 한 줄 = 이미지 1장 (git diff에서 추가·삭제된 이미지가 줄 단위로 보이도록)
function readData(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf-8');
  const block = findLiteralBlock(src, 'DATA');
  return block ? JSON.parse(block.text) : [];
}
function writeData(file, items) {
  fs.writeFileSync(file,
    '// 데이터 — scripts/update-index.js 가 자동으로 갱신합니다. 직접 수정 금지.\n' +
    '// 한 줄 = 이미지 1장 (git diff에서 추가·삭제된 이미지가 줄 단위로 보이도록)\n' +
    '// __DATA_START__\nconst DATA = [\n' +
    items.map(i => '  ' + JSON.stringify(i)).join(',\n') +
    '\n];\n// __DATA_END__\n', 'utf-8');
}

// 이미지 폴더 스캔 → [{ category, name, path }]
// 정렬은 문자 코드 순(기존 서버 데이터와 같은 순서) — OS마다 readdir 순서가 달라도 data.js가 똑같이 나오도록.
// 이름은 NFC로 맞춘다 (맥에서 복사한 파일은 한글이 자모 분리(NFD)된 이름일 수 있음).
function scanImages(imageDir) {
  const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const catDirs = fs.readdirSync(imageDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !EXCLUDE.has(d.name))
    .map(d => ({ dirName: d.name, category: d.name.normalize('NFC') }))
    .sort((a, b) => byCode(a.category, b.category));

  const items = [];
  for (const { dirName, category } of catDirs) {
    let files;
    try {
      files = fs.readdirSync(path.join(imageDir, dirName))
        .filter(f => IMG_EXTS.test(f))
        .map(f => f.normalize('NFC'))
        .sort(byCode);
    } catch (_) { continue; }

    for (const f of files) {
      const name = path.basename(f, path.extname(f));
      items.push({ category, name, path: `${category}/${f}` });
    }
  }
  return items;
}

/**
 * 한 플랫폼(mo/web) 갱신. 반환: { total, prevTotal, newItems, removed, typeResult }
 * opts.dryRun 이면 파일을 쓰지 않고 결과만 계산한다 (scripts/update.js의 안전 확인용).
 */
function updatePlatform(platform, imageDir, opts = {}) {
  const BASE      = path.join(REPO, platform);
  const DATA_FILE = path.join(BASE, 'data.js');
  const SVC_FILE  = path.join(BASE, 'svc-types.js');

  if (!fs.existsSync(imageDir)) throw new Error(`이미지 폴더를 찾을 수 없습니다: ${imageDir}`);

  const items = scanImages(imageDir);

  // 이미지별 컴포넌트 — <platform>/components.json { "카테고리/파일.png": ["버튼", "탭"] }
  // 캡처할 때 uibowl 이미지의 components(componentCodeName)를 이 파일에 모아 두면 사이드바 컴포넌트 필터에 쓰인다.
  const COMP_FILE = path.join(BASE, 'components.json');
  if (fs.existsSync(COMP_FILE)) {
    const comps = JSON.parse(fs.readFileSync(COMP_FILE, 'utf-8'));
    const byPath = new Map(Object.entries(comps).map(([k, v]) => [k.normalize('NFC'), v]));
    for (const item of items) {
      const c = byPath.get(item.path);
      if (c && c.length) item.comps = [...new Set(c)];
    }
  }

  // 화면 대표 색 — <platform>/colors.json { "카테고리/파일.png": "블루" } (scripts/colors.ps1, Windows 에서만 뽑는다)
  // 사이드바 컬러 필터에 쓰인다. 아직 안 뽑은 화면은 color 가 없다
  const COLOR_FILE = path.join(BASE, 'colors.json');
  if (fs.existsSync(COLOR_FILE)) {
    const colors = JSON.parse(fs.readFileSync(COLOR_FILE, 'utf-8'));
    const byPath = new Map(Object.entries(colors).map(([k, v]) => [k.normalize('NFC'), v]));
    for (const item of items) {
      const c = byPath.get(item.path);
      if (c) item.color = c;
    }
  }

  const prev = readData(DATA_FILE);
  const prevPaths = new Set(prev.map(i => i.path));
  const curPaths  = new Set(items.map(i => i.path));
  const newItems  = items.filter(i => !prevPaths.has(i.path));
  const removed   = prev.filter(i => !curPaths.has(i.path));
  const result = { platform, total: items.length, prevTotal: prev.length, newItems, removed, typeResult: null };
  if (opts.dryRun) return result;

  writeData(DATA_FILE, items);

  // ── 업종(SVC_TYPES) 자동 매핑 ────────────────────────────────────────────
  const svcSrc = fs.readFileSync(SVC_FILE, 'utf-8');
  const typeResult = autoClassifyTypes(svcSrc, items, platform);
  if (typeResult.src !== svcSrc) fs.writeFileSync(SVC_FILE, typeResult.src, 'utf-8');
  result.typeResult = typeResult;

  // version.js 갱신 — 로컬 미리보기(file://)에서 열린 페이지가 이 값을 폴링해 변경 시 자동 새로고침
  const dataStr = JSON.stringify(items);
  const hash = crypto.createHash('md5').update(dataStr).digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(BASE, 'version.js'), `window.__UIP_VER = "${hash}";\n`, 'utf-8');

  // upload-list.txt: 새롭게 추가된 항목을 파일명 날짜 기준으로 누적 기록
  const UPLOAD_LIST = path.join(BASE, 'upload-list.txt');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');

  // 기존 파일에서 이미 기록된 path 목록 추출
  let knownPaths = new Set();
  let prevContent = '';
  if (fs.existsSync(UPLOAD_LIST)) {
    prevContent = fs.readFileSync(UPLOAD_LIST, 'utf-8');
    prevContent.split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('[')) knownPaths.add(t);
    });
  }

  // 업로드 목록 기준으로 새로 추가된 항목 (data.js 기준 newItems와 거의 같지만, 목록은 누적이라 따로 비교)
  const listNew = items.filter(i => !knownPaths.has(i.path));

  if (listNew.length > 0) {
    // 파일명에서 날짜 추출: _YYYYMMDD.ext → 'YYYY-MM-DD'
    function extractDate(filePath) {
      const m = filePath.match(/_(\d{8})\.(png|jpg|jpeg|webp)$/i);
      if (!m) return null;
      const d = m[1];
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    }

    // 날짜별로 그룹핑
    const byDate = new Map();
    for (const item of listNew) {
      const d = extractDate(item.path) || `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(item.path);
    }

    // 기존 파일도 날짜별로 파싱
    const existing = new Map();
    let curDate = null;
    for (const line of prevContent.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('[') && t.endsWith(']')) { curDate = t.slice(1,-1); continue; }
      if (curDate) {
        if (!existing.has(curDate)) existing.set(curDate, []);
        existing.get(curDate).push(t);
      }
    }

    // 신규 항목을 기존 맵에 병합
    for (const [d, paths] of byDate) {
      if (!existing.has(d)) existing.set(d, []);
      existing.get(d).push(...paths);
    }

    // 날짜 내림차순으로 전체 재작성
    const sortedDates = [...existing.keys()].sort((a, b) => b.localeCompare(a));
    const out = [];
    for (const d of sortedDates) {
      out.push(`[${d}]`);
      out.push(...existing.get(d).sort());
      out.push('');
    }
    fs.writeFileSync(UPLOAD_LIST, out.join('\n'), 'utf-8');
  }

  // stats.json 갱신 — 대시보드 통합 집계용
  const cats2 = [...new Set(items.map(i => i.category))];
  const svcs2 = [...new Set(items.map(i => i.name.split('_')[0]))];
  const statsObj = {
    platform,
    totalScreens:    items.length,
    totalServices:   svcs2.length,
    totalCategories: cats2.length,
    updatedAt:       new Date().toISOString()
  };
  fs.writeFileSync(path.join(BASE, 'stats.json'), JSON.stringify(statsObj, null, 2), 'utf-8');
  // stats.js — file://로 로컬에서 열었을 때 fetch()가 다른 폴더(mo/web) 파일을 못 읽는 문제를
  // 우회하기 위한 <script> 주입용 사본. version.js 자동새로고침과 동일한 패턴.
  fs.writeFileSync(path.join(BASE, 'stats.js'), `window.__STATS__ = ${JSON.stringify(statsObj)};\n`, 'utf-8');

  // search-index.js — 통합검색(크로스사이트)용 인덱스. 상대편 사이트가 이 파일을
  // <script> 주입으로 읽어간다 (stats.js와 동일 패턴, file://에서 fetch로 다른 폴더를
  // 못 읽는 문제 우회). index.html의 onSearchInput()과 동일한 로직으로 계산 —
  // extractService/extractPattern 정의를 바꿀 때는 이 블록도 같이 맞출 것.
  function extractServiceForSearch(name) {
    return name.split('_')[0].trim().normalize('NFC');
  }
  function extractPatternForSearch(name) {
    const parts = name.split('_');
    if (parts.length <= 3) return '';
    return parts.slice(1, -2).join(' ');
  }

  const searchCats = [...new Set(items.map(i => i.category))].sort((a, b) => a.localeCompare(b, 'ko'));

  const svcMapForSearch = new Map();
  for (const item of items) {
    if (item.category === 'icons') continue;
    const svc = extractServiceForSearch(item.name);
    if (!svcMapForSearch.has(svc)) svcMapForSearch.set(svc, { cat: item.category, count: 0 });
    svcMapForSearch.get(svc).count++;
  }
  const searchSvcs = [...svcMapForSearch.entries()].map(([svc, info]) => ({ svc, cat: info.cat, count: info.count }));

  const patMapForSearch = new Map();
  for (const item of items) {
    if (item.category === 'icons') continue;
    const pat = extractPatternForSearch(item.name);
    if (!pat) continue;
    const svc = extractServiceForSearch(item.name);
    const key = pat + '|' + svc;
    if (!patMapForSearch.has(key)) {
      patMapForSearch.set(key, { pat, svc, cat: item.category, path: item.path, name: item.name });
    }
  }
  const searchPats = [...patMapForSearch.values()];

  // 카테고리별 화면 수 — 검색 자동완성의 "모바일 338 · 웹 255" 표시용
  const catCounts = {};
  for (const item of items) if (item.category !== 'icons') catCounts[item.category] = (catCounts[item.category] || 0) + 1;

  const searchIndexObj = {
    platform,
    cats: searchCats,
    catCounts,
    svcs: searchSvcs,
    pats: searchPats,
  };
  fs.writeFileSync(path.join(BASE, 'search-index.js'), `window.__SEARCH_INDEX__ = ${JSON.stringify(searchIndexObj)};\n`, 'utf-8');

  return result;
}

module.exports = { updatePlatform, acquireLock, releaseLock };

// 단독 실행: node scripts/update-index.js <mo|web> <이미지 폴더>
if (require.main === module) {
  const [platform, imageDir] = process.argv.slice(2);
  if (!['mo', 'web'].includes(platform) || !imageDir) {
    console.log('사용법: node scripts/update-index.js <mo|web> <이미지 폴더 경로>');
    process.exit(1);
  }
  if (!acquireLock()) process.exit(0);
  try {
    const r = updatePlatform(platform, imageDir);
    console.log(`[${platform}] 총 ${r.total}장 (신규 ${r.newItems.length} · 삭제 ${r.removed.length})`);
  } catch (e) {
    console.error('\n❌  예외 발생:', e.message, '\n');
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}
