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
import { kakaoSizeWarning } from './share.debug';
import { fixBlobDuration, probeBlobDuration } from './fixBlobDuration';

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
    // FIX-KAKAO-HANG (2026-04-24, v5): MediaRecorder WebM blobs ship with
    //   `Duration=0` or the field absent. KakaoTalk's uploader hangs mid-send
    //   when validating those — it's the single most common cause behind the
    //   user's "친구 골라 보내기 눌렀는데 끝나지 않음" report. We patch the
    //   EBML Duration element before the blob is ever shared. No-op for mp4
    //   (Chrome 110+ writes correct mvhd duration) and for already-valid webm.
    let patched = blob;
    try {
      const probed = await probeBlobDuration(blob, 3500);
      if (probed && isFinite(probed) && probed > 0) {
        patched = await fixBlobDuration(blob, probed * 1000);
        log('prepare.duration', { seconds: probed, patched: patched !== blob });
      } else {
        log('prepare.duration.unknown', 'probe-failed-or-infinite');
      }
    } catch (e) { log('prepare.duration.error', e); }

    const file = blobToShareFile(patched, name);
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

  // FIX-KAKAO-HANG (2026-04-24, v5): >50MB advisory for ANY share path, not
  //   just sharePlatform('kakao'). When the user picks Kakao from the OS
  //   share sheet (Path A below), we have no way to interpose, but we can at
  //   least pre-warn so they pick Wi-Fi.
  const sizeWarn = kakaoSizeWarning(file.size);
  if (sizeWarn) log('video.size-warning', sizeWarn);

  // Path A: Web Share with files — iOS + Android.
  // FIX-SHARE-SHEET (2026-04-24, v3): 이전엔 iOS 만 files 경로를 탔기 때문에
  //   Android 사용자는 "SNS 전송 누르면 다운만 되고 공유창이 안 열린다" 를 보았음.
  //   files-only share 는 Android Chrome 에서도 OS 공유시트를 정상 오픈한다 —
  //   `text` 에 URL 을 끼워넣을 때만 Play Store redirect 가 발생하므로 text 없이
  //   files 만 전달해 해당 회귀 재발 방지.
  if (env.canShareFiles(file)) {
    try {
      log('attempt.websrc.files', { name: file.name, ua: env.ios ? 'ios' : env.android ? 'android' : 'other' });
      // FIX-VIDEO-SHARE-HANG (2026-05-01): 동일한 hang 보고가 video 경로에서도 발생.
      //   60초 타임아웃 — video 는 invite text 보다 업로드 시간이 길 수 있어 더 관대.
      const sharePromise: Promise<void> = (navigator as any).share({ files: [file] });
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 60000));
      const winner = await Promise.race([sharePromise.then(() => 'ok' as const), timeout]);
      if (winner === 'timeout') {
        log('attempt.websrc.files.timeout');
        // Fall through to download fallback below — download still useful even
        // though share is stuck.
        throw new Error('share-timeout');
      }
      log('result.web-share', 'ok');
      // 캡션은 클립보드로 조용히 넘겨, 사용자가 공유 시트에서 앱 선택 후 붙여넣기 가능.
      if (caption) { try { await copyToClipboard(caption); } catch {} }
      const okMsg = sizeWarn
        ? `공유 시작됨\n\n⚠ ${sizeWarn}`
        : '공유 시작됨';
      return { kind: 'web-share', message: okMsg };
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
      // FIX-INVITE-HANG (2026-05-01): 사용자 보고 "친구 선택 후 전송이 끝나지 않음".
      //   Android 11+ 의 일부 OEM 공유 시트가 KakaoTalk 선택 → "친구 골라 전송" 후
      //   navigator.share Promise 를 resolve 도 reject 도 하지 않고 영구 hang.
      //   45초 타임아웃 후 사용자에게 피드백 + 클립보드 폴백.
      const sharePromise: Promise<void> = (navigator as any).share({
        title: `${templateName} 도전장`,
        // url 을 text 안에도 inline — 일부 메신저(구버전 라인 등)는 url 필드를
        // 드롭해도 text 는 유지하므로 안전망.
        text: `${shortCaption}\n\n${url}`,
        url,
      });
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 45000));
      const winner = await Promise.race([sharePromise.then(() => 'ok' as const), timeout]);
      if (winner === 'timeout') {
        log('invite.url.share.timeout', { url });
        try { await copyToClipboard(url); } catch {}
        return {
          kind: 'fallback',
          message: '공유 시트가 응답하지 않아요 (45초 초과). 링크를 복사해뒀으니 카카오톡 채팅방에 직접 붙여넣어주세요.',
        };
      }
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

