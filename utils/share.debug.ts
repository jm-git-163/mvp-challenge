/**
 * utils/share.debug.ts
 *
 * **User-visible diagnostic shim for share failures.**
 *
 * Problem: commits fb5372d / 6ac3a42 / 9cf1aad all claimed to fix the "share
 * button does nothing" bug and the user still reports it. Since we cannot
 * reproduce on desktop and the user cannot give us a stack trace from their
 * phone, we build a pure-JSON diagnostic that:
 *
 *   1. Detects the exact Web Share API support level of the current device.
 *   2. Reports File MIME / size / prepared-ness against canShare rules.
 *   3. Detects in-app browser signatures (Kakao, Instagram, Facebook, Line).
 *   4. Returns a JSON object the user can screenshot or copy to clipboard
 *      and paste back. No upload, no network, 100% client-side (CLAUDE.md §12).
 *
 * Callers: `/debug/share` screen + ShareSheet error banner "에러 복사" button.
 */

export interface ShareDiagnostic {
  /* Timestamp + userAgent so we can correlate screenshots to commits. */
  timestamp: string;
  userAgent: string;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  secureContext: boolean;

  /* File introspection. null when diagnoseShare(null) invoked before compose. */
  file: {
    present: boolean;
    name: string | null;
    size: number | null;
    mime: string | null;
    isBlob: boolean;
    tooSmall: boolean;       // < 10KB → recorder produced empty
    tooLarge: boolean;       // > 500MB → some devices reject
    ext: 'mp4' | 'webm' | 'mov' | 'unknown';
  };

  /* Web Share API capability matrix. */
  api: {
    hasShare: boolean;
    hasCanShare: boolean;
    canShareText: boolean;         // navigator.canShare({ text })
    canShareUrl: boolean;          // navigator.canShare({ url })
    canShareFiles: boolean | null; // null when no file given
    canShareFilesReason: string;   // human-readable why it is true/false
  };

  /* In-app browser detection. Each is a raw UA match — sticky signatures
     (e.g. "kakao" anywhere in UA) are NOT counted as in-app unless the full
     token matches. */
  inApp: {
    kakao: boolean;
    instagram: boolean;
    facebook: boolean;
    line: boolean;
    naver: boolean;
    detected: boolean;             // any of the above
  };

  /* Clipboard capability. */
  clipboard: {
    hasWriteText: boolean;
    hasExecCommandFallback: boolean;
  };

  /* Popup blocker heuristic — we can't test without actually opening a popup,
     but we can at least report the cross-origin opener policy. */
  popups: {
    uploadUrlsSupported: Record<'youtube' | 'tiktok' | 'instagram' | 'kakao', string>;
  };

  /* Any thrown errors during diagnosis — should be rare but important. */
  errors: string[];
}

/**
 * Build a diagnostic snapshot. Pure function. Accepts null so the /debug/share
 * page can render even before a test file is built.
 */
