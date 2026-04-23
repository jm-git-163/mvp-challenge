/**
 * utils/share.ts
 *
 * **SINGLE SOURCE OF TRUTH** for all SNS share flows — video + invite.
 *
 * Replaces the ad-hoc inline handlers that lived in:
 *   - app/result/index.tsx → ShareModal.runShare, handleSendInvite, handleReplyBack
 *   - app/(main)/home/index.tsx → handleInvite
 *
 * Design doc: docs/SHARE_ARCHITECTURE.md. If this file disagrees, the doc wins.
 *
 * Public API:
 *   shareVideo({ file, caption, title? })                → Promise<ShareResult>
 *   shareInvite({ slug, fromName, templateName, ... })   → Promise<ShareResult>
 *   prepareVideoFile(source: Blob | string, name)        → Promise<File | null>
 *
 * 100% client-side. No uploads, no analytics (CLAUDE.md §12).
 */

import {
  buildInviteUrl,
  buildInviteShareCaption,
  buildInviteShortCaption,
  buildDisplayUrl,
} from './inviteLinks';
import {
  generateInviteShareCard,
  canShareInviteCard,
  isInAppBrowserWithBrokenShare,
} from './inviteShareCard';
import { blobToShareFile } from './shareVideo';

// ─── Types ─────────────────────────────────────────────────────────────

export type ShareKind =
  | 'web-share'      // navigator.share resolved with files
  | 'web-share-text' // navigator.share resolved with text only (no file)
  | 'fallback'       // download + clipboard path
  | 'cancelled'      // user AbortError
  | 'unsupported'    // nothing could run
  | 'error';         // unexpected exception

export interface ShareResult {
  kind: ShareKind;
  message: string;          // Korean, toast-ready
  downloaded?: boolean;
  captionCopied?: boolean;
  cardShared?: boolean;
  error?: unknown;
}

export interface ShareVideoOpts {
  file: File;
  caption: string;
  title?: string;
}

export interface ShareInviteOpts {
  slug: string;             // official challenge slug
  fromName: string;
  templateName: string;
  score?: number;
  thumbnailUrl: string;
  message?: string;         // optional custom note from sender
}

// ─── Environment detection ─────────────────────────────────────────────

interface Env {
  inAppBrowser: boolean;
  canShareFiles: (file: File) => boolean;
  canShareText: boolean;
  ios: boolean;
  android: boolean;
  hasClipboard: boolean;
}

function detectEnv(): Env {
  if (typeof navigator === 'undefined') {
    return {
      inAppBrowser: false,
      canShareFiles: () => false,
      canShareText: false,
      ios: false, android: false,
      hasClipboard: false,
    };
  }
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  const nav = navigator as any;
  const hasShare = typeof nav.share === 'function';
  const hasCanShare = typeof nav.canShare === 'function';
  const inAppBrowser = isInAppBrowserWithBrokenShare();

  const canShareFiles = (file: File): boolean => {
    if (!hasShare || !hasCanShare) return false;
    if (inAppBrowser) return false;           // Kakao etc. silently abort
    // iOS Safari rejects webm. Only allow mp4/mov/png/jpeg.
    const t = (file.type || '').toLowerCase();
    if (ios && /webm/.test(t)) return false;
    try { return !!nav.canShare({ files: [file] }); } catch { return false; }
  };

  return {
    inAppBrowser,
    canShareFiles,
    canShareText: hasShare && !inAppBrowser,
    ios, android,
    hasClipboard: typeof nav.clipboard?.writeText === 'function',
  };
}

// ─── Logging ───────────────────────────────────────────────────────────

function log(event: string, data?: unknown): void {
  if (typeof console === 'undefined') return;
  const cid = Math.floor(Date.now() / 1000) % 100000;
  try { console.info(`[share:${cid}] ${event}`, data ?? ''); } catch {}
}

// ─── Primitives ────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {}
  // Legacy fallback
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy') ?? false;
    document.body.removeChild(ta);
    return !!ok;
  } catch { return false; }
}

function saveBlobToDevice(file: File): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'challenge.mp4';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60_000);
    return true;
  } catch { return false; }
}

// ─── prepareVideoFile — call from useEffect, cache in ref ──────────────

/**
 * Build a File the caller can hand to shareVideo() synchronously.
 * Safe to call with a Blob (no network) or a blob: URL (needs fetch).
 * Returns null if the source is empty/corrupt.
 */
