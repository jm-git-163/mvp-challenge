#!/usr/bin/env node
/**
 * CI guard (CLAUDE.md §3 FORBIDDEN #13 + §4.5):
 *   "engine/session/mediaSession.ts 에서만 getUserMedia 호출"
 *
 * 챌린지/녹화 진입마다 마이크·카메라 권한 팝업이 재발하던 회귀 방지용.
 *
 * 허용 경로 (런타임 단일 진입점 + 테스트/진단 전용):
 *   - engine/session/mediaSession.ts      (단일 진입점)
 *   - engine/session/cameraSwap.ts        (mediaSession 동일 family, 주석 참조)
 *   - engine/session/compatibilityCheck.* (feature detection typeof 체크)
 *   - engine/session/permissionGate.*     (테스트 mocking)
 *   - engine/session/mediaSession.test.ts (테스트)
 *   - engine/session/cameraSwap.test.ts   (테스트)
 *   - app/debug/**, app/selftest/**       (진단/셀프테스트 페이지)
 *   - scripts/**                          (이 가드 본체)
 *
 * 그 외 파일에서 navigator.mediaDevices.getUserMedia 또는
 * .getUserMedia( 패턴 발견 시 실패.
 *
 * 실행: `node scripts/check-single-getusermedia.js`
 * CI:   pretest 훅 또는 lint 단계에 연결.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ALLOW = [
  'engine/session/mediaSession.ts',
  'engine/session/mediaSession.test.ts',
  'engine/session/cameraSwap.ts',
  'engine/session/cameraSwap.test.ts',
  'engine/session/compatibilityCheck.ts',
  'engine/session/compatibilityCheck.test.ts',
  'engine/session/permissionGate.ts',
  'engine/session/permissionGate.test.ts',
];
const ALLOW_PREFIX = [
  'app/debug/',
  'app/selftest/',
  'scripts/',
  'docs/',
  'files/',
  'node_modules/',
  'dist/',
  '.git/',
];
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
// Runtime call patterns only — ignore docs/comments as best we can by also checking context.
const PATTERNS = [
  /navigator\.mediaDevices\.getUserMedia\s*\(/,
  /mediaDevices\.getUserMedia\s*\(/,
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel  = path.relative(ROOT, full).replace(/\\/g, '/');
    if (ALLOW_PREFIX.some((p) => rel.startsWith(p))) continue;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      walk(full, out);
    } else if (SCAN_EXT.has(path.extname(e.name))) {
      out.push(rel);
    }
  }
  return out;
}

const offenders = [];
for (const rel of walk(ROOT)) {
  if (ALLOW.includes(rel)) continue;
  const abs = path.join(ROOT, rel);
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (PATTERNS.some((re) => re.test(L))) {
      // skip lines that are clearly in a line-comment
      const trim = L.trimStart();
      if (trim.startsWith('//') || trim.startsWith('*')) continue;
      offenders.push({ file: rel, line: i + 1, src: L.trim() });
    }
  }
}

if (offenders.length) {
  console.error('\n[check-single-getusermedia] 허용되지 않은 getUserMedia 직접 호출 발견:');
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.src}`);
  }
  console.error('\nCLAUDE.md §4.5 위반 — engine/session/mediaSession.ts 의 ensureMediaSession() 을 사용하세요.\n');
  process.exit(1);
}
console.log('[check-single-getusermedia] OK — 런타임 경로는 mediaSession 싱글톤만 getUserMedia 를 호출합니다.');
