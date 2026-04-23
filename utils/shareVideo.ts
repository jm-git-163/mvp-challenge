/**
 * utils/shareVideo.ts
 *
 * Unified end-to-end share pipeline for the final challenge mp4. Single source
 * of truth used by app/result/index.tsx — do NOT duplicate these flows inline.
 *
 * Design goals:
 *  1. **One-tap Web Share** with `navigator.share({ files })` when the browser
 *     supports it AND the blob is reasonable (mp4 preferred, ≥500KB).
 *  2. **Deterministic fallback** when Web Share is unavailable or refused:
 *        a) Save file to device (<a download>).
 *        b) Copy caption to clipboard.
 *        c) Deep-link into the target SNS app (kakao / instagram / youtube).
 *  3. **Explicit error surface**: resolved `ShareResult` object — callers show
 *     toasts based on `kind`, never guess. AbortError (user cancel) is NOT an
 *     error; it resolves `kind: 'cancelled'`.
 *  4. **100% client-side** per CLAUDE.md §12 — no uploads, no analytics.
 *
 * NOTE: invite-card share lives in utils/inviteShareCard.ts and is independent.
 */

export type SharePlatform = 'kakao' | 'instagram' | 'youtube' | 'native';

export interface ShareVideoOptions {
  /** The final mp4 (or webm fallback) blob. Must already be produced. */
  file: File;
  /** Caption with hashtags. Gets copied to clipboard in fallback paths. */
  caption: string;
  /** Optional title for Web Share dialog. */
  title?: string;
  /** Target platform. 'native' → prefer OS share sheet. */
  platform?: SharePlatform;
}

export type ShareResultKind =
  | 'web-share-success'     // navigator.share resolved
  | 'fallback-success'      // downloaded + clipboard + deep-link fired
  | 'cancelled'             // user cancelled native share sheet
  | 'unsupported'           // file type/size blocked, nothing happened
  | 'partial'               // download or clipboard failed but proceeded
  | 'error';

export interface ShareResult {
  kind: ShareResultKind;
  /** Human-readable Korean message suitable to pass into a toast. */
  message: string;
  /** Underlying error, if any. */
  error?: unknown;
  /** Platform actually attempted (after negotiation). */
  platform: SharePlatform;
  /** Whether file was saved to device. */
  downloaded?: boolean;
  /** Whether caption landed in clipboard. */
  captionCopied?: boolean;
}

// ── Environment detection ───────────────────────────────────────────────

function getUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

function isAndroid(): boolean { return /Android/i.test(getUserAgent()); }
function isIOS(): boolean { return /iPhone|iPad|iPod/i.test(getUserAgent()); }
function isMobile(): boolean { return isAndroid() || isIOS(); }

// Minimum plausible finished-video size. 10KB — short clips (~2s) can legitimately
// land under 500KB depending on codec + bitrate, so we only reject obviously-broken
// 0~few-KB blobs from a failed recording pipeline.
export const MIN_VIDEO_BYTES = 10 * 1024;

// ── Primitives ──────────────────────────────────────────────────────────

function canUseWebShareFiles(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try { return navigator.canShare({ files: [file] }); } catch { return false; }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

async function downloadFile(file: File): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'challenge.mp4';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 60s grace — Android Chrome can still be streaming the blob.
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60_000);
    return true;
  } catch { return false; }
}

// ── Deep links ──────────────────────────────────────────────────────────

/**
 * Open a deep link. Prefers Android intent → iOS custom scheme → https.
 * Uses location.href (same tab) for custom schemes so the OS can hand off,
 * and a new-tab <a> for https fallback so we don't lose the result page.
 */
