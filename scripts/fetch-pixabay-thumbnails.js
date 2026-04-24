/**
 * scripts/fetch-pixabay-thumbnails.js
 *
 * 로컬에서 1회 실행해 템플릿별 Pixabay 이미지 URL 을 수집,
 * services/templateThumbnails.ts 에 정적 매핑으로 커밋.
 *
 * 실행: node scripts/fetch-pixabay-thumbnails.js
 *   전제: 픽사베이api.txt 파일에 API 키 있음 (gitignore 됨)
 *
 * 결과: services/templateThumbnails.ts 갱신.
 *   ⚠️ 자동 수집은 키워드 매칭 정확도가 낮으므로(예: "plank" 검색 시 "crunches"
 *     사진 반환) 수집 후 사람이 반드시 검수하고, mismatch 항목은 services/
 *     templateThumbnails.ts 에서 Unsplash URL 로 손수 교체할 것.
 *
 *   본 스크립트는 그래서 다음 안전장치를 가짐:
 *     1) requiredTags : 결과 사진의 tags 문자열에 반드시 포함되어야 하는 단어.
 *        하나라도 없으면 다음 hit 으로 스킵. 모두 미스이면 MISS 처리.
 *     2) blockedTags : 결과에 포함되면 즉시 거절(예: plank 검색 결과에 "crunch").
 *     3) 키워드는 챌린지 주제·성별·환경을 명시 (e.g. "woman bodyweight squat").
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
 * 템플릿 ID → Pixabay 검색 사양.
 *  - q              : 검색어 (구체적일수록 정확)
 *  - category       : Pixabay 카테고리 필터
 *  - orientation    : vertical(9:16) / horizontal(16:9) / all
 *  - requiredTags   : 결과 hit.tags 에 모두 포함되어야 함 (소문자, 부분일치)
 *  - blockedTags    : 결과 hit.tags 에 포함되면 즉시 거절 (mismatch 방어)
 *  - minLikes       : 인기도 하한선 (낮은 품질 사진 회피)
 *
 * Pixabay 검색은 키워드를 AND 로 해석. 너무 많은 단어는 검색 폭을 좁혀 0건이 되므로
 * q 는 2~4 단어, 정밀도는 requiredTags 로 후처리.
 */
