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
  // ── BGM (11개 챌린지 주제별 — TEAM-TEMPLATE 2026-04-22) ─────────────
  { destRel: 'bgm/squat-workout.mp3',     kind: 'music', query: 'electronic workout high energy 130 bpm', fallbackQuery: 'workout electronic', minDurationSec: 30, targetBpm: 130 },
  { destRel: 'bgm/kpop-dance.mp3',        kind: 'music', query: 'kpop upbeat pop 128 bpm',                 fallbackQuery: 'pop dance',         minDurationSec: 30, targetBpm: 128 },
  { destRel: 'bgm/news-corporate.mp3',    kind: 'music', query: 'corporate lounge news 100 bpm',           fallbackQuery: 'corporate',         minDurationSec: 45, targetBpm: 100 },
  { destRel: 'bgm/motivation-orch.mp3',   kind: 'music', query: 'inspirational orchestral 110 bpm',        fallbackQuery: 'inspirational',     minDurationSec: 40, targetBpm: 110 },
  { destRel: 'bgm/storybook-musicbox.mp3',kind: 'music', query: 'fairy tale music box 90 bpm',             fallbackQuery: 'music box',         minDurationSec: 30, targetBpm: 90  },
  { destRel: 'bgm/daily-lofi.mp3',        kind: 'music', query: 'lofi chill vlog 95 bpm',                  fallbackQuery: 'lofi',              minDurationSec: 40, targetBpm: 95  },
  { destRel: 'bgm/travel-acoustic.mp3',   kind: 'music', query: 'travel bright acoustic 115 bpm',          fallbackQuery: 'acoustic travel',   minDurationSec: 30, targetBpm: 115 },
  { destRel: 'bgm/food-ukulele.mp3',      kind: 'music', query: 'happy ukulele kitchen 105 bpm',           fallbackQuery: 'ukulele happy',     minDurationSec: 30, targetBpm: 105 },
  { destRel: 'bgm/english-jazz.mp3',      kind: 'music', query: 'light jazz clean 100 bpm',                fallbackQuery: 'jazz',              minDurationSec: 40, targetBpm: 100 },
  { destRel: 'bgm/unboxing-pop.mp3',      kind: 'music', query: 'pop bright commercial 120 bpm',           fallbackQuery: 'pop commercial',    minDurationSec: 30, targetBpm: 120 },
  { destRel: 'bgm/viral-trap.mp3',        kind: 'music', query: 'viral tiktok trap 140 bpm',               fallbackQuery: 'trap',              minDurationSec: 30, targetBpm: 140 },

  // ── SFX (피트니스) — 키 이름은 sfxPlayer SfxKey와 일치하도록 매핑 ────
  // squat_count → fit-count, mission_success → fit-success 등 두 곳에 저장
  { destRel: 'sfx/fit-count.mp3',         kind: 'music', query: 'gym beep tick count workout',        fallbackQuery: 'beep tick',          minDurationSec: 0.3 },
  { destRel: 'sfx/fit-success.mp3',       kind: 'music', query: 'achievement powerful win game',      fallbackQuery: 'win game',           minDurationSec: 0.3 },
  { destRel: 'sfx/fit-bonus.mp3',         kind: 'music', query: 'level up power up boost game',       fallbackQuery: 'power up',           minDurationSec: 0.3 },
  { destRel: 'sfx/fit-fail.mp3',          kind: 'music', query: 'negative game over short',           fallbackQuery: 'game over',          minDurationSec: 0.3 },

  // ── SFX (K-POP) ────────────────────────────────────────────────
  { destRel: 'sfx/kpop-cheer.mp3',        kind: 'music', query: 'crowd cheer applause excited',       fallbackQuery: 'crowd cheer',        minDurationSec: 0.5 },
  { destRel: 'sfx/kpop-shimmer.mp3',      kind: 'music', query: 'sparkle magic chime bright',         fallbackQuery: 'sparkle chime',      minDurationSec: 0.3 },
  { destRel: 'sfx/kpop-drop.mp3',         kind: 'music', query: 'edm bass drop impact',               fallbackQuery: 'bass drop',          minDurationSec: 0.5 },

  // ── SFX (뉴스) ─────────────────────────────────────────────────
  { destRel: 'sfx/news-jingle.mp3',       kind: 'music', query: 'news intro sting brass short',       fallbackQuery: 'news sting',         minDurationSec: 0.5 },
  { destRel: 'sfx/news-typing.mp3',       kind: 'music', query: 'typewriter typing fast',             fallbackQuery: 'typewriter',         minDurationSec: 0.5 },
  { destRel: 'sfx/news-ding.mp3',         kind: 'music', query: 'notification ding professional',     fallbackQuery: 'notification',       minDurationSec: 0.3 },

  // ── SFX (이모지/일상) ──────────────────────────────────────────
  { destRel: 'sfx/pop-confetti.mp3',      kind: 'music', query: 'confetti pop party celebration',     fallbackQuery: 'confetti pop',       minDurationSec: 0.3 },
  { destRel: 'sfx/pop-bubble.mp3',        kind: 'music', query: 'bubble pop cute squeak',             fallbackQuery: 'bubble pop',         minDurationSec: 0.3 },
  { destRel: 'sfx/pop-laugh.mp3',         kind: 'music', query: 'kid giggle laugh cute short',        fallbackQuery: 'giggle',             minDurationSec: 0.3 },

  // ── SFX (스크립트/영어 미션) ───────────────────────────────────
  { destRel: 'sfx/voice-success.mp3',     kind: 'music', query: 'ding correct success quiz',          fallbackQuery: 'correct ding',       minDurationSec: 0.3 },
  { destRel: 'sfx/voice-tick.mp3',        kind: 'music', query: 'subtle tick word advance',           fallbackQuery: 'tick',               minDurationSec: 0.2 },

  // ── SFX (트랜지션) ─────────────────────────────────────────────
  { destRel: 'sfx/transition-whoosh.mp3', kind: 'music', query: 'whoosh transition swoosh smooth',    fallbackQuery: 'whoosh',             minDurationSec: 0.3 },

  // ── 배경 이미지 (기존) ─────────────────────────────────────────
  { destRel: 'templates/news-anchor/studio.jpg', kind: 'image',
    query: 'news studio blue monitor', fallbackQuery: 'news studio' },
  { destRel: 'templates/neon-arena/bg-neon.jpg', kind: 'image',
    query: 'neon cyberpunk city night', fallbackQuery: 'neon city' },
  { destRel: 'templates/emoji-explosion/bg-pop.jpg', kind: 'image',
    query: 'pastel pink yellow gradient cute', fallbackQuery: 'pastel gradient' },

  // ── 배경 이미지 (squat-master 신규) ────────────────────────────
  { destRel: 'templates/squat-master/bg.jpg',    kind: 'image',
    query: 'neon gym dark dramatic workout',     fallbackQuery: 'gym workout dark' },
  { destRel: 'templates/squat-master/thumb.jpg', kind: 'image',
    query: 'fitness woman silhouette workout vibrant', fallbackQuery: 'fitness silhouette' },
  { destRel: 'templates/squat-master/accent-flame.png', kind: 'image',
    query: 'flame fire neon transparent',        fallbackQuery: 'flame fire' },

  // ── 배경 이미지 (idol-dance 신규 — kpop) ───────────────────────
  { destRel: 'templates/idol-dance/bg.jpg',      kind: 'image',
    query: 'stage lights kpop concert vibrant',  fallbackQuery: 'concert stage lights' },
  { destRel: 'templates/idol-dance/thumb.jpg',   kind: 'image',
    query: 'dance silhouette neon stage',        fallbackQuery: 'dance neon' },
  { destRel: 'templates/idol-dance/accent-star.png', kind: 'image',
    query: 'star sparkle neon transparent',      fallbackQuery: 'star sparkle' },

  // ── 배경 이미지 (news-anchor 추가) ─────────────────────────────
  { destRel: 'templates/news-anchor/thumb.jpg',  kind: 'image',
    query: 'news anchor desk professional',      fallbackQuery: 'news anchor' },
  { destRel: 'templates/news-anchor/accent-tape.png', kind: 'image',
    query: 'breaking news red tape banner',      fallbackQuery: 'red banner' },

  // ── 배경 이미지 (emoji-explosion 추가) ─────────────────────────
  { destRel: 'templates/emoji-explosion/thumb.jpg', kind: 'image',
    query: 'happy friends colorful party',       fallbackQuery: 'colorful party' },
  { destRel: 'templates/emoji-explosion/accent-confetti.png', kind: 'image',
    query: 'confetti rainbow transparent',       fallbackQuery: 'confetti rainbow' },

  // ── 배경 비디오 (PIXABAY-VIDEO 2026-05-02) ─────────────────────
  // 템플릿별 무빙 배경 (4) + 범용 BG 풀 (4). small mp4 (5MB 이하) 우선.
  { destRel: 'templates/squat-master/bg-loop.mp4',     kind: 'video',
    query: 'neon gym workout dark',     fallbackQuery: 'gym workout' },
  { destRel: 'templates/idol-dance/bg-loop.mp4',       kind: 'video',
    query: 'stage lights concert neon abstract', fallbackQuery: 'stage lights' },
  { destRel: 'templates/news-anchor/bg-loop.mp4',      kind: 'video',
    query: 'data abstract corporate blue', fallbackQuery: 'abstract blue' },
  { destRel: 'templates/emoji-explosion/bg-loop.mp4',  kind: 'video',
    query: 'confetti colorful abstract slow', fallbackQuery: 'confetti colorful' },
  { destRel: 'bg/sky-loop.mp4',                        kind: 'video',
    query: 'clouds time lapse',         fallbackQuery: 'clouds' },
  { destRel: 'bg/particles-loop.mp4',                  kind: 'video',
    query: 'abstract particles blue',   fallbackQuery: 'abstract particles' },
  { destRel: 'bg/intro-burst.mp4',                     kind: 'video',
    query: 'burst light flash',         fallbackQuery: 'light flash' },
  { destRel: 'bg/outro-celebration.mp4',               kind: 'video',
    query: 'fireworks celebration',     fallbackQuery: 'fireworks' },
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
  // 메인 시도 → 실패 시 fallbackQuery 로 자동 재시도 (최대 1회)
  try {
    return await tryDownload(spec, spec.query, apiKey, outRoot);
  } catch (e) {
    if (spec.fallbackQuery && spec.fallbackQuery !== spec.query) {
      console.warn(`    [fallback] "${spec.query}" 실패 → "${spec.fallbackQuery}" 재시도`);
      return await tryDownload(spec, spec.fallbackQuery, apiKey, outRoot);
    }
    throw e;
  }
}

