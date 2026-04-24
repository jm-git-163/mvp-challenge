/**
 * utils/officialSlug.ts
 *
 * Template → **공식 챌린지 slug** 결정 규칙.
 *
 * DB 의 template.id 는 대체로 UUID (프로덕션) 또는 `daily-vlog-001` 같은 레거시 목
 * 문자열. 초대 링크에는 이 id 를 넣으면 수신자 측이 templates 레지스트리에서
 * 못 찾을 수 있다. 대신 `services/challengeTemplateMap` 의 OFFICIAL_CHALLENGE_SLUGS
 * 중 하나로 정규화해서 보내야 `resolveLayeredTemplate` 가 반드시 매칭된다.
 *
 * 해석 우선순위:
 *   1) template.slug 필드 (있으면 그대로)
 *   2) template.genre → alias 맵으로 변환 (kpop → kpop-dance 등)
 *   3) template.id 가 OFFICIAL_CHALLENGE_SLUGS 에 포함되면 그대로
 *   4) template.id 가 `<slug>-000` 패턴이면 prefix 추출
 *   5) 최종 폴백: 'squat-master' (항상 매칭되는 안전 기본값)
 */
import { OFFICIAL_CHALLENGE_SLUGS } from '../services/challengeTemplateMap';

/**
 * FIX-INVITE-UUID (2026-04-23): 프로덕션 Supabase DB 의 템플릿은 UUID id 를 쓴다
 *   (services/supabaseThumbnails.ts + scripts/fetch-supabase-thumbnails.js 에 명시).
 *   이 맵이 없으면 genre 필드가 비거나 알 수 없는 값일 때 전부 'squat-master' 폴백 →
 *   모든 초대 링크가 스쿼트로 떨어지는 버그. 10개 UUID → 11개 공식 slug 1:1 매핑.
 */
const DB_UUID_TO_SLUG: Record<string, string> = {
  '021ccc86-7d9f-41c0-88bd-970406bebd2e': 'daily-vlog',          // 오늘의 브이로그
  '77756254-94ea-40a2-9c9e-b5c4257945cd': 'news-anchor',         // 뉴스 앵커
  '84592fbd-b1f2-4cc1-be02-0224284bcb98': 'english-speaking',    // 영어 스피킹
  '8e0b4493-5c5e-4ece-82dd-2ba93f9b8036': 'storybook-reading',   // 동화책 읽기
  '4c3f1f85-ec15-48fd-a197-dc507ceb8400': 'travel-checkin',      // 관광지 인증
  'af337411-5b84-408a-b16a-e4fc04e78ebb': 'unboxing-promo',      // 신상템 언박싱
  'e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54': 'kpop-dance',          // K-POP 댄스
  '981093f7-b455-4e48-82b2-6ce05850929a': 'food-review',         // 맛집 리뷰
  '5ccf6904-960f-4fa0-9af7-1dada6d598f7': 'motivation-speech',   // 동기부여 스피치
  '9e766788-4591-41d8-9c96-13103f269a0b': 'social-viral',        // 소셜 바이럴
};

const GENRE_TO_SLUG: Record<string, string> = {
  kpop: 'kpop-dance',
  dance: 'kpop-dance',
  hiphop: 'social-viral',
  fitness: 'squat-master',
  challenge: 'kpop-dance',
  promotion: 'unboxing-promo',
  travel: 'travel-checkin',
  daily: 'daily-vlog',
  news: 'news-anchor',
  english: 'english-speaking',
  kids: 'storybook-reading',
};

const LEGACY_ID_PREFIX_TO_SLUG: Array<[RegExp, string]> = [
  [/^daily-vlog/i,           'daily-vlog'],
  [/^news-anchor/i,          'news-anchor'],
  [/^english-lesson/i,       'english-speaking'],
  [/^english-speak/i,        'english-speaking'],
  [/^fairy-tale/i,           'storybook-reading'],
  [/^kids-story/i,           'storybook-reading'],
  [/^travel-cert/i,          'travel-checkin'],
  [/^travel-/i,              'travel-checkin'],
  [/^product-unbox/i,        'unboxing-promo'],
  [/^kpop-idol/i,            'kpop-dance'],
  [/^kpop-/i,                'kpop-dance'],
  [/^fitness-squat/i,        'squat-master'],
  [/^food-/i,                'food-review'],
  [/^motivation-/i,          'motivation-speech'],
  [/^social-/i,              'social-viral'],
  [/^storybook-/i,           'storybook-reading'],
];

export function pickOfficialSlug(template: { id?: string; slug?: string; genre?: string } | null | undefined): string {
  if (!template) return 'squat-master';
  const anyT = template as any;

  // 1) explicit slug
  const explicit = typeof anyT.slug === 'string' ? anyT.slug.toLowerCase() : '';
  if (explicit && (OFFICIAL_CHALLENGE_SLUGS as readonly string[]).includes(explicit)) {
    return explicit;
  }

  const id = typeof anyT.id === 'string' ? anyT.id.toLowerCase() : '';

  // 2) DB UUID 1:1 — 프로덕션 Supabase 템플릿 id 직접 매핑 (genre 보다 우선).
  if (id && DB_UUID_TO_SLUG[id]) return DB_UUID_TO_SLUG[id];

  // 3) id already an official slug
  if (id && (OFFICIAL_CHALLENGE_SLUGS as readonly string[]).includes(id)) return id;

  // 4) genre alias
  const genre = typeof anyT.genre === 'string' ? anyT.genre.toLowerCase() : '';
  if (genre && GENRE_TO_SLUG[genre]) return GENRE_TO_SLUG[genre];

  // 5) legacy mock id prefix
  for (const [re, slug] of LEGACY_ID_PREFIX_TO_SLUG) {
    if (re.test(id)) return slug;
  }

  // 6) fallback
  return 'squat-master';
}
