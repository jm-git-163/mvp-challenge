/**
 * utils/inviteLinks.ts
 *
 * 챌린지 초대-답장 시스템의 **순수 클라이언트 딥링크 인코더/파서**.
 * CLAUDE.md §12 준수: 서버·업로드·추적 없음. 모든 컨텍스트는 쿼리스트링에만 담는다.
 *
 * 링크 포맷:
 *   https://<host>/challenge/<slug>?from=<encodedName>&msg=<encodedMsg>&score=<n>
 *
 *   - slug  : 공식 챌린지 slug (services/challengeTemplateMap OFFICIAL_CHALLENGE_SLUGS)
 *   - from  : 초대한 친구 이름 (URL-encoded, 최대 40자)
 *   - msg   : 선택적 개인 메시지 (URL-encoded, 최대 120자)
 *   - score : 초대자가 받은 점수 (0~100, 선택)
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
const SLUG_RE      = /^[a-z0-9][a-z0-9-]{0,40}$/i;

function clampStr(raw: string, max: number): string {
  const s = (raw ?? '').toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * 전송자용 초대 URL 빌더.
 * host 는 `window.location.origin` 로 호출 측에서 결정. 테스트 용도로 override.
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

  const params = new URLSearchParams();
  params.set('from', name);
  if (opts?.message) {
    const m = clampStr(opts.message, MAX_MSG_LEN);
    if (m) params.set('msg', m);
  }
  if (typeof opts?.score === 'number' && isFinite(opts.score)) {
    const n = Math.max(0, Math.min(100, Math.round(opts.score)));
    params.set('score', String(n));
  }
  return `${origin}/challenge/${cleanSlug}?${params.toString()}`;
}

/**
 * 수신자 URL 파싱. 유효하지 않으면 null.
 * 쿼리스트링 단독(`?from=…`) 또는 full URL 모두 지원.
 */
export function parseInviteUrl(url: string): InviteContext | null {
  if (!url || typeof url !== 'string') return null;
  let slug = '';
  let qs = '';
  try {
    // full URL 우선
    const u = new URL(url, 'https://placeholder.invalid');
    const m = u.pathname.match(/\/challenge\/([^/]+)/i);
    if (m) slug = decodeURIComponent(m[1]);
    qs = u.search.startsWith('?') ? u.search.slice(1) : u.search;
  } catch {
    // 쿼리스트링 단독
    qs = url.startsWith('?') ? url.slice(1) : url;
  }
  if (!slug) return null;
  slug = slug.toLowerCase().trim();
  if (!SLUG_RE.test(slug)) return null;

  const params = new URLSearchParams(qs);
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
 * 메시지가 있으면 우선, 없으면 점수 기반 기본 카피.
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
 * 전송자 측 네이티브 share sheet 용 기본 캡션.
 */
export function buildInviteShareCaption(opts: {
  templateName: string;
  fromName: string;
  score?: number;
  inviteUrl: string;
}): string {
  const { templateName, fromName, score, inviteUrl } = opts;
  const scorePart = typeof score === 'number' ? ` ${score}점 받았어!` : '';
  return `내가 ${templateName}${scorePart} 너도 해볼래? ${inviteUrl}`;
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