export function diagnoseShare(file: File | null): ShareDiagnostic {
  const errors: string[] = [];
  const nav = (typeof navigator !== 'undefined' ? (navigator as any) : null);
  const ua = (nav?.userAgent as string) || '';
  const uaLower = ua.toLowerCase();

  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  const platform: ShareDiagnostic['platform'] =
    ios ? 'ios' : android ? 'android' : (ua ? 'desktop' : 'unknown');

  // ── File introspection ────────────────────────────────────────────────
  const hasFile = !!(file && typeof (file as any).size === 'number');
  const mime = hasFile ? ((file!.type || '') || null) : null;
  const size = hasFile ? file!.size : null;
  let ext: ShareDiagnostic['file']['ext'] = 'unknown';
  if (hasFile) {
    const n = (file!.name || '').toLowerCase();
    if (/\.mp4$/.test(n) || /mp4/.test(mime || '')) ext = 'mp4';
    else if (/\.webm$/.test(n) || /webm/.test(mime || '')) ext = 'webm';
    else if (/\.mov$/.test(n) || /quicktime/.test(mime || '')) ext = 'mov';
  }

  // ── Web Share API matrix ──────────────────────────────────────────────
  const hasShare = !!nav && typeof nav.share === 'function';
  const hasCanShare = !!nav && typeof nav.canShare === 'function';

  let canShareText = false;
  let canShareUrl = false;
  try {
    if (hasCanShare) canShareText = !!nav.canShare({ text: 'test' });
  } catch (e: any) { errors.push(`canShare({text}) threw: ${e?.message || e}`); }
  try {
    if (hasCanShare) canShareUrl = !!nav.canShare({ url: 'https://example.com' });
  } catch (e: any) { errors.push(`canShare({url}) threw: ${e?.message || e}`); }

  let canShareFiles: boolean | null = null;
  let canShareFilesReason = 'no file provided';
  if (hasFile) {
    if (!hasShare) {
      canShareFiles = false;
      canShareFilesReason = 'navigator.share is not a function (Web Share API missing)';
    } else if (!hasCanShare) {
      canShareFiles = false;
      canShareFilesReason = 'navigator.canShare is not a function (Web Share Level 2 missing — likely desktop or older iOS)';
    } else if (ios && ext === 'webm') {
      canShareFiles = false;
      canShareFilesReason = 'iOS Safari refuses webm; need mp4 or mov';
    } else {
      try {
        canShareFiles = !!nav.canShare({ files: [file] });
        canShareFilesReason = canShareFiles
          ? `OK — canShare({files:[${ext}]}) returned true`
          : `canShare({files}) returned false (likely MIME "${mime}" not whitelisted on this browser)`;
      } catch (e: any) {
        canShareFiles = false;
        canShareFilesReason = `canShare({files}) threw: ${e?.message || e}`;
      }
    }
  }

  // ── In-app browser detection — full-token matches only to avoid stickiness.
  const kakao = /kakaotalk/.test(uaLower);
  const instagram = /instagram/.test(uaLower);
  // FB in-app: "FBAN" or "FBAV" or "fb_iab" token only. Plain "facebook.com" does not count.
  const facebook = /\bfban\b|\bfbav\b|fb_iab/.test(uaLower);
  const line = /\bline\//.test(uaLower);          // Line in-app has "Line/" version token
  const naver = /naver\(inapp|naver\/inapp/.test(uaLower);

  // ── Clipboard ─────────────────────────────────────────────────────────
  const hasWriteText = !!(nav?.clipboard && typeof nav.clipboard.writeText === 'function');
  const hasExecCommandFallback =
    typeof document !== 'undefined' && typeof (document as any).execCommand === 'function';

  return {
    timestamp: new Date().toISOString(),
    userAgent: ua,
    platform,
    secureContext: typeof window !== 'undefined' && !!(window as any).isSecureContext,
    file: {
      present: hasFile,
      name: hasFile ? file!.name : null,
      size,
      mime,
      isBlob: hasFile && file instanceof Blob,
      tooSmall: hasFile ? file!.size < 10 * 1024 : false,
      tooLarge: hasFile ? file!.size > 500 * 1024 * 1024 : false,
      ext,
    },
    api: {
      hasShare,
      hasCanShare,
      canShareText,
      canShareUrl,
      canShareFiles,
      canShareFilesReason,
    },
    inApp: {
      kakao, instagram, facebook, line, naver,
      detected: kakao || instagram || facebook || line || naver,
    },
    clipboard: {
      hasWriteText,
      hasExecCommandFallback,
    },
    popups: {
      uploadUrlsSupported: {
        youtube: 'https://www.youtube.com/upload',
        tiktok: 'https://www.tiktok.com/upload',
        instagram: 'https://www.instagram.com/',
        kakao: '(no web upload — mobile app only)',
      },
    },
    errors,
  };
}

/**
 * Probe a blob/file for playback metadata. Loads it into a hidden <video> and
 * reports duration + dimensions. Used by /debug/share to diagnose "Kakao hangs
 * mid-send" — MediaRecorder output often has duration=Infinity because the
 * container's duration box is written after recording starts. Most apps handle
 * this; some (Kakao over cellular) hang on it.
 *
 * Returns a plain object — safe to JSON.stringify and copy.
 */
export interface BlobMetadata {
  ok: boolean;
  duration: number | null;        // seconds; Infinity/NaN → null
  durationRaw: string;            // stringified raw value for inspection
  durationBroken: boolean;        // true if Infinity/NaN/<=0
  videoWidth: number | null;
  videoHeight: number | null;
  seekable: boolean;              // can we seek to end? (faststart proxy)
  elapsedMs: number;
  error: string | null;
}

export function probeBlobMetadata(blob: Blob, timeoutMs = 3500): Promise<BlobMetadata> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const base: BlobMetadata = {
      ok: false,
      duration: null,
      durationRaw: 'n/a',
      durationBroken: false,
      videoWidth: null,
      videoHeight: null,
      seekable: false,
      elapsedMs: 0,
      error: null,
    };
    if (typeof document === 'undefined') {
      resolve({ ...base, error: 'no document (SSR/RN)' });
      return;
    }
    let url: string;
    try { url = URL.createObjectURL(blob); } catch (e: any) {
      resolve({ ...base, error: `createObjectURL: ${e?.message || e}`, elapsedMs: Date.now() - t0 });
      return;
    }
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.playsInline = true;
    v.style.position = 'fixed';
    v.style.left = '-9999px';
    let settled = false;
    const cleanup = () => {
      try { v.remove(); } catch {}
      try { URL.revokeObjectURL(url); } catch {}
    };
    const done = (m: BlobMetadata) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ...m, elapsedMs: Date.now() - t0 });
    };
    v.onloadedmetadata = () => {
      const d = v.duration;
      const raw = String(d);
      const broken = !isFinite(d) || isNaN(d) || d <= 0;
      done({
        ok: true,
        duration: broken ? null : d,
        durationRaw: raw,
        durationBroken: broken,
        videoWidth: v.videoWidth || null,
        videoHeight: v.videoHeight || null,
        seekable: v.seekable?.length > 0,
        elapsedMs: 0,
        error: null,
      });
    };
    v.onerror = () => {
      done({ ...base, error: `video element error code=${(v.error?.code ?? 'n/a')}` });
    };
    setTimeout(() => done({ ...base, error: `timeout ${timeoutMs}ms` }), timeoutMs);
    document.body.appendChild(v);
    v.src = url;
  });
}