const TEMPLATE_QUERIES = {
  'daily-vlog-001': {
    q: 'woman selfie phone smile',
    category: 'people', orientation: 'vertical',
    requiredTags: ['selfie'],
    blockedTags: ['child', 'baby', 'wedding'],
    minLikes: 5,
  },
  'news-anchor-002': {
    // 뉴스 데스크/스튜디오. "microphone" 만 쓰면 음악 스튜디오가 잡힘.
    q: 'news anchor desk broadcast studio',
    category: 'business', orientation: 'horizontal',
    requiredTags: ['news'],
    blockedTags: ['concert', 'rock', 'guitar', 'drums', 'singer'],
    minLikes: 5,
  },
  'english-lesson-003': {
    q: 'english textbook study notebook',
    category: 'education', orientation: 'horizontal',
    requiredTags: ['english'],
    blockedTags: [],
    minLikes: 5,
  },
  'fairy-tale-004': {
    // "wallpaper" 또는 "background" 결과를 명시 거절 (Pixabay 가 자주 잡음).
    q: 'storybook fairy tale castle illustration',
    category: 'backgrounds', orientation: 'horizontal',
    requiredTags: ['fairy'],
    blockedTags: ['wallpaper', 'desktop', 'christmas', 'snow'],
    minLikes: 5,
  },
  'travel-cert-005': {
    q: 'tourist landmark selfie travel',
    category: 'travel', orientation: 'vertical',
    requiredTags: ['travel'],
    blockedTags: [],
    minLikes: 5,
  },
  'product-unbox-006': {
    q: 'unboxing package open box',
    category: 'business', orientation: 'horizontal',
    requiredTags: ['box'],
    blockedTags: ['gift', 'wedding'],
    minLikes: 3,
  },
  'kpop-idol-007': {
    // 흑백 락밴드 회피. 컬러 + 핑크/네온 톤 우선.
    q: 'kpop concert neon stage lights',
    category: 'music', orientation: 'horizontal',
    requiredTags: ['stage'],
    blockedTags: ['black and white', 'monochrome', 'guitar', 'drums', 'rock'],
    minLikes: 5,
  },
  'fitness-squat-master-008': {
    q: 'woman bodyweight squat home workout',
    category: 'sports', orientation: 'vertical',
    requiredTags: ['squat'],
    blockedTags: ['crunch', 'plank', 'pushup', 'yoga', 'treadmill', 'weight lifting', 'barbell'],
    minLikes: 3,
  },
  'english-speak-009': {
    // 사람 + 말하는 장면. 빈 칠판/물건 사진 회피 (people 카테고리 강제).
    q: 'student speaking english presentation',
    category: 'people', orientation: 'horizontal',
    requiredTags: ['speaking'],
    blockedTags: ['blackboard', 'chalkboard', 'still life'],
    minLikes: 3,
  },
  'kids-story-010': {
    q: 'children reading colorful book',
    category: 'education', orientation: 'horizontal',
    requiredTags: ['children'],
    blockedTags: ['textbook', 'university'],
    minLikes: 3,
  },
  'travel-vlog-011': {
    q: 'travel vlogger camera scenic view',
    category: 'travel', orientation: 'horizontal',
    requiredTags: ['camera'],
    blockedTags: [],
    minLikes: 3,
  },
  'hiphop-cypher-012': {
    q: 'rapper microphone hip hop performance',
    category: 'music', orientation: 'vertical',
    requiredTags: ['rap'],
    blockedTags: ['country', 'jazz', 'classical'],
    minLikes: 3,
  },
  'fitness-squat-001': {
    // "yoga" 결과 강력 차단.
    q: 'woman squat exercise bodyweight legs',
    category: 'sports', orientation: 'vertical',
    requiredTags: ['squat'],
    blockedTags: ['yoga', 'meditation', 'plank', 'pushup', 'treadmill', 'downward dog'],
    minLikes: 3,
  },
  'fitness-plank-001': {
    // ⚠️ 사용자 보고 사례: "plank" 검색에 "crunches" 가 자주 잡힘 → 명시 차단.
    q: 'forearm plank hold core exercise',
    category: 'sports', orientation: 'horizontal',
    requiredTags: ['plank'],
    blockedTags: ['crunch', 'situp', 'sit-up', 'squat', 'pushup', 'yoga', 'downward dog'],
    minLikes: 3,
  },
  'dance-kpop-001': {
    // "ballet" 결과 차단 (자동 수집 시 ballerina 가 잡힘).
    q: 'kpop dance practice studio choreography',
    category: 'music', orientation: 'vertical',
    requiredTags: ['dance'],
    blockedTags: ['ballet', 'ballerina', 'contemporary', 'tap'],
    minLikes: 3,
  },
  'meditation-001': {
    q: 'meditation lotus woman peaceful',
    category: 'health', orientation: 'horizontal',
    requiredTags: ['meditation'],
    blockedTags: [],
    minLikes: 3,
  },
  'fitness-pushup-001': {
    // 역기/크로스핏 결과 회피.
    q: 'pushup push-up exercise floor',
    category: 'sports', orientation: 'horizontal',
    requiredTags: ['push'],
    blockedTags: ['weight lifting', 'weightlifting', 'barbell', 'dumbbell', 'crossfit', 'plank', 'squat'],
    minLikes: 3,
  },
  'dance-hiphop-001': {
    q: 'hip hop street dance freestyle',
    category: 'music', orientation: 'vertical',
    requiredTags: ['hip hop'],
    blockedTags: ['ballet', 'classical'],
    minLikes: 3,
  },
  'fitness-squat-50': {
    q: 'home workout squat challenge woman',
    category: 'sports', orientation: 'vertical',
    requiredTags: ['squat'],
    blockedTags: ['treadmill', 'running', 'stretching', 'yoga', 'plank', 'pushup'],
    minLikes: 3,
  },
};

