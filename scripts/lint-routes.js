#!/usr/bin/env node
/**
 * scripts/lint-routes.js
 *
 * Phase 1 — `app/_layout.tsx` 내 <Stack.Screen name="X"> 선언을
 * 실제 `app/` 디렉터리/라우트 파일과 비교.
 *
 * 규칙 (Expo Router):
 *   - name="(group)"         → app/(group)/ 디렉터리 존재 필수 + 그 안에 최소 1개 route 파일
 *   - name="segment"         → app/segment/ 디렉터리 또는 app/segment.tsx 중 하나 존재
 *   - name="a/b" (슬래시)    → 중첩 라우트. app/a/b.tsx 또는 app/a/b/index.tsx 존재 필수
 *
 * 불일치 시 비-0 종료 코드. package.json의 test 스크립트 prelint 에서 호출.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(REPO_ROOT, 'app');
const LAYOUT_FILE = path.join(APP_DIR, '_layout.tsx');

function fail(msg) {
  process.stderr.write(`[lint-routes] ${msg}\n`);
  process.exit(1);
}

function extractNames(source) {
  // <Stack.Screen ... name="X" ... />
  const regex = /<Stack\.Screen\b[^>]*\bname=["']([^"']+)["']/g;
  const names = [];
  let m;
  while ((m = regex.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function hasRouteFilesIn(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  const entries = fs.readdirSync(dir);
  for (const e of entries) {
    const full = path.join(dir, e);
    const stat = fs.statSync(full);
    if (stat.isFile() && /\.(tsx|ts|jsx|js)$/.test(e) && e !== '_layout.tsx' && e !== '_layout.ts') {
      return true;
    }
    // group 내부에 또다른 group 이 있고 그 안에 route 가 있을 수도 있음
    if (stat.isDirectory() && /^\([^)]+\)$/.test(e)) {
      if (hasRouteFilesIn(full)) return true;
    }
    if (stat.isDirectory() && !e.startsWith('_')) {
      // 중첩 라우트 폴더
      if (hasRouteFilesIn(full)) return true;
    }
  }
  return false;
}

function checkName(name) {
  // group: (name)
  if (/^\([^)]+\)$/.test(name)) {
    const dir = path.join(APP_DIR, name);
    if (!fs.existsSync(dir)) {
      return `라우트 그룹 "${name}" 에 대응하는 디렉터리 app/${name}/ 이 없습니다.`;
    }
    if (!hasRouteFilesIn(dir)) {
      return `라우트 그룹 "${name}" 디렉터리가 존재하지만 내부에 route 파일이 없어 Expo Router 가 경고합니다.`;
    }
    return null;
  }

  // nested: a/b
  const segments = name.split('/');
  // 현재 지원하지 않는 "a/index" 형식 탐지 (Expo Router 가 자동으로 "a" 로 정규화하며 경고)
  if (segments[segments.length - 1] === 'index') {
    return `"${name}" 은 Expo Router 에서 "${segments.slice(0, -1).join('/')}" 로 정규화됩니다. /index 제거하세요.`;
  }

  // segment 또는 nested: app/<segments>.tsx 또는 app/<segments>/index.tsx 존재
  const fileCandidates = [
    path.join(APP_DIR, ...segments) + '.tsx',
    path.join(APP_DIR, ...segments) + '.ts',
    path.join(APP_DIR, ...segments, 'index.tsx'),
    path.join(APP_DIR, ...segments, 'index.ts'),
  ];
  const matched = fileCandidates.find((p) => fs.existsSync(p));
  if (!matched) {
    return `라우트 "${name}" 에 대응하는 파일을 찾을 수 없습니다. 기대 경로: ${fileCandidates.map((c) => path.relative(REPO_ROOT, c)).join(' | ')}`;
  }
  return null;
}

function main() {
  if (!fs.existsSync(LAYOUT_FILE)) fail(`${LAYOUT_FILE} 이 없습니다.`);
  const source = fs.readFileSync(LAYOUT_FILE, 'utf8');
  const names = extractNames(source);
  if (names.length === 0) {
    process.stdout.write('[lint-routes] Stack.Screen 선언이 없습니다. 통과.\n');
    return;
  }

  const errors = [];
  for (const n of names) {
    const e = checkName(n);
    if (e) errors.push(`  - name="${n}": ${e}`);
  }

  if (errors.length) {
    process.stderr.write('[lint-routes] 라우트 선언 검증 실패:\n');
    for (const err of errors) process.stderr.write(err + '\n');
    process.exit(1);
  }

  process.stdout.write(`[lint-routes] ${names.length}개 라우트 선언 모두 통과.\n`);
}

if (require.main === module) {
  main();
}

module.exports = { extractNames, checkName, hasRouteFilesIn };
