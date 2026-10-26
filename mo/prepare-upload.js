'use strict';

/**
 * prepare-upload.js
 *
 * upload-list.txt에서 아직 준비되지 않은 신규 파일만 추려
 * (업로드)/ 폴더에 카테고리 구조 그대로 복사한다.
 * 회사 서버에는 이미지만 올린다 (2026-10-26~). 사이트 파일(index.html·data.js 등)은 GitHub Pages 가 배포하므로 담지 않는다.
 *
 * .last-upload 파일에 "이미 준비 완료된 파일 경로" 목록을 한 줄에 하나씩 기록한다
 * (2026-07-10 이전에는 날짜 문자열 하나만 기록했으나, 아래 버그로 인해 파일 단위로 전환).
 * 재준비가 필요하면 .last-upload 파일을 삭제하고 다시 실행 — 이 경우 전체 이력을 다시 담는다.
 *
 * [2026-07-10 버그 수정] 이전 로직은 마커를 "날짜 문자열"로만 저장하고
 * `섹션날짜 > 마커날짜` 로만 비교했다. update.bat을 하루에 여러 번 돌리면
 * upload-list.txt는 같은 날짜([YYYY-MM-DD]) 섹션에 새 파일을 계속 병합하는데,
 * 그날 이미 한 번 prepare-upload를 돌려 마커가 "오늘"로 찍혀 있으면
 * `오늘 > 오늘`은 항상 false라서 그날 나중에 추가된 파일은 영원히 다시 담기지 않았다
 * (web/에서 실제로 발생 — 같은 날짜 섹션에 나중에 추가된 서비스 이미지가
 * 이후 실행마다 "신규 없음"으로 판정되어 (업로드)/에 전혀 담기지 않고,
 * 서버에 이미지가 끝내 올라가지 않는 사고로 이어짐).
 * 지금은 "이미 준비된 파일 경로 집합"을 직접 기록해 파일 단위로 diff하므로
 * 같은 날짜 섹션이라도 새로 추가된 파일은 정확히 잡힌다.
 * 기존(.last-upload가 날짜 문자열 하나뿐인) 파일을 만나면, 그 날짜 이전 섹션은
 * 이미 준비된 것으로 간주하되 그 날짜와 정확히 같은 섹션은 안전을 위해
 * "전부 미준비"로 보고 한 번 더 재확인/재포함한다 (중복 복사는 무해함).
 *
 * 이 스크립트의 모든 출력은 콘솔뿐 아니라 prepare-upload-debug.log 파일에도
 * 그대로 기록된다 (배치 콘솔 출력이 씹히는 문제와 무관하게 항상 확인 가능하도록).
 * 예외가 발생해도 스택트레이스를 로그 파일에 남기고 종료한다.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE       = __dirname;
const UPLOAD_LIST = path.join(BASE, 'upload-list.txt');
const STAGE_DIR    = path.join(BASE, '(업로드)');
const MARKER_FILE  = path.join(BASE, '.last-upload');
const DEBUG_LOG   = path.join(BASE, 'prepare-upload-debug.log');

// 로그 파일 초기화
try { fs.writeFileSync(DEBUG_LOG, '', 'utf8'); } catch (_) {}

function log(msg) {
  console.log(msg);
  try { fs.appendFileSync(DEBUG_LOG, msg + '\n', 'utf8'); } catch (_) {}
}

function logErr(msg) {
  console.error(msg);
  try { fs.appendFileSync(DEBUG_LOG, msg + '\n', 'utf8'); } catch (_) {}
}

log('[시작] prepare-upload.js ' + new Date().toISOString());
log('[정보] BASE = ' + BASE);
log('[정보] node = ' + process.version);

try {
  // ── upload-list.txt 파싱 ─────────────────────────────────────────────────
  function parseUploadList() {
    if (!fs.existsSync(UPLOAD_LIST)) {
      logErr('[오류] upload-list.txt를 찾을 수 없습니다. 루트의 업데이트.bat을 먼저 실행하세요.');
      process.exitCode = 1;
      return null;
    }
    const sections = {};
    let cur = null;
    for (const raw of fs.readFileSync(UPLOAD_LIST, 'utf8').split('\n')) {
      const line = raw.trim();
      const m = line.match(/^\[(\d{4}-\d{2}-\d{2})\]$/);
      if (m)                { cur = m[1]; sections[cur] = []; }
      else if (cur && line) { sections[cur].push(line); }
    }
    return sections;
  }

  // ── .last-upload 마커 파싱 (레거시 날짜 형식 / 신규 파일목록 형식 겸용) ──────
  function loadMarker(allDates, sections) {
    const doneFiles = new Set();
    if (!fs.existsSync(MARKER_FILE)) {
      return { doneFiles, migrated: false };
    }
    const lines = fs.readFileSync(MARKER_FILE, 'utf8')
      .split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    const isLegacyDate = lines.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(lines[0]);
    if (!isLegacyDate) {
      lines.forEach(function (f) { doneFiles.add(f); });
      return { doneFiles, migrated: false };
    }

    // 레거시: 날짜 문자열 하나. 그 날짜보다 "이전" 섹션만 완료로 간주하고,
    // 그 날짜와 "같은" 섹션은 통째로 재확인 대상으로 남긴다 (버그로 누락됐을 수 있으므로).
    const legacyDate = lines[0];
    for (const d of allDates) {
      if (d < legacyDate) {
        for (const f of sections[d]) doneFiles.add(f);
      }
    }
    log('[정보] 레거시 날짜 마커(' + legacyDate + ') 감지 → 파일 단위 마커로 전환');
    log('[정보]   해당 날짜(' + legacyDate + ') 섹션은 안전을 위해 전부 재확인합니다 (이미 서버에 있으면 덮어쓰기만 됨)');
    return { doneFiles, migrated: true };
  }

  const sections = parseUploadList();
  if (!sections) {
    log('[종료] upload-list.txt 없음으로 중단');
  } else {
    const allDates = Object.keys(sections).sort().reverse(); // 최신순
    log('[정보] upload-list.txt 날짜 섹션 수 = ' + allDates.length);

    const marker = loadMarker(allDates, sections);
    const doneFiles = marker.doneFiles;
    log('[정보] 기존 준비 완료 파일 수 = ' + doneFiles.size);

    // 오래된 날짜 → 최신 날짜 순으로 신규 파일 수집 (파일 단위 diff)
    const ascDates = allDates.slice().reverse();
    const newEntries = []; // { date, file }
    for (const d of ascDates) {
      for (const f of sections[d]) {
        if (!doneFiles.has(f)) newEntries.push({ date: d, file: f });
      }
    }

    const hasNewImages = newEntries.length > 0;
    log('[정보] 신규 파일 수 = ' + newEntries.length);

    // 폴더 자체를 통째로 rmSync 하면 일부 파일/폴더가 다른 프로그램(탐색기, 백신 등)에
    // 의해 잠겨 있을 때 EPERM/EBUSY로 스크립트 전체가 중단된다. 그 대신 내용물만
    // 하나씩 지우고, 지워지지 않는 항목은 경고만 남기고 넘어간다.
    // RESUME=1 : 중간에 끊긴 준비를 이어서 한다 (폴더를 비우지 않고, 같은 크기로 이미 복사된 파일은 건너뜀)
    const RESUME = process.env.RESUME === '1';
    if (RESUME) log('[정보] RESUME=1 — 기존 (업로드) 내용을 유지하고 이어서 복사');
    if (!RESUME && fs.existsSync(STAGE_DIR)) {
      log('[정보] 기존 (업로드) 폴더 내용 정리 시도');
      let entries = [];
      try { entries = fs.readdirSync(STAGE_DIR); } catch (e) { log('[경고] 폴더 읽기 실패: ' + e.message); }
      for (const entry of entries) {
        const p = path.join(STAGE_DIR, entry);
        try {
          fs.rmSync(p, { recursive: true, force: true });
        } catch (e) {
          log('[경고] 삭제 실패(건너뜀, 다른 프로그램이 사용 중일 수 있음): ' + p + ' -> ' + e.message);
        }
      }
    }
    fs.mkdirSync(STAGE_DIR, { recursive: true });
    log('[정보] (업로드) 폴더 준비 완료');

    let totalFiles = 0;
    const catSet = new Set();
    const missing = [];

    if (hasNewImages) {
      for (const entry of newEntries) {
        const filePath = entry.file;
        const src = path.join(BASE, filePath);
        if (!fs.existsSync(src)) {
          missing.push(filePath);
          continue;
        }
        const dest = path.join(STAGE_DIR, filePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        let same = false;
        if (RESUME) { try { same = fs.statSync(dest).size === fs.statSync(src).size; } catch (_) {} }
        if (!same) fs.copyFileSync(src, dest);
        totalFiles++;
        catSet.add(filePath.split(/[\\/]/)[0]);
      }
    }
    log('[정보] 복사한 이미지 수 = ' + totalFiles + ', 누락 = ' + missing.length);

    // 마커 갱신: 지금까지 "완료"로 확인된 파일 전체 집합을 파일 단위로 기록.
    // (레거시 마이그레이션만 일어나고 신규 파일이 없어도 항상 새 형식으로 다시 써서
    //  다음 실행부터는 파일 단위 로직만 타도록 한다.)
    const finalDone = new Set(doneFiles);
    newEntries.forEach(function (e) { finalDone.add(e.file); });
    fs.writeFileSync(MARKER_FILE, Array.from(finalDone).join('\n') + '\n', 'utf8');
    log('[정보] .last-upload 갱신 (파일 단위, 총 ' + finalDone.size + '개)');

    log('');
    log('========================================');
    log('  업로드 준비 완료');
    log('========================================');

    if (!hasNewImages) {
      log('  신규 이미지는 없습니다.');
    } else {
      const catList = Array.from(catSet).sort();
      const entryDates = newEntries.map(function (e) { return e.date; }).sort();
      log('  이미지     : ' + totalFiles + '개');
      log('  카테고리   : ' + catSet.size + '개');
      log('  날짜 범위  : ' + entryDates[0] + ' ~ ' + entryDates[entryDates.length - 1]);
      log('');
      log('  포함 카테고리:');
      catList.forEach(function (c) { log('    - ' + c); });

      if (missing.length) {
        log('');
        log('  [경고] 로컬에서 파일을 찾지 못함 (' + missing.length + '개):');
        missing.slice(0, 5).forEach(function (f) { log('    - ' + f); });
        if (missing.length > 5) log('    ... 외 ' + (missing.length - 5) + '개');
      }
    }

    log('');
    log('  (업로드) 폴더를 직접 올리지 말고, 이어서 만들어지는 zip 파일만 전부 올리세요.');
    log('  (폴더째 올리면 일부 카테고리 폴더가 통째로 빠지는 사고가 반복됨 — 2026-09-03, 2026-10-21)');
    log('     신규 이미지만 들어 있습니다 (사이트 파일은 GitHub 가 배포).');
    log('========================================');
    log('');
    log('  재준비가 필요하면 .last-upload 파일 삭제 후 재실행 (전체 이력 재포함)');
    log('');

    try { execSync('explorer "' + STAGE_DIR + '"'); } catch (_) {}
  }
} catch (e) {
  logErr('[예외 발생] ' + (e && e.stack ? e.stack : String(e)));
  process.exitCode = 1;
}

log('[종료] prepare-upload.js 완료');