/**
 * hit 한 건이 화이트리스트/블랙리스트 통과 여부.
 */
function isHitAcceptable(hit, opts) {
  const tags = (hit.tags || '').toLowerCase();
  const required = opts.requiredTags ?? [];
  const blocked = opts.blockedTags ?? [];
  const minLikes = opts.minLikes ?? 0;

  for (const must of required) {
    if (!tags.includes(must.toLowerCase())) return { ok: false, reason: `missing required tag "${must}"` };
  }
  for (const bad of blocked) {
    if (tags.includes(bad.toLowerCase())) return { ok: false, reason: `blocked by tag "${bad}"` };
  }
  if ((hit.likes ?? 0) < minLikes) return { ok: false, reason: `likes ${hit.likes} < ${minLikes}` };
  return { ok: true };
}

async function fetchOne(id, opts) {
  const params = new URLSearchParams({
    key: apiKey,
    q: opts.q,
    image_type: 'photo',
    orientation: opts.orientation ?? 'all',
    category: opts.category ?? '',
    safesearch: 'true',
    per_page: '30', // 더 많이 받아서 화이트리스트 통과되는 첫 hit 사용
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
  // 화이트리스트/블랙리스트 통과되는 첫 hit
  const reasons = [];
  for (const hit of json.hits) {
    const verdict = isHitAcceptable(hit, opts);
    if (verdict.ok) {
      return {
        url: hit.webformatURL,
        largeURL: hit.largeImageURL,
        tags: hit.tags,
        user: hit.user,
        pixabayId: hit.id,
      };
    }
    reasons.push(`#${hit.id}: ${verdict.reason}`);
  }
  console.error(`  ${id}: all ${json.hits.length} hits filtered out`);
  reasons.slice(0, 3).forEach((r) => console.error(`    - ${r}`));
  return null;
}

async function main() {
  console.log('Fetching Pixabay thumbnails for', Object.keys(TEMPLATE_QUERIES).length, 'templates…');
  const results = {};
  const misses = [];
  for (const [id, opts] of Object.entries(TEMPLATE_QUERIES)) {
    process.stdout.write(`  ${id} (${opts.q}) … `);
    try {
      const r = await fetchOne(id, opts);
      if (r) {
        results[id] = r;
        console.log('OK');
      } else {
        console.log('MISS');
        misses.push(id);
      }
      // Pixabay 무료 티어: 100req/60s. 250ms 간격이면 안전.
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.log('ERR', e.message);
      misses.push(id);
    }
  }

  // ⚠️ 본 스크립트는 services/templateThumbnails.ts 를 더 이상 자동 덮어쓰지 않음.
  //   이유: 손수 검토한 Unsplash URL 이 자동 수집본에 의해 덮여 사라지는 사고 방지.
  //   대신 결과를 .pixabay-fetch-result.json 으로 출력 → 사람이 손으로 병합.
  const out = path.join(__dirname, '..', '.pixabay-fetch-result.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nWrote ${Object.keys(results).length} entries to ${out}`);
  if (misses.length) {
    console.log(`MISS (${misses.length}): ${misses.join(', ')}`);
    console.log('  → 이 항목은 services/templateThumbnails.ts 에 직접 Unsplash URL 로 추가하세요.');
  }
  console.log('\n다음 단계:');
  console.log('  1) .pixabay-fetch-result.json 의 각 항목을 사람이 검수 (사진 URL 클릭하여 주제 일치 확인)');
  console.log('  2) 적합한 항목만 services/templateThumbnails.ts 의 해당 ID 에 병합');
  console.log('  3) // REVIEWED YYYY-MM-DD 주석 추가');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
