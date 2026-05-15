/**
 * api/share/challenge/[slug].ts
 *
 * Vercel Node serverless 함수. **카카오톡/라인/페이스북 등 크롤러가 JS 실행 없이도
 * OG 리치 프리뷰 카드를 얻도록** 정적 HTML 을 반환한다.
 *
 * 흐름:
 *   발신자 → `https://motiq.app/share/challenge/<slug>?c=<base64url>` 를 카톡에 붙여넣음
 *   ─ Kakao Link 크롤러가 이 URL 을 GET → 이 함수가 OG 메타 박힌 HTML 반환
 *   ─ 크롤러가 og:image/title/description 파싱 → 리치 카드 렌더
 *   ─ 수신자가 카드 탭 → 브라우저가 같은 URL GET → 이 함수가 meta refresh + JS redirect
 *     로 SPA 라우트 `/challenge/<slug>?c=...` 로 자동 이동
 *
 * vercel.json 의 rewrite 가 `/share/challenge/<slug>` → `/api/share/challenge/<slug>` 로
 * 라우팅한다. SPA 쪽 `/challenge/<slug>` 는 전혀 손대지 않는다 (기존 동작 유지).
 */

import { renderOgHtml } from '../../../utils/challengeMeta';

// Vercel Node runtime request/response 는 Node http 의 서브타입.
// 타입 import 를 피해 최소 의존 interface 로 선언한다.
interface VercelReq {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}
interface VercelRes {
  status(code: number): VercelRes;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  end(body?: string): void;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;

function pickString(v: unknown): string | null {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null;
  return typeof v === 'string' ? v : null;
}

function inferOrigin(req: VercelReq): string {
  const h = req.headers;
  const proto = (pickString(h['x-forwarded-proto']) ?? 'https').split(',')[0].trim();
  const host = (pickString(h['x-forwarded-host']) ?? pickString(h['host']) ?? 'motiq.app').split(',')[0].trim();
  return `${proto}://${host}`;
}

export default function handler(req: VercelReq, res: VercelRes): void {
  // 파라미터는 (a) Vercel file-based routing 이 req.query.slug 로 주입하거나
  // (b) rewrite 로 오면 URL pathname 에서 수동 추출.
  let slug = pickString(req.query?.slug) ?? '';
  if (!slug && typeof req.url === 'string') {
    const m = req.url.match(/\/share\/challenge\/([^/?#]+)/i);
    if (m) slug = decodeURIComponent(m[1]);
  }
  slug = slug.toLowerCase().trim();

  if (!slug || !SLUG_RE.test(slug)) {
    res.status(404);
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.send('invalid challenge slug');
    return;
  }

  let c: string | null = pickString(req.query?.c);
  if (!c && typeof req.url === 'string') {
    const idx = req.url.indexOf('?');
    if (idx >= 0) {
      const qs = new URLSearchParams(req.url.slice(idx + 1));
      c = qs.get('c');
    }
  }
  // c 는 base64url 만 허용 — 이상한 입력은 drop (fallback: 이름 없는 기본 카드).
  if (c && !/^[A-Za-z0-9_-]+$/.test(c)) c = null;

  const origin = inferOrigin(req);
  const html = renderOgHtml({ slug, c, origin });

  res.setHeader('content-type', 'text/html; charset=utf-8');
  // 크롤러 쪽 CDN 은 리치 프리뷰 갱신을 위해 단기 캐시. 사용자 리다이렉트 는 영향 없음.
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(html);
}