function openDeepLink(urls: { androidIntent?: string; iosScheme?: string; https: string }): void {
  if (typeof window === 'undefined') return;

  // Mobile: fire the app scheme, then schedule https fallback if the app
  // didn't grab focus in 1.2s (document still visible).
  const fireScheme = (scheme: string) => {
    try { window.location.href = scheme; } catch {}
  };
  const openHttpsNewTab = () => {
    try {
      const a = document.createElement('a');
      a.href = urls.https;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  };

  if (isAndroid() && urls.androidIntent) {
    fireScheme(urls.androidIntent);
    return;
  }
  if (isIOS() && urls.iosScheme) {
    fireScheme(urls.iosScheme);
    // iOS: if user still here after 1.5s, open web fallback.
    setTimeout(() => {
      if (typeof document !== 'undefined' && !document.hidden) openHttpsNewTab();
    }, 1500);
    return;
  }
  openHttpsNewTab();
}

function deepLinkFor(platform: SharePlatform): void {
  switch (platform) {
    case 'kakao':
      // KakaoTalk has no "open with file" scheme on web — just open the app;
      // user picks the chat and attaches the just-downloaded video manually.
      openDeepLink({
        androidIntent:
          'intent://#Intent;scheme=kakaotalk;package=com.kakao.talk;S.browser_fallback_url=https%3A%2F%2Fwww.kakaocorp.com%2Fservice%2FKakaoTalk;end',
        iosScheme: 'kakaotalk://',
        https: 'https://www.kakaocorp.com/service/KakaoTalk',
      });
      return;
    case 'instagram':
      openDeepLink({
        androidIntent:
          'intent://library#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=https%3A%2F%2Fwww.instagram.com%2F;end',
        iosScheme: 'instagram://library',
        https: 'https://www.instagram.com/',
      });
      return;
    case 'youtube':
      openDeepLink({
        androidIntent:
          'intent://upload#Intent;scheme=vnd.youtube;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fstudio.youtube.com%2F;end',
        iosScheme: 'vnd.youtube://upload',
        https: 'https://studio.youtube.com/',
      });
      return;
    case 'native':
    default:
      return;
  }
}

// ── Main entry point ────────────────────────────────────────────────────

/**
 * End-to-end share. Returns a `ShareResult` — callers should always await
 * and inspect `.kind` / `.message`.
 *
 *   shareVideoToSns({ file, caption })                       → native share sheet
 *   shareVideoToSns({ file, caption, platform: 'kakao' })    → download + deep link
 */
export async function shareVideoToSns(opts: ShareVideoOptions): Promise<ShareResult> {
  const { file, caption, title } = opts;
  const platform: SharePlatform = opts.platform ?? 'native';

  // Guard: file must exist and be reasonable size.
  if (!file || !(file instanceof Blob)) {
    return { kind: 'unsupported', platform, message: '영상이 아직 준비되지 않았어요.' };
  }
  if (file.size < MIN_VIDEO_BYTES) {
    return {
      kind: 'unsupported', platform,
      message: '영상 파일이 손상된 것 같아요. 다시 촬영해주세요.',
    };
  }

  // ── Path 1: native → try Web Share first.
  if (platform === 'native' && canUseWebShareFiles(file)) {
    try {
      await navigator.share({ files: [file], text: caption, title: title || file.name });
      return { kind: 'web-share-success', platform, message: '공유 시작됨' };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { kind: 'cancelled', platform, message: '공유가 취소됐어요.', error: e };
      }
      // NotAllowedError / TypeError → fall through to manual fallback.
    }
  }

  // ── Path 2: fallback — save → copy caption → deep link.
  const downloaded = await downloadFile(file);
  const captionCopied = caption ? await copyToClipboard(caption) : false;

  // Fire deep-link only on mobile for platform-specific routes;
  // desktop users just get the download + caption.
  if (platform !== 'native' && isMobile()) {
    deepLinkFor(platform);
  }

  if (!downloaded && !captionCopied) {
    return {
      kind: 'error', platform,
      message: '저장에 실패했어요. 다시 시도해주세요.',
      downloaded, captionCopied,
    };
  }
  if (!downloaded) {
    return {
      kind: 'partial', platform,
      message: '캡션만 복사됐어요. 다운로드를 다시 시도해주세요.',
      downloaded, captionCopied,
    };
  }

  const platformLabel =
    platform === 'kakao'     ? '카카오톡' :
    platform === 'instagram' ? '인스타그램' :
    platform === 'youtube'   ? '유튜브' : '원하는 앱';

  return {
    kind: 'fallback-success', platform,
    message: `영상 저장 · 캡션 복사 완료. ${platformLabel}에서 첨부해주세요.`,
    downloaded, captionCopied,
  };
}

// ── Helpers re-exported for callers that build the File themselves ──────

/** Build a File from a Blob with a clean mp4/webm name. */
export function blobToShareFile(blob: Blob, baseName = 'challenge'): File {
  const type = blob.type || 'video/mp4';
  const ext = /mp4/i.test(type) ? 'mp4' : /webm/i.test(type) ? 'webm' : /quicktime/i.test(type) ? 'mov' : 'mp4';
  const safe = baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().slice(0, 60) || 'challenge';
  return new File([blob], `${safe}.${ext}`, { type });
}
