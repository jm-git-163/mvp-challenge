/**
 * utils/challengeMeta.ts
 *
 * 서버리스(OG 카드) + 클라이언트 양쪽에서 쓰는 **순수 slug → {name, thumbUrl}** 맵.
 * 이 파일은 DOM/React/Expo 에 의존하지 않으므로 Vercel Node 함수에서도 import 가능.
 *
 * 공식 11개 챌린지 slug 는 challengeTemplateMap.ts 와 1:1. 썸네일 URL 은
 * services/supabaseThumbnails.ts 의 largeURL(1280w) 을 그대로 복사하되,
 * 빌드 타임 cache-bust 쿼리(`cb=…`) 는 제거해 크롤러가 안정적으로 캐시하도록 한다.
 *
 * 신규 slug 추가 시 두 곳(이 파일 + supabaseThumbnails RAW) 모두 업데이트.
 */

export interface ChallengeMeta {
  slug: string;
  /** 한국어 디스플레이 이름 — OG 타이틀·설명에 사용 */
  name: string;
  /** 1280w 풀 이미지 URL — OG 카드 썸네일. 카톡/페북 크롤러는 1200x630 권장. */
  thumbUrl: string;
}

/**
 * 11 공식 slug. services/supabaseThumbnails.ts 의 largeURL 을 복사.
 * 크롤러가 쿼리 파라미터를 문제삼는 경우가 있어 cb 는 붙이지 않음.
 */
const META: Record<string, Omit<ChallengeMeta, 'slug'>> = {
  'daily-vlog': {
    name: '일상 브이로그',
    thumbUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1280&q=80',
  },
  'news-anchor': {
    name: '뉴스 앵커',
    thumbUrl: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1280&q=80',
  },
  'english-speaking': {
    name: '영어 스피킹',
    thumbUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1280&q=80',
  },
  'storybook-reading': {
    name: '동화책 읽기',
    thumbUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=1280&q=80',
  },
  'travel-checkin': {
    name: '여행 체크인',
    thumbUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1280&q=80',
  },
  'unboxing-promo': {
    name: '언박싱 프로모',
    thumbUrl: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1280&q=80',
  },
  'kpop-dance': {
    name: 'K-POP 댄스',
    thumbUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1280&q=80',
  },
  'food-review': {
    name: '음식 리뷰',
    thumbUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1280&q=80',
  },
  'motivation-speech': {
    name: '동기부여 연설',
    thumbUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1280&q=80',
  },
  'social-viral': {
    name: '소셜 바이럴',
    thumbUrl: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1280&q=80',
  },
  'squat-master': {
    name: '스쿼트 마스터',
    thumbUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1280&q=80',
  },
};

/** 공식 slug 이외(UUID / 커스텀) 도전장용 폴백 이미지 */
const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1280&q=80';

export function getChallengeMeta(slug: string): ChallengeMeta {
  const key = (slug || '').toLowerCase().trim();
  const hit = META[key];
  if (hit) return { slug: key, ...hit };
  return { slug: key || 'challenge', name: '챌린지', thumbUrl: FALLBACK_THUMB };
}

/** Base64url → JSON 디코더 — Node(Buffer) 와 브라우저(atob) 양쪽 동작. */
export function decodeInvitePayload(c: string): { f?: string; m?: string; s?: number } | null {
  if (!c || typeof c !== 'string') return null;
  try {
    const pad = c.length % 4 === 0 ? '' : '='.repeat(4 - (c.length % 4));
    const b64 = c.replace(/-/g, '+').replace(/_/g, '/') + pad;
    let raw: string;
    if (typeof atob === 'function') {
      raw = decodeURIComponent(escape(atob(b64)));
    } else {
      raw = Buffer.from(b64, 'base64').toString('utf-8');
    }
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
    return null;
  } catch {
    return null;
  }
}

/** HTML-escape — attribute/text 공용. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * OG 미리보기 페이지 HTML 을 순수 문자열로 조립.
 * slug, c(raw base64url), origin 은 호출자가 검증해서 넘긴다.
 */
export function renderOgHtml(opts: {
  slug: string;
  c?: string | null;
  origin: string;
}): string {
  const { slug, c, origin } = opts;
  const meta = getChallengeMeta(slug);
  const payload = c ? decodeInvitePayload(c) : null;
  const fromName = payload?.f ? String(payload.f).slice(0, 40) : '';
  const msg = payload?.m ? String(payload.m).slice(0, 120) : '';
  const score = typeof payload?.s === 'number' && isFinite(payload!.s)
    ? Math.max(0, Math.min(100, Math.round(payload!.s)))
    : null;

  const title = fromName
    ? `${fromName}이(가) ${meta.name} 도전장을 보냈어요!`
    : `${meta.name} 도전장`;
  const descParts: string[] = [];
  if (msg) descParts.push(`"${msg}"`);
  if (score !== null) descParts.push(`${fromName || '친구'}님 ${score}점 달성`);
  descParts.push('탭해서 함께 도전하세요');
  const description = descParts.join(' · ');

  const spaUrl = c
    ? `${origin}/challenge/${encodeURIComponent(slug)}?c=${encodeURIComponent(c)}`
    : `${origin}/challenge/${encodeURIComponent(slug)}`;
  const shareUrl = c
    ? `${origin}/share/challenge/${encodeURIComponent(slug)}?c=${encodeURIComponent(c)}`
    : `${origin}/share/challenge/${encodeURIComponent(slug)}`;

  const T = escapeHtml(title);
  const D = escapeHtml(description);
  const IMG = escapeHtml(meta.thumbUrl);
  const URL_SHARE = escapeHtml(shareUrl);
  const URL_SPA = escapeHtml(spaUrl);
  const ALT = escapeHtml(meta.name);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${T}</title>
<meta name="description" content="${D}">
<meta property="og:type" content="website">
<meta property="og:title" content="${T}">
<meta property="og:description" content="${D}">
<meta property="og:image" content="${IMG}">
<meta property="og:image:alt" content="${ALT}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="853">
<meta property="og:url" content="${URL_SHARE}">
<meta property="og:site_name" content="MotiQ">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${T}">
<meta name="twitter:description" content="${D}">
<meta name="twitter:image" content="${IMG}">
<meta http-equiv="refresh" content="0;url=${URL_SPA}">
<link rel="canonical" href="${URL_SPA}">
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0b0b10;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}a{color:#6ea8ff;font-size:18px;text-decoration:none;padding:14px 24px;border:1px solid #6ea8ff;border-radius:999px;margin-top:16px}img{max-width:100%;width:320px;border-radius:16px}</style>
</head>
<body>
<img src="${IMG}" alt="${ALT}">
<h1 style="font-size:20px;margin:24px 0 8px">${T}</h1>
<p style="opacity:.7;margin:0 0 16px">${D}</p>
<a href="${URL_SPA}">챌린지 시작하기</a>
<script>try{location.replace(${JSON.stringify(spaUrl)})}catch(e){}</script>
</body>
</html>`;
}