export async function prepareVideoFile(
  source: Blob | string,
  name: string,
): Promise<File | null> {
  log('prepare.start', { source: typeof source === 'string' ? source : `Blob(${source.size})` });
  try {
    let blob: Blob | null = null;
    if (typeof source === 'string') {
      if (!source) { log('prepare.fail', 'empty-url'); return null; }
      const resp = await fetch(source);
      blob = await resp.blob();
    } else {
      blob = source;
    }
    if (!blob || blob.size < 10 * 1024) {
      log('prepare.fail', `tiny-blob:${blob?.size ?? 0}`);
      return null;
    }
    const file = blobToShareFile(blob, name);
    log('prepare.ok', { name: file.name, size: file.size, type: file.type });
    return file;
  } catch (e) {
    log('prepare.fail', e);
    return null;
  }
}

// ─── shareVideo ────────────────────────────────────────────────────────

/**
 * End-to-end share for a completed challenge mp4.
 * Caller MUST have a prepared File (via prepareVideoFile in useEffect).
 *
 * iOS Safari rule: this function's call to navigator.share MUST run in the
 * same synchronous tick as the user tap. Callers: do not await anything
 * between the tap and shareVideo({}).
 */
export async function shareVideo(opts: ShareVideoOpts): Promise<ShareResult> {
  const { file, caption, title } = opts;
  const env = detectEnv();
  log('video.start', { env, size: file?.size, type: file?.type });

  if (!file || !(file instanceof Blob)) {
    return { kind: 'unsupported', message: '영상이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.' };
  }
  if (file.size < 10 * 1024) {
    return { kind: 'unsupported', message: '영상 파일이 손상된 것 같아요. 다시 촬영해주세요.' };
  }

  // Path A: Web Share with files.
  if (env.canShareFiles(file)) {
    try {
      log('attempt.websrc.files', { name: file.name });
      await (navigator as any).share({
        files: [file],
        text: caption,
        title: title || file.name,
      });
      log('result.web-share', 'ok');
      return { kind: 'web-share', message: '공유 시작됨' };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        log('result.cancelled', 'user-abort');
        return { kind: 'cancelled', message: '공유가 취소됐어요.', error: e };
      }
      log('attempt.websrc.files.fail', e);
      // fall through to fallback
    }
  }

  // Path B: download + clipboard + optional text-only share.
  const downloaded = saveBlobToDevice(file);
  const captionCopied = caption ? await copyToClipboard(caption) : false;
  log('attempt.fallback', { downloaded, captionCopied });

  // Best-effort text-only Web Share (no files) — on desktop this is a no-op
  // if browser has no share API, on iOS it often opens the share sheet
  // without attachment which is still useful.
  if (env.canShareText && downloaded) {
    try {
      // Fire-and-forget. Do NOT await — user-gesture may already be spent.
      (navigator as any)
        .share({ text: caption, title: title || file.name })
        .catch(() => {});
    } catch {}
  }

  if (!downloaded && !captionCopied) {
    return {
      kind: 'error',
      message: '저장과 복사 모두 실패했어요. 브라우저 권한을 확인해주세요.',
      downloaded, captionCopied,
    };
  }
  if (!downloaded) {
    return {
      kind: 'fallback',
      message: '캡션만 복사됐어요. 다운로드를 다시 시도해주세요.',
      downloaded, captionCopied,
    };
  }

  const msg = env.inAppBrowser
    ? '영상이 저장됐어요. 카톡 채팅창에서 첨부해주세요.'
    : captionCopied
      ? '영상 저장 · 캡션 복사 완료. 원하는 앱에서 첨부해주세요.'
      : '영상 저장 완료. 원하는 앱에서 첨부해주세요.';

  return { kind: 'fallback', message: msg, downloaded, captionCopied };
}

// ─── shareInvite ───────────────────────────────────────────────────────

