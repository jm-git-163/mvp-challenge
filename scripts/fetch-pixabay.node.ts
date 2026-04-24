/**
 * scripts/fetch-pixabay.node.ts
 *
 * FIX-Z25 (2026-04-22) — Pixabay 에셋 일괄 다운로드 스켈레톤.
 *
 * 상세: docs/PIXABAY_ASSETS.md 옵션 2 참조.
 *
 * 실행:
 *   1) .env.local 에 PIXABAY_API_KEY=xxxxx
 *   2) npm run fetch:assets   (package.json script 추가 필요)
 *      또는:  node --import tsx scripts/fetch-pixabay.node.ts
 *
 * 현재는 매니페스트만 정의한 스켈레톤. 다운로드 HTTP 구현 (node fs + fetch)
 * 은 사용자가 API 키를 확보한 뒤 이 파일에서 TODO 블록을 채운다.
 */

/* eslint-disable no-console */

import path from 'node:path';
import fs from 'node:fs/promises';

// ─── 에셋 매니페스트 ─────────────────────────────────────────────
// query: Pixabay 검색어, kind: music|image, destRel: public/ 기준 상대 경로.
// 기존 파일명과 호환되도록 dest 를 명시.
interface AssetSpec {
  destRel: string;
  kind: 'music' | 'image';
  query: string;
  /** 음원 최소 길이 (초). 비트싱크 용이성. */
  minDurationSec?: number;
  /** 목표 BPM (±6 허용). */
  targetBpm?: number;
}

export const ASSET_MANIFEST: AssetSpec[] = [
  // BGM
  { destRel: 'bgm/synthwave-128.wav', kind: 'music', query: 'synthwave cyberpunk 128 bpm', minDurationSec: 30, targetBpm: 128 },
  { destRel: 'bgm/atlasaudio-jazz-490623.mp3', kind: 'music', query: 'jazz news orchestra', minDurationSec: 60 },
  { destRel: 'bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3', kind: 'music', query: 'kpop upbeat pop', minDurationSec: 45, targetBpm: 124 },
  // 배경 이미지
  { destRel: 'templates/news-anchor/studio.jpg', kind: 'image', query: 'news studio blue monitor' },
];

// ─── 다운로드 로직 (TODO — API 키 확보 후 채울 것) ────────────────
async function downloadAsset(spec: AssetSpec, apiKey: string, outRoot: string): Promise<void> {
  const endpoint = spec.kind === 'music'
    ? `https://pixabay.com/api/music/?key=${apiKey}&q=${encodeURIComponent(spec.query)}&per_page=5`
    : `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(spec.query)}&per_page=5&image_type=photo`;

  console.log(`  [fetch] ${spec.destRel}  ← ${spec.query}`);

  // TODO: 실제 다운로드
  //   const res = await fetch(endpoint);
  //   const json = await res.json();
  //   const best = pickBest(json.hits, spec);
  //   const mediaUrl = best.audio || best.largeImageURL;
  //   const bin = await (await fetch(mediaUrl)).arrayBuffer();
  //   const dest = path.join(outRoot, spec.destRel);
  //   await fs.mkdir(path.dirname(dest), { recursive: true });
  //   await fs.writeFile(dest, Buffer.from(bin));
  //   appendAttribution(best);
  void endpoint;
  void outRoot;
}

async function readKeyFromTxt(): Promise<string | null> {
  // 사용자가 로컬에 보관하는 키 파일 (gitignore). 우선순위 순서.
  const candidates = [
    '픽사베이 api2.txt',
    '픽사베이api2.txt',
    '픽사베이api.txt',
  ];
  for (const name of candidates) {
    try {
      const p = path.resolve(process.cwd(), name);
      const s = (await fs.readFile(p, 'utf8')).trim();
      if (s.length >= 20) return s;
    } catch {
      // try next
    }
  }
  return null;
}

async function main(): Promise<void> {
  const apiKey = process.env.PIXABAY_API_KEY || (await readKeyFromTxt());
  if (!apiKey) {
    console.error('✗ PIXABAY_API_KEY 가 .env.local 또는 픽사베이api.txt 에 없습니다. docs/PIXABAY_ASSETS.md 참조.');
    process.exit(1);
  }

  const outRoot = path.resolve(process.cwd(), 'public');
  console.log(`Pixabay fetch → ${outRoot}`);
  console.log(`매니페스트 ${ASSET_MANIFEST.length} 개 항목`);

  // 기존 파일이 있으면 스킵 (idempotent).
  for (const spec of ASSET_MANIFEST) {
    const dest = path.join(outRoot, spec.destRel);
    try {
      await fs.access(dest);
      console.log(`  [skip] ${spec.destRel} (이미 존재)`);
      continue;
    } catch {
      /* not found, proceed */
    }
    await downloadAsset(spec, apiKey, outRoot);
  }

  console.log('✓ 완료. git add public/ 후 커밋.');
}

// tsx / node --import tsx 로 직접 실행된 경우에만 main 호출
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