// FIX-SHARE-HONEST (2026-04-24): 데스크톱 환경(공유 시트 없음)에서 "어디로 올려야 하는지"
//   명확히 안내하기 위해 각 플랫폼 업로드 페이지를 새 탭으로 오픈한다. 현재 페이지는
//   그대로 두고 (window.open), 다운로드된 파일을 사용자가 직접 파일 선택창에서 고르게 함.
//   Instagram 은 공식 웹 업로드 URL 이 없으므로 홈으로 이동 + 토스트로 "모바일 앱을
//   이용해주세요" 안내.
const PLATFORM_UPLOAD_URL: Record<TargetPlatform, string> = {
  'kakao': '',                                            // 카카오: 웹 업로드 없음 (PC앱/모바일 직접 첨부 안내)
  'instagram-story': 'https://www.instagram.com/',
  'instagram-feed': 'https://www.instagram.com/',
  'tiktok': 'https://www.tiktok.com/upload',
  'youtube': 'https://www.youtube.com/upload',
};

const DESKTOP_TOAST: Record<TargetPlatform, string> = {
  'kakao':
    '✓ 영상 저장 완료. 카카오톡 PC/모바일 앱에서 채팅방 → + → 갤러리/파일에서 방금 저장된 영상을 선택해주세요.',
  'instagram-story':
    '✓ 영상 저장 · 인스타그램 새 탭 오픈. 인스타그램 스토리 업로드는 모바일 앱에서만 지원돼요. 저장된 영상을 모바일로 옮긴 뒤 올려주세요.',
  'instagram-feed':
    '✓ 영상 저장 · 인스타그램 새 탭 오픈. 데스크톱 웹에서 + 새 게시물 → 저장된 영상을 선택하세요.',
  'tiktok':
    '✓ 영상 저장 · 틱톡 업로드 페이지 새 탭 오픈. 업로드 창에서 방금 저장된 영상을 선택해주세요.',
  'youtube':
    '✓ 영상 저장 · 유튜브 업로드 페이지 새 탭 오픈. 업로드 창에서 방금 저장된 영상을 선택해주세요.',
};

