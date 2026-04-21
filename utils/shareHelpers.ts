/**
 * utils/shareHelpers.ts
 *
 * Focused Session-3 Candidate H: **SNS 공유 · 다운로드 순수 헬퍼**.
 *
 * `app/result/index.tsx` 인라인 로직을 테스트 가능한 순수 함수로 추출.
 *   - `extensionForBlob(blob)` — 실제 MIME → 확장자 (mp4/webm/mov)
 *   - `sanitizeFilename(name)`  — 기기 저장 안전 파일명
 *   - `composeShareUrl(platform, text)` — 플랫폼별 공유 URL (kakao/youtube/쓰레드 추가)
 *   - `canUseWebShareFiles(navigator, blob, fileName)` — iOS Safari + webm 조기 거절
 *   - `buildHashtagCaption(opts)` — 템플릿/점수/해시태그 조합
 *
 * 파일 시스템 · DOM · navigator 부수효과는 호출 측이 담당. 이 파일은 계산만.
 */

export type SharePlatform =
  | 'twitter'
  | 'facebook'
  | 'threads'
  | 'instagram'
  | 'tiktok'
  | 'kakao'
  | 'youtube_shorts';

export interface ShareText {
  templateName: string;
  score: number;
  stars?: number;        // 1~5
  hashtags?: string[];   // '#' 선행 포함 여부 모두 허용, 정규화됨
  suffix?: string;       // 끝에 덧붙일 텍스트
}

// ── 확장자/파일명 ─────────────────────────────────────────

const MIME_TO_EXT: Array<[RegExp, string]> = [
  [/video\/mp4/i, 'mp4'],
  [/video\/quicktime/i, 'mov'],
  [/video\/webm/i, 'webm'],
  [/video\/ogg/i, 'ogv'],
];

/** 실제 Blob 의 MIME 으로부터 안전 확장자 결정. 알 수 없으면 webm(캡처 기본). */
export function extensionForBlob(blob: { type?: string } | null | undefined): string {
  const t = blob?.type || '';
  for (const [re, ext] of MIME_TO_EXT) {
    if (re.test(t)) return ext;
  }
  return 'webm';
}

/** 안전 파일명: 공백·한글 유지, OS 금지문자 제거, 최대 60자. */
export function sanitizeFilename(raw: string): string {
  const cleaned = (raw || 'challenge')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'challenge';
}

/** yyyyMMdd_HHmm 스탬프 (기본 다운로드 파일명 suffix 용). */
export function timestampStamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function buildDownloadFilename(templateName: string, blob: Blob | null): string {
  const name = sanitizeFilename(templateName);
  const ext = extensionForBlob(blob);
  return `${name}_${timestampStamp()}.${ext}`;
}

// ── 플랫폼 공유 URL ─────────────────────────────────────────

/**
 * 플랫폼별 공유/업로드 URL 반환. 미지원 플랫폼은 null.
 * tiktok/instagram/youtube_shorts 는 업로드 UI 로 이동(텍스트 미지원 → 호출자가 캡션 클립보드 복사).
 */
export function composeShareUrl(platform: SharePlatform, text: string): string | null {
  const enc = encodeURIComponent(text || '');
  switch (platform) {
    case 'twitter':         return `https://twitter.com/intent/tweet?text=${enc}`;
    case 'facebook':        return `https://www.facebook.com/sharer/sharer.php?quote=${enc}`;
    case 'threads':         return `https://www.threads.net/intent/post?text=${enc}`;
    case 'instagram':       return 'https://www.instagram.com/create/story';
    case 'tiktok':          return 'https://www.tiktok.com/upload';
    case 'youtube_shorts':  return 'https://www.youtube.com/upload';
    // 카카오는 SDK 필요. URL 스킴 만으로는 안전한 공유 불가 → null 반환 시 UI 가 "캡션 복사" 폴백.
    case 'kakao':           return null;
    default:                return null;
  }
}

// ── Web Share 파일 지원 체크 ────────────────────────────────

export interface NavigatorShareLike {
  share?: (data: { files?: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
  userAgent?: string;
}

/**
 * Web Share API 파일 공유 가능 여부.
 *   - navigator.share + canShare({files}) 통과
 *   - iOS Safari 는 webm 거부 → 별도 차단
 */
export function canUseWebShareFiles(
  nav: NavigatorShareLike | undefined | null,
  blob: Blob | null,
  fileName: string,
): boolean {
  if (!nav || typeof nav.share !== 'function' || !blob) return false;
  const ua = nav.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in (globalThis as object));
  const ext = extensionForBlob(blob);
  if (isIOS && ext === 'webm') return false; // iOS 는 webm 파일 거부

  // 환경에 따라 File 생성자가 없을 수 있음 (node/test) → 안전 guard
  if (typeof File !== 'function') return false;
  try {
    const probe = new File([blob], fileName, { type: blob.type || 'video/webm' });
    if (typeof nav.canShare === 'function') return !!nav.canShare({ files: [probe] });
    return true; // canShare 미구현 → 시도해볼 만함
  } catch {
    return false;
  }
}

// ── 해시태그 캡션 ─────────────────────────────────────────

const HASHTAG_RE = /^[A-Za-z0-9가-힣_]+$/;

/** '#foo' 또는 'foo' 둘 다 허용 → '#foo' 로 정규화. 유효문자만 필터. */
export function normalizeHashtag(tag: string): string | null {
  if (!tag) return null;
  const stripped = tag.trim().replace(/^#+/, '');
  if (!stripped) return null;
  if (!HASHTAG_RE.test(stripped)) return null;
  return `#${stripped}`;
}

/** 점수/별/템플릿 조합 SNS 캡션. 최대 280자 자동 잘림. */
export function buildHashtagCaption(opts: ShareText): string {
  const { templateName, score, stars, hashtags, suffix } = opts;
  const starStr = typeof stars === 'number'
    ? ' ' + '★'.repeat(Math.max(0, Math.min(5, Math.floor(stars))))
    : '';
  const head = `${templateName} 챌린지 ${score}점${starStr}`;
  const tags = (hashtags ?? ['MotiQ', 'Challenge'])
    .map(normalizeHashtag)
    .filter((t): t is string => !!t)
    .join(' ');
  const parts = [head, tags, suffix].filter((s) => !!s && s.length > 0);
  const joined = parts.join(' · ');
  return joined.length > 280 ? joined.slice(0, 277) + '…' : joined;
}
