/**
 * scripts/fix-duplicate-thumbnails.js
 *
 * 기존 services/templateThumbnails.ts 의 중복/부정확 이미지 5개를
 * 더 구체적인 키워드 + page=2 오프셋으로 재수집해 교체.
 *
 * 실행: node scripts/fix-duplicate-thumbnails.js
 */

const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '..', '픽사베이api.txt');
const apiKey = fs.readFileSync(KEY_FILE, 'utf8').trim();

// 각 템플릿별로 서로 다른 시각적 정체성을 주기 위한 재쿼리
const OVERRIDES = {
  'fitness-squat-master-008': { q: 'barbell squat gym strength', category: 'sports', orientation: 'vertical', page: 1 },
  'fitness-squat-001':        { q: 'woman squat home floor',     category: 'sports', orientation: 'vertical', page: 1 },
  'fitness-squat-50':         { q: 'squat challenge workout number', category: 'sports', orientation: 'vertical', page: 2 },
  'hiphop-cypher-012':        { q: 'rapper microphone cypher battle', category: 'music', orientation: 'horizontal', page: 1 },
  'dance-hiphop-001':         { q: 'breakdance bboy floor move',  category: 'music', orientation: 'vertical', page: 1 },
  // 내용과 무관했던 것들 교체
  'english-speak-009':        { q: 'student presentation podium speaking', category: 'education', orientation: 'horizontal', page: 1 },
  'fairy-tale-004':           { q: 'fairy tale castle forest magic', category: 'backgrounds', orientation: 'horizontal', page: 1 },
};

async function fetchOne(opts, excludeIds) {
  const params = new URLSearchParams({
    key: apiKey,
    q: opts.q,
    image_type: 'photo',
    orientation: opts.orientation ?? 'all',
    category: opts.category ?? '',
    safesearch: 'true',
    per_page: '20',
    page: String(opts.page ?? 1),
    lang: 'en',
  });
  const url = `https://pixabay.com/api/?${params.toString()}`;
  const res = await fetch(url);
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
  const outPath = path.join(__dirname, '..', 'services', 'templateThumbnails.ts');
  const src = fs.readFileSync(outPath, 'utf8');
  const jsonStart = src.indexOf('{', src.indexOf('TEMPLATE_THUMBNAILS'));
  const jsonEnd = src.lastIndexOf('}');
  const body = src.slice(jsonStart, jsonEnd + 1);
  const current = JSON.parse(body);

  const usedIds = new Set(Object.values(current).map(v => v.pixabayId));

  for (const [id, opts] of Object.entries(OVERRIDES)) {
    // 기존 id 는 제외 집합에서 먼저 빼서 새것 선택 유도
    usedIds.delete(current[id]?.pixabayId);
    process.stdout.write(`  ${id} (${opts.q}, page=${opts.page}) … `);
    try {
      const r = await fetchOne(opts, usedIds);
      if (r) {
        current[id] = r;
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

  const header = `/**
 * services/templateThumbnails.ts
 *
 * 자동 생성 — scripts/fetch-pixabay-thumbnails.js 로 재생성.
 * 각 템플릿 ID → Pixabay 큐레이션 이미지 URL (정적, CDN, 키 없음).
 * 출처 표기: Pixabay 무료 라이선스 (크레딧 불필요, 상업적 사용 가능).
 */

export interface TemplateThumb {
  url: string;       // webformat ~640px
  largeURL: string;  // full-res
  tags: string;
  user: string;
  pixabayId: number;
}

export const TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = `;
  fs.writeFileSync(outPath, header + JSON.stringify(current, null, 2) + ' as const;\n', 'utf8');

  // 중복 검사
  const counts = {};
  for (const [id, v] of Object.entries(current)) {
    counts[v.pixabayId] = (counts[v.pixabayId] || []);
    counts[v.pixabayId].push(id);
  }
  const dups = Object.entries(counts).filter(([, ids]) => ids.length > 1);
  if (dups.length === 0) {
    console.log('\n✓ 모든 템플릿이 고유 이미지를 가짐');
  } else {
    console.log('\n⚠ 남은 중복:');
    for (const [pid, ids] of dups) console.log(`  ${pid}: ${ids.join(', ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