export async function shareInvite(opts: ShareInviteOpts): Promise<ShareResult> {
  const { slug, fromName, templateName, score, thumbnailUrl, message } = opts;
  const env = detectEnv();
  log('invite.start', { slug, fromName, hasScore: typeof score === 'number', env });

  // 1) Build URL + captions. All synchronous — fails fast if slug invalid.
  let url: string;
  try {
    url = buildInviteUrl(slug, fromName, { score, message });
  } catch (e: any) {
    log('invite.buildUrl.fail', e);
    return {
      kind: 'error',
      message: `초대 링크 생성 실패: ${e?.message || 'slug 오류'} (slug=${slug})`,
      error: e,
    };
  }
  const caption = buildInviteShareCaption({ templateName, fromName, score, inviteUrl: url });
  const shortCaption = buildInviteShortCaption({ templateName, fromName, score });

  // 2) Clipboard first — this is the ONE thing we can always do.
  const captionCopied = await copyToClipboard(caption);
  log('invite.clipboard', captionCopied);

  // 3) Path A — PNG card share (preferred, only when files are supported).
  if (canShareInviteCard()) {
    try {
      log('invite.card.generate.start', { thumb: thumbnailUrl });
      const png = await generateInviteShareCard({
        thumbnailUrl,
        headline: `${fromName}이(가) 도전장을 보냈어요`,
        subline: typeof score === 'number' && score > 0
          ? `${templateName} · ${score}점`
          : templateName,
        displayUrl: buildDisplayUrl(url),
      });
      if (png) {
        const file = new File([png], 'invite.png', { type: 'image/png' });
        if ((navigator as any).canShare?.({ files: [file] })) {
          log('invite.card.share.attempt');
          await (navigator as any).share({
            title: `${templateName} 도전장`,
            text: `${shortCaption}\n\n${url}`,
            url,
            files: [file],
          });
          log('result.web-share', 'card');
          return {
            kind: 'web-share',
            message: '도전장을 보냈어요!',
            captionCopied, cardShared: true,
          };
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        log('result.cancelled', 'invite-abort');
        // User cancelled — clipboard still holds the caption, that's a win.
        return {
          kind: 'cancelled',
          message: captionCopied
            ? '공유는 취소됐지만 링크가 복사됐어요.'
            : '공유가 취소됐어요.',
          captionCopied,
        };
      }
      log('invite.card.share.fail', e);
      // fall through to text-only path
    }
  }

  // 4) Path B — text-only Web Share (no file). Skip in in-app browsers.
  if (env.canShareText) {
    try {
      log('invite.text.share.attempt');
      await (navigator as any).share({
        title: `${templateName} 도전장`,
        text: caption,
        url,
      });
      log('result.web-share-text');
      return {
        kind: 'web-share-text',
        message: '도전장을 보냈어요!',
        captionCopied,
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return {
          kind: 'cancelled',
          message: captionCopied
            ? '공유는 취소됐지만 링크가 복사됐어요.'
            : '공유가 취소됐어요.',
          captionCopied,
        };
      }
      log('invite.text.share.fail', e);
    }
  }

  // 5) Path C — in-app browser (Kakao) or no Web Share at all.
  //    Clipboard is already populated. Open SMS on mobile as last resort.
  if (env.inAppBrowser) {
    return {
      kind: 'fallback',
      message: captionCopied
        ? '✓ 도전장이 복사됐어요. 채팅창에 붙여넣어주세요.'
        : '⚠ 클립보드 사용이 막혔어요. 주소창 권한을 확인해주세요.',
      captionCopied,
    };
  }

  if ((env.ios || env.android) && typeof window !== 'undefined') {
    try { window.location.href = `sms:?body=${encodeURIComponent(caption)}`; } catch {}
    return {
      kind: 'fallback',
      message: captionCopied
        ? '✓ 링크 복사됨. 문자 앱이 열리면 붙여넣기 하세요.'
        : '문자 앱을 열었어요. 내용을 직접 입력해주세요.',
      captionCopied,
    };
  }

  return {
    kind: captionCopied ? 'fallback' : 'unsupported',
    message: captionCopied
      ? '✓ 도전장 링크가 복사됐어요. 메신저에 붙여넣어주세요.'
      : '이 브라우저는 공유를 지원하지 않아요. 업데이트 후 다시 시도해주세요.',
    captionCopied,
  };
}

// ─── shareReply — convenience wrapper for "답장 보내기" on result page ──

export async function shareReply(opts: {
  file: File | null;
  caption: string;
  templateName: string;
}): Promise<ShareResult> {
  const { file, caption, templateName } = opts;
  // If we have a file, it's the same pipeline as shareVideo with reply caption.
  if (file) {
    return shareVideo({ file, caption, title: `${templateName} 답장` });
  }
  // No file — text-only share + clipboard.
  const env = detectEnv();
  const copied = await copyToClipboard(caption);
  if (env.canShareText) {
    try {
      await (navigator as any).share({ title: `${templateName} 답장`, text: caption });
      return { kind: 'web-share-text', message: '답장을 보냈어요!', captionCopied: copied };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { kind: 'cancelled', message: '답장이 취소됐어요.', captionCopied: copied };
      }
    }
  }
  return {
    kind: copied ? 'fallback' : 'unsupported',
    message: copied
      ? '✓ 답장 캡션이 복사됐어요. 친구에게 붙여넣어주세요.'
      : '공유할 수 없었어요. 브라우저를 바꿔주세요.',
    captionCopied: copied,
  };
}
