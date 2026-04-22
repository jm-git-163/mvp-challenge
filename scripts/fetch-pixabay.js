/**
 * scripts/fetch-pixabay.js
 *
 * POSE+THEME (2026-04-22) — Pixabay 일괄 다운로더 (실행 가능한 JS 구현).
 *
 * 같은 매니페스트를 scripts/fetch-pixabay.node.ts 가 type 정의·의도 문서로 보유.
 * 실제 실행은 node 24+ 내장 fetch 로 여기서 수행 (tsx 없어도 됨).
 *
 *  - API 키: 픽사베이 api2.txt / 픽사베이api.txt / env PIXABAY_API_KEY.
 *  - 라이선스: Pixabay Content License (CC0 유사 — 무료, 크레딧 권장).
 *    → 다운로드 성공 시 docs/ATTRIBUTIONS.md 에 자동 append.
 *  - idempotent: 목적 파일이 이미 존재하면 skip.
 *
 * 사용:
 *   npm run fetch:assets            # 전체
 *   node scripts/fetch-pixabay.js   # 동일
 */

/* eslint-disable no-console */

const path = require('node:path');
const fs = require('node:fs/promises');

// ─── 에셋 매니페스트 ─────────────────────────────────────────────────
//  destRel: public/ 기준 상대경로
//  query:   Pixabay 검색어
//  kind:    'music' | 'image'
//  minDurationSec: (music) 최소 길이
//  targetBpm: (music) 목표 BPM, ±6 허용
const ASSET_MANIFEST = [
  // ── BGM (챌린지 주제별) ───────────────────────────────────────────
  // 스쿼트/피트니스 — 강렬한 electronic workout
  { destRel: 'bgm/workout-electronic.mp3', kind: 'music',
    query: 'electronic workout energetic', minDurationSec: 30 },
  // 뉴스/앵커 — 차분한 corporate / jazz
  { destRel: 'bgm/news-corporate.mp3', kind: 'music',
    query: 'corporate news background', minDurationSec: 45 },
  // 표정/제스처 — 업비트 happy pop
  { destRel: 'bgm/pop-happy.mp3', kind: 'music',
    query: 'happy upbeat pop', minDurationSec: 30 },

  // ── 배경 이미지 ──────────────────────────────────────────────────
  { destRel: 'templates/news-anchor/studio.jpg', kind: 'image',
    query: 'news studio blue monitor' },
  { destRel: 'templates/neon-arena/bg-neon.jpg', kind: 'image',
    query: 'neon cyberpunk city night' },
  { destRel: 'templates/emoji-explosion/bg-pop.jpg', kind: 'image',
    query: 'pastel pink yellow gradient cute' },
];

async function readKeyFromTxt() {
  const candidates = [
    '픽사베이 api2.txt',
    '픽사베이api2.txt',
    '픽사베이api.txt',
    '픽사베이 api.txt',
  ];
  for (const name of candidates) {
    try {
      const p = path.resolve(process.cwd(), name);
      const s = (await fs.readFile(p, 'utf8')).trim();
      if (s.length >= 20) return s;
    } catch {
      /* next */
    }
  }
  return null;
}

function pickBestMusic(hits, spec) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  // 1) duration 필터  2) bpm 유사  3) 인기도(views)
  const filtered = hits.filter(h => !spec.minDurationSec || (h.duration ?? 0) >= spec.minDurationSec);
  const pool = filtered.length ? filtered : hits;
  const score = (h) => {
    let s = (h.views || 0) / 10000;
    if (spec.targetBpm && h.bpm) {
      const d = Math.abs(spec.targetBpm - h.bpm);
      s += Math.max(0, 20 - d);
    }
    return s;
  };
  return pool.slice().sort((a, b) => score(b) - score(a))[0];
}

function pickBestImage(hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  // 인기순(views) 으로
  return hits.slice().sort((a, b) => (b.views || 0) - (a.views || 0))[0];
}

async function appendAttribution(spec, hit) {
  const attrPath = path.resolve(process.cwd(), 'docs/ATTRIBUTIONS.md');
  const title = spec.kind === 'music'
    ? (hit.tags || spec.query)
    : (hit.tags || spec.query);
  const author = hit.user || 'Pixabay';
  const pageUrl = hit.pageURL || `https://pixabay.com/?id=${hit.id}`;
  const line = `- \`${spec.destRel}\` — “${title}” by ${author} · ${pageUrl} · Pixabay Content License\n`;
  try {
    let existing = '';
    try { existing = await fs.readFile(attrPath, 'utf8'); } catch { /* new */ }
    if (!existing.includes(spec.destRel)) {
      if (!existing) existing = '# Asset Attributions\n\nAll Pixabay assets licensed under the Pixabay Content License.\n\n';
      await fs.mkdir(path.dirname(attrPath), { recursive: true });
      await fs.writeFile(attrPath, existing + line, 'utf8');
    }
  } catch (e) {
    console.warn('[attrib] failed:', e.message);
  }
}

