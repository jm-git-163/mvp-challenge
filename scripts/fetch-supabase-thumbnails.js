/**
 * scripts/fetch-supabase-thumbnails.js
 *
 * 프로덕션 Supabase 의 실제 템플릿 (UUID 10개) 에 대응하는 Pixabay 이미지를
 * 각 템플릿 이름에 정확히 맞춰 수집 → services/supabaseThumbnails.ts 생성.
 */

const fs = require('fs');
const path = require('path');

const apiKey = fs.readFileSync(path.join(__dirname, '..', '픽사베이api.txt'), 'utf8').trim();

// Supabase UUID → 검색 키워드 (이름 기반으로 정확히 매칭)
const TEMPLATES = [
  { id: '021ccc86-7d9f-41c0-88bd-970406bebd2e', name: '오늘의 브이로그 챌린지',  q: 'korean woman selfie vlog phone',  orientation: 'vertical' },
  { id: '77756254-94ea-40a2-9c9e-b5c4257945cd', name: '뉴스 앵커 챌린지',        q: 'news anchor broadcast studio',    orientation: 'horizontal' },
  { id: '84592fbd-b1f2-4cc1-be02-0224284bcb98', name: '영어 스피킹 챌린지',      q: 'student presentation speaking podium', orientation: 'horizontal' },
  { id: '8e0b4493-5c5e-4ece-82dd-2ba93f9b8036', name: '동화책 읽기 챌린지',      q: 'child bedtime storybook reading',  orientation: 'horizontal' },
  { id: '4c3f1f85-ec15-48fd-a197-dc507ceb8400', name: '관광지 인증 챌린지',      q: 'tourist landmark selfie travel',   orientation: 'vertical' },
  { id: 'af337411-5b84-408a-b16a-e4fc04e78ebb', name: '신상템 언박싱 챌린지',    q: 'unboxing product package review',  orientation: 'horizontal' },
  { id: 'e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54', name: 'K-POP 댄스 챌린지',       q: 'kpop dance stage concert neon',    orientation: 'vertical' },
  { id: '981093f7-b455-4e48-82b2-6ce05850929a', name: '맛집 리뷰 챌린지',        q: 'korean food restaurant review plate', orientation: 'horizontal' },
  { id: '5ccf6904-960f-4fa0-9af7-1dada6d598f7', name: '동기부여 스피치 챌린지',  q: 'motivational speaker stage audience',  orientation: 'horizontal' },
  { id: '9e766788-4591-41d8-9c96-13103f269a0b', name: '소셜 바이럴 챌린지',      q: 'smartphone trending social media hand', orientation: 'vertical' },
];

async function fetchOne(opts, excludeIds) {
  const params = new URLSearchParams({
    key: apiKey,
    q: opts.q,
    image_type: 'photo',
    orientation: opts.orientation ?? 'all',
    safesearch: 'true',
    per_page: '20',
    lang: 'en',
  });
  const res = await fetch(`https://pixabay.com/api/?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.hits || json.hits.length === 0) return null;
  const hit = json.hits.find(h => !excludeIds.has(h.id)) ?? json.hits[0];
  return {
    url: hit.webformatURL,
    largeURL: hit.largeImageURL,
    tags: hit.tags,
    user: hit.user,
    pixabayId: hit.id,
  };
}

async function main() {
  console.log(`Fetching ${TEMPLATES.length} Supabase-UUID thumbnails...`);
  const results = {};
  const usedIds = new Set();
  for (const t of TEMPLATES) {
    process.stdout.write(`  ${t.name} … `);
    try {
      const r = await fetchOne(t, usedIds);
      if (r) {
        results[t.id] = r;
        usedIds.add(r.pixabayId);
        console.log(`OK #${r.pixabayId} by ${r.user}`);
      } else {
        console.log('MISS');
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log('ERR', e.message);
    }
  }

  const out = path.join(__dirname, '..', 'services', 'supabaseThumbnails.ts');
  const header = `/**
 * services/supabaseThumbnails.ts
 *
 * 자동 생성 — scripts/fetch-supabase-thumbnails.js 로 재생성.
 * 프로덕션 Supabase 의 실제 템플릿 UUID → Pixabay 큐레이션 이미지.
 * 홈 화면에서 최우선으로 사용.
 */

import type { TemplateThumb } from './templateThumbnails';

export const SUPABASE_TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = `;
  fs.writeFileSync(out, header + JSON.stringify(results, null, 2) + ' as const;\n', 'utf8');

  const dupCounts = {};
  for (const v of Object.values(results)) dupCounts[v.pixabayId] = (dupCounts[v.pixabayId] || 0) + 1;
  const dups = Object.entries(dupCounts).filter(([, c]) => c > 1);
  if (dups.length === 0) console.log(`\n✓ ${Object.keys(results).length}개 고유 이미지 → ${out}`);
  else console.log('\n⚠ 중복:', dups);
}

main().catch(e => { console.error(e); process.exit(1); });
