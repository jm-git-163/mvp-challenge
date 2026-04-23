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

  // 2) genre alias
  const genre = typeof anyT.genre === 'string' ? anyT.genre.toLowerCase() : '';
  if (genre && GENRE_TO_SLUG[genre]) return GENRE_TO_SLUG[genre];

  // 3) id already an official slug
  const id = typeof anyT.id === 'string' ? anyT.id.toLowerCase() : '';
  if (id && (OFFICIAL_CHALLENGE_SLUGS as readonly string[]).includes(id)) return id;

  // 4) legacy mock id prefix
  for (const [re, slug] of LEGACY_ID_PREFIX_TO_SLUG) {
    if (re.test(id)) return slug;
  }

  // 5) fallback
  return 'squat-master';
}