/**
 * Human-readable file-size-warning for Kakao. Kakao tolerates ~300MB in chat
 * but cellular uploads stall above ~50MB. Returns a Korean toast line or null.
 */
export function kakaoSizeWarning(bytes: number): string | null {
  const mb = bytes / (1024 * 1024);
  if (mb > 300) {
    return `영상이 ${mb.toFixed(0)}MB 로 너무 큽니다. 카톡 전송 실패 가능성이 높아요 — 다시 짧게 촬영해주세요.`;
  }
  if (mb > 50) {
    return `영상이 ${mb.toFixed(0)}MB 입니다. 카톡 전송이 느리거나 중간에 멈출 수 있어요 — WiFi 사용을 권장합니다.`;
  }
  return null;
}

/**
 * One-line summary for toasts. Caller appends raw JSON via a copy button.
 */
export function summarizeDiagnostic(d: ShareDiagnostic): string {
  const flags: string[] = [];
  flags.push(`파일:${d.file.present ? 'YES' : 'NO'}`);
  if (d.file.present) {
    // FIX-KAKAO-MP4 (2026-04-24): 실제 blob MIME 을 toast 요약에 노출. Kakao 는
    //   webm 을 거부하고 Play Store 로 튕기기 때문에, 사용자가 "왜 안되는지"
    //   눈으로 확인할 수 있어야 함.
    flags.push(`(${d.file.ext}/${Math.round((d.file.size || 0) / 1024)}KB)`);
    flags.push(`MIME:${d.file.mime || 'unknown'}`);
  }
  flags.push(`canShare:${d.api.canShareFiles === null ? '-' : d.api.canShareFiles ? 'YES' : 'NO'}`);
  flags.push(`플랫폼:${d.platform}`);
  if (d.inApp.detected) {
    const which = [
      d.inApp.kakao && 'kakao',
      d.inApp.instagram && 'instagram',
      d.inApp.facebook && 'facebook',
      d.inApp.line && 'line',
      d.inApp.naver && 'naver',
    ].filter(Boolean).join('+');
    flags.push(`인앱:${which}`);
  }
  // FIX-KAKAO-MP4: webm 안내 힌트. 사용자에게 왜 Kakao 가 실패했는지 설명.
  if (d.file.present && d.file.ext === 'webm') {
    flags.push('⚠ webm — 카카오톡이 거부해요. 다운로드된 영상을 앱에서 직접 첨부해주세요.');
  }
  return flags.join(' · ');
}
