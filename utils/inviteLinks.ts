/**
 * utils/inviteLinks.ts
 *
 * 챌린지 초대-답장 시스템의 **순수 클라이언트 딥링크 인코더/파서**.
 * CLAUDE.md §12 준수: 서버·업로드·추적 없음. 모든 컨텍스트는 쿼리스트링에만 담는다.
 *
 * v2 포맷 (컴팩트, 2026-04-23):
 *   https://<host>/c/<slug>?c=<base64url>
 *   base64url(JSON({ f, m?, s? }))   — slug 는 pathname, 나머지는 1개 파라미터로 압축
 *
 *   - slug : 공식 챌린지 slug (OFFICIAL_CHALLENGE_SLUGS) 또는 template id
 *   - f    : 초대자 이름 (최대 40자)
 *   - m    : 선택 메시지 (최대 120자)
 *   - s    : 0~100 점수
 *
 * 기존 v1 포맷도 계속 파싱 가능 (backward compatibility):
 *   https://<host>/challenge/<slug>?from=…&msg=…&score=…
 *
 * 파서는 관대한(Postel) 입력을 받지만 출력은 엄격하게 정규화한다.
 */

export interface InviteContext {
  slug: string;
  fromName: string;
  message?: string;
  score?: number;
}

const MAX_NAME_LEN = 40;
const MAX_MSG_LEN  = 120;
// FIX-INVITE-2026-04-23: UUID 포맷(36자 with dashes) 도 허용해야 홈에서 t.id(UUID) 를
//   slug 로 넘겨도 throw 하지 않음. 길이를 80자까지 허용.
const SLUG_RE      = /^[a-z0-9][a-z0-9-]{0,79}$/i;

function clampStr(raw: string, max: number): string {
  const s = (raw ?? '').toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

// ── base64url (브라우저 + node 양쪽 동작) ───────────────────────
function toBase64Url(s: string): string {
  let b64: string;
  if (typeof btoa === 'function') {
    // UTF-8 safe: encodeURIComponent → percent → bytes
    b64 = btoa(unescape(encodeURIComponent(s)));
  } else {
    // node / SSR
    b64 = Buffer.from(s, 'utf-8').toString('base64');
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(b64)));
    }
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * 전송자용 초대 URL 빌더. v2 컴팩트 포맷.
 * origin 은 `window.location.origin` 으로 호출 측이 결정. 테스트 override 가능.
 */
export function buildInviteUrl(
  slug: string,
  fromName: string,
  opts?: { message?: string; score?: number; origin?: string },
): string {
  const cleanSlug = (slug ?? '').toLowerCase().trim();
  if (!SLUG_RE.test(cleanSlug)) {
    throw new Error(`invalid challenge slug: ${slug}`);
  }
  const name = clampStr(fromName || '친구', MAX_NAME_LEN);
  const origin = (opts?.origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://motiq.app')
  ).replace(/\/+$/, '');

  const payload: { f: string; m?: string; s?: number } = { f: name };
  if (opts?.message) {
    const m = clampStr(opts.message, MAX_MSG_LEN);
    if (m) payload.m = m;
  }
  if (typeof opts?.score === 'number' && isFinite(opts.score)) {
    payload.s = Math.max(0, Math.min(100, Math.round(opts.score)));
  }
  const c = toBase64Url(JSON.stringify(payload));
  // 경로는 /challenge/<slug> 로 유지 (기존 라우트 호환). /c/<slug> 로 가려면
  // app/c/[slug]/index.tsx 추가가 필요하므로 보류.
  return `${origin}/challenge/${cleanSlug}?c=${c}`;
}

/**
 * 수신자 URL 파싱. v2(`?c=`) + v1(`?from=…`) 둘 다 처리. 유효하지 않으면 null.
 * 쿼리스트링 단독(`?c=…`) 또는 full URL 모두 지원.
 */
