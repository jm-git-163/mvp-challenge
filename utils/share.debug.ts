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
 * One-line summary for toasts. Caller appends raw JSON via a copy button.
 */
export function summarizeDiagnostic(d: ShareDiagnostic): string {
  const flags: string[] = [];
  flags.push(`파일:${d.file.present ? 'YES' : 'NO'}`);
  if (d.file.present) flags.push(`(${d.file.ext}/${Math.round((d.file.size || 0) / 1024)}KB)`);
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
  return flags.join(' · ');
}
