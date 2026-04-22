/**
 * scripts/fetch-pixabay-thumbnails.js
 *
 * 로컬에서 1회 실행해 템플릿별 Pixabay 이미지 URL 을 수집,
 * services/templateThumbnails.ts 에 정적 매핑으로 커밋.
 *
 * 실행: node scripts/fetch-pixabay-thumbnails.js
 *   전제: 픽사베이api.txt 파일에 API 키 있음 (gitignore 됨)
 *
 * 결과: services/templateThumbnails.ts 갱신
 */

const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '..', '픽사베이api.txt');
if (!fs.existsSync(KEY_FILE)) {
  console.error('ERROR: 픽사베이api.txt not found. Put your key in that file.');
  process.exit(1);
}
const apiKey = fs.readFileSync(KEY_FILE, 'utf8').trim();
if (!apiKey || apiKey.length < 20) {
  console.error('ERROR: API key invalid (too short).');
  process.exit(1);
}

/**
 * 템플릿 ID → Pixabay 검색 키워드.
 * 각 키워드는 해당 챌린지의 **상황과 분위기**를 정확히 설명해야 함.
 */
const TEMPLATE_QUERIES = {
  'daily-vlog-001':          { q: 'korean woman selfie phone vlog', category: 'people', orientation: 'vertical' },
  'news-anchor-002':         { q: 'news anchor studio broadcast', category: 'business', orientation: 'horizontal' },
  'english-lesson-003':      { q: 'english language learning microphone', category: 'education', orientation: 'horizontal' },
  'fairy-tale-004':          { q: 'fairy tale book reading child', category: 'education', orientation: 'horizontal' },
  'travel-cert-005':         { q: 'travel cafe landmark selfie', category: 'travel', orientation: 'vertical' },
  'product-unbox-006':       { q: 'unboxing product review package', category: 'business', orientation: 'horizontal' },
  'kpop-idol-007':           { q: 'kpop idol stage microphone concert', category: 'music', orientation: 'horizontal' },
  'fitness-squat-master-008':{ q: 'woman squat workout home fitness', category: 'sports', orientation: 'vertical' },
  'english-speak-009':       { q: 'student speaking english class', category: 'education', orientation: 'horizontal' },
  'kids-story-010':          { q: 'children reading book colorful', category: 'education', orientation: 'horizontal' },
  'travel-vlog-011':         { q: 'travel vlogger camera landscape', category: 'travel', orientation: 'horizontal' },
  'hiphop-cypher-012':       { q: 'hip hop rapper microphone street', category: 'music', orientation: 'vertical' },
  'fitness-squat-001':       { q: 'squat exercise legs fitness floor', category: 'sports', orientation: 'vertical' },
  'fitness-plank-001':       { q: 'plank exercise core workout mat', category: 'sports', orientation: 'horizontal' },
  'dance-kpop-001':          { q: 'kpop dance stage performance', category: 'music', orientation: 'vertical' },
  'meditation-001':          { q: 'meditation peaceful calm woman lotus', category: 'health', orientation: 'horizontal' },
  'fitness-pushup-001':      { q: 'pushup exercise upper body gym', category: 'sports', orientation: 'horizontal' },
  'dance-hiphop-001':        { q: 'hip hop dance freestyle street', category: 'music', orientation: 'vertical' },
  'fitness-squat-50':        { q: 'woman home workout squat challenge', category: 'sports', orientation: 'vertical' },
};

async function fetchOne(id, opts) {
  const params = new URLSearchParams({
    key: apiKey,
    q: opts.q,
    image_type: 'photo',
    orientation: opts.orientation ?? 'all',
    category: opts.category ?? '',
    safesearch: 'true',
    per_page: '10',
    lang: 'en',
  });
  const url = `https://pixabay.com/api/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ${id}: HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  if (!json.hits || json.hits.length === 0) {
    console.error(`  ${id}: no hits for "${opts.q}"`);
    return null;
  }
  // 첫 번째 결과의 middle-size URL (640px, CDN)
  const hit = json.hits[0];
  return {
    url: hit.webformatURL,      // ~640px
    largeURL: hit.largeImageURL, // full-res
    tags: hit.tags,
    user: hit.user,
    pixabayId: hit.id,
  };
}

async function main() {
  console.log('Fetching Pixabay thumbnails for', Object.keys(TEMPLATE_QUERIES).length, 'templates…');
  const results = {};
  for (const [id, opts] of Object.entries(TEMPLATE_QUERIES)) {
    process.stdout.write(`  ${id} (${opts.q}) … `);
    try {
      const r = await fetchOne(id, opts);
      if (r) {
        results[id] = r;
        console.log('OK');
      } else {
        console.log('MISS');
      }
      // Pixabay 무료 티어 rate limit: 100req/60s. 200ms 간격이면 안전.
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.log('ERR', e.message);
    }
  }

  const out = path.join(__dirname, '..', 'services', 'templateThumbnails.ts');
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
  const body = JSON.stringify(results, null, 2);
  fs.writeFileSync(out, header + body + ' as const;\n', 'utf8');
  console.log(`\nWrote ${Object.keys(results).length} entries to ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