export function parseInviteUrl(url: string): InviteContext | null {
  if (!url || typeof url !== 'string') return null;
  let slug = '';
  let qs = '';
  try {
    const u = new URL(url, 'https://placeholder.invalid');
    const m = u.pathname.match(/\/(?:challenge|c)\/([^/]+)/i);
    if (m) slug = decodeURIComponent(m[1]);
    qs = u.search.startsWith('?') ? u.search.slice(1) : u.search;
  } catch {
    qs = url.startsWith('?') ? url.slice(1) : url;
  }
  if (!slug) return null;
  slug = slug.toLowerCase().trim();
  if (!SLUG_RE.test(slug)) return null;

  const params = new URLSearchParams(qs);

  // v2 — 단일 base64url 파라미터 `c`
  const packed = params.get('c');
  if (packed) {
    const raw = fromBase64Url(packed);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        const fromName = clampStr(String(obj.f ?? ''), MAX_NAME_LEN);
        if (!fromName) return null;
        const ctx: InviteContext = { slug, fromName };
        if (obj.m) {
          const m = clampStr(String(obj.m), MAX_MSG_LEN);
          if (m) ctx.message = m;
        }
        if (typeof obj.s === 'number' && isFinite(obj.s)) {
          ctx.score = Math.max(0, Math.min(100, Math.round(obj.s)));
        }
        return ctx;
      } catch {
        // fall through to v1 attempt
      }
    }
  }

  // v1 — 레거시 ?from=&msg=&score=
  const fromRaw = params.get('from') ?? '';
  const fromName = clampStr(fromRaw, MAX_NAME_LEN);
  if (!fromName) return null;

  const ctx: InviteContext = { slug, fromName };
  const msg = params.get('msg');
  if (msg) {
    const m = clampStr(msg, MAX_MSG_LEN);
    if (m) ctx.message = m;
  }
  const scoreRaw = params.get('score');
  if (scoreRaw != null && scoreRaw !== '') {
    const n = Number(scoreRaw);
    if (isFinite(n)) ctx.score = Math.max(0, Math.min(100, Math.round(n)));
  }
  return ctx;
}

/**
 * 초대자가 점수를 보낸 경우 수신자에게 보여줄 "도전장" 카피.
 */
export function buildInviteBannerText(ctx: InviteContext, templateName: string): string {
  if (ctx.message && ctx.message.length > 0) {
    return `${ctx.fromName}: "${ctx.message}"`;
  }
  if (typeof ctx.score === 'number') {
    return `${ctx.fromName}님이 ${templateName}에서 ${ctx.score}점 받았어요. 너도 해볼래?`;
  }
  return `${ctx.fromName}님이 ${templateName} 도전장을 보냈어요!`;
}

/**
 * 전송자 측 공유 캡션 (짧게 — 카톡 한 줄 미리보기 친화).
 */
export function buildInviteShareCaption(opts: {
  templateName: string;
  fromName: string;
  score?: number;
  inviteUrl: string;
}): string {
  const { templateName, fromName, score, inviteUrl } = opts;
  const scorePart = typeof score === 'number' ? ` ${score}점!` : '';
  return `${fromName}이(가) ${templateName}${scorePart} 도전장을 보냈어요. ${inviteUrl}`;
}

/**
 * 공유 카드(이미지+텍스트)에 들어갈 짧은 캡션.
 * 이미지 미리보기를 만드는 플랫폼(카카오톡)에서 카드 본문용.
 */
export function buildInviteShortCaption(opts: {
  templateName: string;
  fromName: string;
  score?: number;
}): string {
  const { templateName, fromName, score } = opts;
  const head = `${fromName}이(가) ${templateName} 도전장을 보냈어요!`;
  return typeof score === 'number' ? `${head} (${score}점 달성)` : head;
}

/**
 * 카드에 **눈으로 보이게** 박아넣을 짧은 display URL.
 * 카톡/라인이 메타데이터(url/text)를 삭제해도 수신자가 주소를 타이핑/복사할 수 있게.
 * `{host}/challenge/{slug}?c=<short>` 형태. base64 payload 는 길면 말줄임.
 *
 * FIX-INVITE-KAKAO-PNG (2026-04-23): 메신저가 URL 을 드롭해도 카드에 URL 이 "그려져"
 *   있으면 수신자가 읽어서 접속 가능.
 */
export function buildDisplayUrl(fullUrl: string, maxLen = 54): string {
  try {
    const u = new URL(fullUrl);
    const host = u.host.replace(/^www\./, '');
    const path = u.pathname;          // /challenge/<slug>
    const q = u.search;               // ?c=...
    const base = `${host}${path}`;
    if ((base + q).length <= maxLen) return base + q;
    const remain = Math.max(0, maxLen - base.length - 4); // "?c=…"
    const cMatch = q.match(/[?&]c=([^&]+)/);
    const cVal = cMatch ? cMatch[1] : '';
    const shortC = cVal.length > remain ? cVal.slice(0, remain) + '…' : cVal;
    return shortC ? `${base}?c=${shortC}` : base;
  } catch {
    return fullUrl.length > maxLen ? fullUrl.slice(0, maxLen - 1) + '…' : fullUrl;
  }
}

/**
 * 답장 캡션 — 수신자가 완료 후 초대자에게 보낼 메시지.
 */
export function buildReplyCaption(opts: {
  toName: string;
  templateName: string;
  score: number;
  originalInviteUrl?: string;
}): string {
  const { toName, templateName, score, originalInviteUrl } = opts;
  const tail = originalInviteUrl ? ` ${originalInviteUrl}` : '';
  return `@${toName} 나도 ${templateName} 했어! 점수: ${score}점 🎯${tail}`;
}