export async function sharePlatform(opts: {
  file: File;
  caption: string;
  platform: TargetPlatform;
}): Promise<ShareResult> {
  const { file, caption, platform } = opts;
  const env = detectEnv();
  log('platform.start', { platform, size: file?.size, env });

  if (!file || file.size < 10 * 1024) {
    return { kind: 'unsupported', message: '영상 파일이 준비되지 않았어요.' };
  }
  // FIX-SHARE-DIAGNOSTIC (2026-04-24): Web Share API rejects very large files
  //   on some Android devices (~500MB). Guard explicitly so the error surface
  //   is honest rather than a silent fail inside navigator.share.
  if (file.size > 500 * 1024 * 1024) {
    return {
      kind: 'error',
      message: `영상이 너무 커요 (${Math.round(file.size / (1024 * 1024))}MB). 500MB 이하로 다시 촬영해주세요.`,
    };
  }

  // FIX-KAKAO-HANG (2026-04-24): Kakao-specific soft warning for >50MB files.
  //   User reported "업로드가 멈춘다" — most common cause on cellular is the
  //   blob being large enough that KakaoTalk's uploader times out. We don't
  //   block the share — just log and let the toast include the advisory in
  //   the success path.
  const sizeWarning = platform === 'kakao' ? kakaoSizeWarning(file.size) : null;
  if (sizeWarning) log('platform.kakao.size-warning', sizeWarning);

  // FIX-SHARE-HONEST (2026-04-24): "자동 다운로드 + 공유 시트 동시 오픈" 패턴.
  //   사용자 요청: "SNS공유 누르면 자동 다운로드되어 해당 SNS에 파일 전송이 끊김없이
  //   끝까지 이어지면 좋겠어". 순수 웹앱은 YouTube/TikTok/Instagram API 업로드를
  //   할 수 없음 (OAuth+서버 필요, CLAUDE.md §12 금지). 가능한 최선:
  //     1) 무조건 기기에 다운로드 — 사용자가 파일을 반드시 확보 (안전망).
  //     2) navigator.canShare({files}) true → **동시에** navigator.share 호출해
  //        시스템 공유 시트 오픈. 사용자가 카톡/IG/TT/YT 선택 → 첨부된 상태로
  //        해당 앱이 열림 → 사용자가 게시.
  //     3) 데스크톱/공유 시트 미지원 → 플랫폼 업로드 페이지를 새 탭으로 오픈.
  //     4) 토스트로 현재 상황을 명확히 안내.
  //
  //   클립보드는 캡션이 있을 때 조용히 복사 (share 시트나 업로드 페이지에서 붙여넣기용).

  // FIX-SHARE-GESTURE (2026-04-24): user-gesture chain MUST be preserved.
  //   Old code awaited copyToClipboard BEFORE navigator.share — on iOS Safari
  //   that consumes the user activation token and the next navigator.share()
  //   throws NotAllowedError. Worse, share was fire-and-forget so the toast
  //   said "공유 시트 열림" while nothing actually appeared.
  //
  //   New order (all done synchronously inside the click handler that called us):
  //     1) If canShareFiles → call navigator.share({files}) IMMEDIATELY (no await
  //        on anything before it). Capture the Promise and await it after.
  //     2) Else if uploadUrl → window.open(url) IMMEDIATELY (popup blocker also
  //        requires user gesture).
  //     3) Trigger download (synchronous via anchor click).
  //     4) Copy caption to clipboard (async, but gesture no longer needed).
  //     5) Await the share promise → real success/cancel result.

  let sharePromise: Promise<void> | null = null;
  let openedTab = false;
  // FIX-KAKAO-MP4 (2026-04-24): Kakao 는 webm 을 거부하고 Android 공유 시트가
  //   Play Store "카카오톡 설치" 페이지로 튕긴다. 파일 실제 MIME 이 mp4 계열이
  //   아니면 navigator.share 를 아예 우회하고 download + 안내 토스트로 간다.
  const fileMime = (file.type || '').toLowerCase();
  const isMp4 = /mp4|quicktime/.test(fileMime);
  const kakaoNeedsFallback = platform === 'kakao' && !isMp4;
  const supportsFiles = env.canShareFiles(file) && !kakaoNeedsFallback;

  if (supportsFiles) {
    try {
      log('platform.webshare.files.attempt', { platform, name: file.name, ua: env.ios ? 'ios' : env.android ? 'android' : 'other' });
      // Synchronous — preserves user activation. Returns a Promise we await later.
      sharePromise = (navigator as any).share({ files: [file] });
    } catch (e: any) {
      log('platform.webshare.files.sync-fail', e);
      sharePromise = null;
    }
  } else {
    const uploadUrl = PLATFORM_UPLOAD_URL[platform];
    if (uploadUrl && typeof window !== 'undefined') {
      try {
        const w = window.open(uploadUrl, '_blank', 'noopener,noreferrer');
        openedTab = !!w;
        log('platform.upload-url.open', { platform, uploadUrl, opened: openedTab });
      } catch (e) {
        log('platform.upload-url.fail', e);
      }
    }
  }

  // (3) Now do the download — gesture no longer needed for anchor.click().
  const downloaded = saveBlobToDevice(file);
  // (4) Clipboard — fully async, no longer blocking the gesture chain.
  const captionCopied = caption ? await copyToClipboard(caption) : false;
  log('platform.download', { platform, downloaded, captionCopied, supportsFiles, openedTab });

  // (5) Now resolve the share Promise (if any).
  if (sharePromise) {
    try {
      // FIX-PLATFORM-SHARE-HANG (2026-05-01): 일부 OS 공유 시트가 친구 선택 후 hang.
      //   60초 타임아웃 후 download/upload-tab 폴백 안내로 graceful 처리.
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 60000));
      const winner = await Promise.race([sharePromise.then(() => 'ok' as const), timeout]);
      if (winner === 'timeout') {
        log('platform.webshare.timeout', platform);
        return {
          kind: 'fallback',
          message:
            `공유 시트가 응답하지 않았어요 (60초 초과). 영상은 기기에 저장됐으니 ${platformLabel(platform)} 를 직접 열어 갤러리에서 선택해주세요.`,
          downloaded, captionCopied,
        };
      }
      log('platform.webshare.ok', platform);
      return {
        kind: 'web-share',
        message: `✓ ${platformLabel(platform)} 공유 시트 열림 + 영상 저장됨. 시트에서 ${platformLabel(platform)} 를 선택해 게시해주세요.`,
        downloaded, captionCopied,
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        log('platform.webshare.cancelled', platform);
        return {
          kind: 'cancelled',
          message: `공유가 취소됐어요. 영상은 기기에 저장됐어요 (${platformLabel(platform)} 직접 열어 갤러리에서 선택 가능).`,
          downloaded, captionCopied,
        };
      }
      log('platform.webshare.files.fail', e);
      // Fall through to platform toast.
    }
  }

  if (openedTab) {
    return {
      kind: 'fallback',
      message: DESKTOP_TOAST[platform],
      downloaded, captionCopied,
    };
  }

  if (!downloaded) {
    return {
      kind: 'error',
      message: '영상 저장과 공유 모두 실패했어요. 브라우저 권한을 확인해주세요.',
      downloaded, captionCopied,
    };
  }

  openDeepLinkFor(platform); // no-op, intentionally kept.

  // FIX-KAKAO-MP4 (2026-04-24): Kakao + webm 조합은 공유 시트 자체를 우회했으므로
  //   사용자에게 **왜** 직접 첨부해야 하는지 명확히 알린다 (현 기기가 mp4 녹화를
  //   지원하지 않음 → Chrome 업데이트 권장).
  if (kakaoNeedsFallback) {
    return {
      kind: 'fallback',
      message:
        `✓ 영상 저장 완료 (형식: ${fileMime || 'webm'}). 현재 기기에서는 mp4 녹화가 지원되지 않아 ` +
        `카카오톡 자동 공유가 막혀 있어요. 카톡을 직접 열어 채팅방 → + → 갤러리에서 방금 저장된 ` +
        `영상을 선택해주세요. (Chrome 을 최신 버전으로 업데이트하면 다음 녹화부터 자동 공유돼요.)`,
      downloaded, captionCopied,
    };
  }

  return {
    kind: 'fallback',
    message: sizeWarning
      ? `${PLATFORM_TOAST[platform]}\n\n⚠ ${sizeWarning}`
      : PLATFORM_TOAST[platform],
    downloaded, captionCopied,
  };
}

function platformLabel(p: TargetPlatform): string {
  switch (p) {
    case 'kakao': return '카카오톡';
    case 'instagram-story':
    case 'instagram-feed': return '인스타그램';
    case 'tiktok': return '틱톡';
    case 'youtube': return '유튜브';
  }
}

// NOTE: shareReply (답장 보내기) was removed. Without a server there is no
// back-channel to the original sender if they invited from a non-messenger
// environment (e.g. desktop Chrome). Users instead share their completed
// video via shareVideo / sharePlatform, or send a fresh invite via
// shareInvite.