async function downloadAsset(spec, apiKey, outRoot) {
  const endpoint = spec.kind === 'music'
    ? `https://pixabay.com/api/music/?key=${apiKey}&q=${encodeURIComponent(spec.query)}&per_page=15`
    : `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(spec.query)}&per_page=15&image_type=photo&orientation=vertical`;

  console.log(`  [fetch] ${spec.destRel}  ← "${spec.query}"`);
  const res = await fetch(endpoint);
  if (!res.ok) {
    // music API is still in beta and may 404 for some keys. Fallback:
    // treat as "best effort" — try without orientation for image.
    console.warn(`    HTTP ${res.status} for ${spec.destRel}`);
    if (spec.kind === 'image') {
      // retry without orientation
      const alt = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(spec.query)}&per_page=15&image_type=photo`;
      const r2 = await fetch(alt);
      if (!r2.ok) throw new Error(`image fetch fail: ${r2.status}`);
      const j2 = await r2.json();
      const hit2 = pickBestImage(j2.hits);
      if (!hit2) throw new Error('no image hits');
      return saveImage(hit2, spec, outRoot);
    }
    throw new Error(`fetch failed: ${res.status}`);
  }
  const json = await res.json();

  if (spec.kind === 'music') {
    const hit = pickBestMusic(json.hits, spec);
    if (!hit) { console.warn(`    no music hits for "${spec.query}"`); return false; }
    // Pixabay music hits expose audio URL under various keys. Try in order.
    const audioUrl = hit.audio
      || hit.audioURL
      || hit.audio_url
      || (hit.audio_files && hit.audio_files[0]?.url)
      || hit.preview
      || hit.src;
    if (!audioUrl) { console.warn(`    music hit lacks audio URL (fields: ${Object.keys(hit).join(',')})`); return false; }
    const bin = await (await fetch(audioUrl)).arrayBuffer();
    const dest = path.join(outRoot, spec.destRel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(bin));
    await appendAttribution(spec, hit);
    console.log(`    ✓ saved ${(bin.byteLength / 1024).toFixed(0)} KB → ${spec.destRel}`);
    return true;
  } else {
    const hit = pickBestImage(json.hits);
    if (!hit) { console.warn(`    no image hits for "${spec.query}"`); return false; }
    return saveImage(hit, spec, outRoot);
  }
}

async function saveImage(hit, spec, outRoot) {
  const imgUrl = hit.largeImageURL || hit.webformatURL || hit.previewURL;
  if (!imgUrl) { console.warn(`    image hit lacks url (fields: ${Object.keys(hit).join(',')})`); return false; }
  const bin = await (await fetch(imgUrl)).arrayBuffer();
  const dest = path.join(outRoot, spec.destRel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(bin));
  await appendAttribution(spec, hit);
  console.log(`    ✓ saved ${(bin.byteLength / 1024).toFixed(0)} KB → ${spec.destRel}`);
  return true;
}

async function main() {
  const apiKey = process.env.PIXABAY_API_KEY || (await readKeyFromTxt());
  if (!apiKey) {
    console.error('✗ Pixabay API 키를 찾을 수 없음. 픽사베이api.txt 또는 env PIXABAY_API_KEY 설정 필요.');
    process.exit(1);
  }
  const outRoot = path.resolve(process.cwd(), 'public');
  console.log(`Pixabay fetch → ${outRoot}`);
  console.log(`매니페스트 ${ASSET_MANIFEST.length} 개 항목`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const spec of ASSET_MANIFEST) {
    const dest = path.join(outRoot, spec.destRel);
    try {
      await fs.access(dest);
      console.log(`  [skip] ${spec.destRel} (이미 존재)`);
      skipped++;
      continue;
    } catch {
      /* not found, proceed */
    }
    try {
      const ok = await downloadAsset(spec, apiKey, outRoot);
      if (ok) downloaded++;
      else failed++;
    } catch (e) {
      console.warn(`  [fail] ${spec.destRel}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✓ 완료. downloaded=${downloaded}  skipped=${skipped}  failed=${failed}`);
  console.log('git add public/ docs/ATTRIBUTIONS.md 후 커밋하세요.');
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { ASSET_MANIFEST };
