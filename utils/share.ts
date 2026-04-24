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
} from './inviteLinks';
import {
  // generateInviteShareCard / canShareInviteCard — invite 경로에서 더 이상 사용하지 않음.
  //   (FIX-KAKAO-INVITE 2026-04-23: file 을 넣으면 메신저가 url 을 드롭하는 문제)
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

  // Path A: Web Share with files — iOS ONLY.
  // FIX-KAKAO-VIDEO (2026-04-23): Android Chrome + KakaoTalk 에 video file intent 를
  //   넘기면 Kakao 가 video MIME 을 인식 못하고 **Play Store 다운로드 페이지**로
  //   폴백한다 (사용자 Kakao 는 이미 설치돼 있음에도). iOS 는 iMessage/AirDrop 와
  //   정상 동작하므로 iOS 에서만 file share 시도, Android 는 무조건 download-first.
  if (env.ios && env.canShareFiles(file)) {
    try {
      log('attempt.websrc.files', { name: file.name, platform: 'ios' });
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

  // NOTE: 이전 버전에서 fallback 다음에 text-only navigator.share 를 fire-and-forget
  //   으로 호출했으나, Android Chrome 에서 이게 또 KakaoTalk 을 열고 Play Store 로
  //   폴백되는 문제가 있어 제거. 사용자에게 토스트로 "저장된 영상을 메신저에서 직접
  //   첨부" 를 안내하는 쪽이 훨씬 확실함.

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

  // FIX-SHARE-CAMERA-FINAL (2026-04-24): 모든 fallback 토스트 통일.
  //   "다운로드 완료 → 사용자가 직접 앱 열어 갤러리에서 선택" 패턴.
  const msg = captionCopied
    ? '✓ 영상 저장 · 캡션 복사 완료. 카카오톡/인스타그램을 직접 열어 채팅방 → + 버튼 → 갤러리에서 방금 저장된 영상을 선택해주세요.'
    : '✓ 영상 저장 완료. 카카오톡/인스타그램을 직접 열어 채팅방 → + 버튼 → 갤러리에서 방금 저장된 영상을 선택해주세요.';

  return { kind: 'fallback', message: msg, downloaded, captionCopied };
}

// ─── shareInvite ───────────────────────────────────────────────────────

export async function shareInvite(opts: ShareInviteOpts): Promise<ShareResult> {
  const { slug, fromName, templateName, score, thumbnailUrl: _thumb, message } = opts;
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

  // 2) URL-only Web Share.
  // FIX-INVITE-E2E (2026-04-23): 이전엔 `await copyToClipboard(caption)` 을 share 전에
  //   호출해 iOS Safari 의 user-gesture 체인이 깨져 navigator.share 가 NotAllowedError
  //   를 던지는 사례가 있었다. 또 최종 메시지가 "✓ 링크 복사됨" 으로 표면화돼
  //   사용자 입장에서는 "버튼을 눌렀는데 공유창이 안 뜬다" 는 버그로 보인다.
  //   지금은: (a) Kakao 등 in-app 브라우저가 아니면 **무조건** navigator.share 를
  //   먼저 시도, (b) 모든 "복사됨" 문구 제거, (c) 실패 시 clipboard 는 **조용한
  //   편의 기능** 으로만 돌리고 토스트는 "공유 실패 — 메신저 앱을 직접 열어주세요".
  //
  // 카카오톡/라인 등 메신저는 URL 만 받으면 `/share/challenge/<slug>` 의 OG meta
  // 를 크롤해 리치 썸네일 카드를 자동 렌더한다 (commit 83005bb). file 은 일절
  // 넘기지 않는다 — file 이 있으면 수신 메신저가 text/url 을 드롭한다.
  const hasNavShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  if (hasNavShare && !env.inAppBrowser) {
    try {
      log('invite.url.share.attempt', { url });
      await (navigator as any).share({
        title: `${templateName} 도전장`,
        // url 을 text 안에도 inline — 일부 메신저(구버전 라인 등)는 url 필드를
        // 드롭해도 text 는 유지하므로 안전망.
        text: `${shortCaption}\n\n${url}`,
        url,
      });
      log('result.web-share-text');
      return {
        kind: 'web-share-text',
        message: '도전장을 보냈어요!',
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        log('invite.share.cancelled');
        return {
          kind: 'cancelled',
          message: '공유가 취소됐어요.',
        };
      }
      log('invite.url.share.fail', e);
      // Silently copy URL to clipboard as a convenience for the user, but do
      // NOT surface it as the primary outcome — that was the original bug.
      try { await copyToClipboard(url); } catch {}
      return {
        kind: 'error',
        message: '공유 실패 — 메신저 앱을 직접 열어 도전장을 붙여넣어주세요.',
        error: e,
      };
    }
  }

  // Kakao/Line/Instagram in-app browser: Web Share is broken-by-platform.
  // Silently stage clipboard, but tell user exactly what to do — no "복사됨" copy.
  if (env.inAppBrowser) {
    try { await copyToClipboard(url); } catch {}
    return {
      kind: 'fallback',
      message: '인앱 브라우저에서는 공유창이 뜨지 않아요. 우상단 ⋯ → 다른 브라우저로 열기 후 다시 시도해주세요.',
    };
  }

  // Desktop / browser without Web Share API — clipboard copy + clear instruction.
  // FIX-SHARE-NO-REDIRECT (2026-04-24): 이전엔 `window.location.href = sms:?body=…`
  //   로 문자 앱을 열었으나 일부 Android 브라우저에서 이 스킴이 잘못된 https 페이지
  //   (예: 통신사 안내·마케팅 페이지) 로 리다이렉트되는 사례가 보고됨. 어떤 경우에도
  //   현재 페이지를 이탈시키는 스킴 이동은 하지 않는다.
  const copied = await copyToClipboard(url);
  return {
    kind: copied ? 'fallback' : 'unsupported',
    message: copied
      ? '✓ 링크가 복사됐어요. 카카오톡/문자/메일 등 원하는 앱에 직접 붙여넣어주세요.'
      : '공유 API 와 클립보드 모두 실패했어요. 브라우저 권한을 확인하고 다시 시도해주세요.',
    captionCopied: copied,
  };
}

// ─── sharePlatform — 특정 앱(카톡/인스타/틱톡/유튜브)으로 직행 ─────────
//
// 사용자 요청: "인스타, 유튜브, 틱톡 업로드 버튼도 넣어줘".
// Web 에서 외부 앱에 video 를 직접 첨부하는 표준 API 는 없다. 현실적인 최선:
//   1) 파일을 기기 저장
//   2) 캡션을 클립보드에 복사
//   3) 타겟 앱 딥링크 오픈 (Android intent URI / iOS custom scheme)
//   4) 사용자가 해당 앱의 "최근 영상"/"갤러리" 에서 방금 저장된 영상 선택
//
// 어떤 플랫폼도 "업로드 화면 + 파일 자동 첨부" 까지는 불가. 토스트로 명확히 안내.

export type TargetPlatform = 'kakao' | 'instagram-story' | 'instagram-feed' | 'tiktok' | 'youtube';

// FIX-SHARE-CAMERA-FINAL (2026-04-24): 모든 https 폴백 · OS 스킴 호출 제거.
//   이전에는 intent://…S.browser_fallback_url=https%3A%2F%2Fm.kakao.com 처럼
//   앱이 설치되지 않았거나 intent 가 인식되지 않을 때 **카카오 가입/마케팅
//   페이지**로 튕기는 문제가 있었다. iOS setTimeout 웹 폴백도 동일.
//   딥링크가 카톡 채팅창으로 정확히 떨어진다는 보장이 없는 한 어떤 스킴도
//   호출하지 않는다. 사용자가 직접 앱을 열어 갤러리에서 선택하도록 안내.
function openDeepLinkFor(_platform: TargetPlatform): void {
  // No-op. Platform buttons only save the file + copy caption + show guidance toast.
  // DO NOT reintroduce https/scheme navigation — any fallback risks landing on
  // a marketing/signup page (kakaocorp, m.kakao, etc.), which users cannot
  // distinguish from a crash.
}

const PLATFORM_TOAST: Record<TargetPlatform, string> = {
  'kakao':
    '✓ 영상 저장 완료. 카카오톡을 직접 열어 채팅방 → + 버튼 → 갤러리에서 방금 저장된 영상을 선택해주세요.',
  'instagram-story':
    '✓ 영상 저장 완료. 인스타그램을 열어 스토리 → 갤러리에서 방금 저장된 영상을 선택해주세요.',
  'instagram-feed':
    '✓ 영상 저장 완료. 인스타그램을 열어 + 버튼 → 게시물 → 갤러리에서 방금 저장된 영상을 선택해주세요.',
  'tiktok':
    '✓ 영상 저장 완료. 틱톡을 열어 + 버튼 → 갤러리에서 방금 저장된 영상을 선택해주세요.',
  'youtube':
    '✓ 영상 저장 완료. 유튜브 앱을 열어 + 버튼 → 쇼츠/동영상 → 갤러리에서 방금 저장된 영상을 선택해주세요.',
};

export async function sharePlatform(opts: {
  file: File;
  caption: string;
  platform: TargetPlatform;
}): Promise<ShareResult> {
  const { file, caption, platform } = opts;
  log('platform.start', { platform, size: file?.size });

  if (!file || file.size < 10 * 1024) {
    return { kind: 'unsupported', message: '영상 파일이 준비되지 않았어요.' };
  }

  const downloaded = saveBlobToDevice(file);
  const captionCopied = caption ? await copyToClipboard(caption) : false;

  if (!downloaded) {
    return {
      kind: 'error',
      message: '영상 저장에 실패했어요. 브라우저 다운로드 권한을 확인해주세요.',
      downloaded, captionCopied,
    };
  }

  // Deep link must be called in the same task as the tap for iOS.
  // saveBlobToDevice is synchronous, copyToClipboard we already awaited,
  // so this still runs from inside the user-gesture callback chain.
  openDeepLinkFor(platform);

  return {
    kind: 'fallback',
    message: PLATFORM_TOAST[platform],
    downloaded, captionCopied,
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