async function tryDownload(spec, query, apiKey, outRoot) {
  const isPng = spec.destRel.toLowerCase().endsWith('.png');
  const endpoint = spec.kind === 'music'
    ? `https://pixabay.com/api/music/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=15`
    : spec.kind === 'video'
      ? `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=20`
      : `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=15&image_type=${isPng ? 'illustration' : 'photo'}${isPng ? '' : '&orientation=vertical'}`;

  console.log(`  [fetch] ${spec.destRel}  ← "${query}"`);
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

  if (spec.kind === 'video') {
    const hits = json.hits || [];
    if (!hits.length) { console.warn(`    no video hits for "${query}"`); return false; }
    // Prefer small (≤5MB target). Fallback medium → tiny.
    // Sort hits by popularity, then pick smallest acceptable variant per hit.
    const sorted = hits.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
    const MAX_BYTES = 50 * 1024 * 1024; // git push hard limit
    const PREF_BYTES = 8 * 1024 * 1024; // soft preference
    for (const hit of sorted) {
      const variants = hit.videos || {};
      // Order: small → tiny → medium (skip large/4k entirely)
      const order = ['small', 'tiny', 'medium'];
      let chosen = null;
      for (const k of order) {
        const v = variants[k];
        if (!v || !v.url) continue;
        if (v.size && v.size > MAX_BYTES) continue;
        chosen = { url: v.url, size: v.size, variant: k };
        if (!v.size || v.size <= PREF_BYTES) break;
      }
      if (!chosen) continue;
      try {
        const r = await fetch(chosen.url);
        if (!r.ok) { console.warn(`    video fetch HTTP ${r.status} for ${spec.destRel}`); continue; }
        const bin = await r.arrayBuffer();
        if (bin.byteLength > MAX_BYTES) { console.warn(`    video too large (${(bin.byteLength/1024/1024).toFixed(1)}MB), trying next hit`); continue; }
        const dest = path.join(outRoot, spec.destRel);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, Buffer.from(bin));
        await appendAttribution(spec, hit);
        console.log(`    ✓ saved ${(bin.byteLength / 1024 / 1024).toFixed(2)} MB (${chosen.variant}) → ${spec.destRel}`);
        return true;
      } catch (e) {
        console.warn(`    video download error: ${e.message}`);
        continue;
      }
    }
    console.warn(`    no acceptable video variant under ${MAX_BYTES} bytes for "${query}"`);
    return false;
  } else if (spec.kind === 'music') {
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
