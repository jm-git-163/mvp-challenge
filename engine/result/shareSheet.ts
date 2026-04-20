/**
 * engine/result/shareSheet.ts
 *
 * Phase 7 — 결과 공유 & 다운로드.
 *
 * 우선순위:
 *   1. navigator.share (모바일 기본)
 *   2. 파일 다운로드 (a[download])
 *   3. 클립보드에 URL 복사 (최후)
 *
 * FORBIDDEN: 외부 업로드·외부 URL 접근 전무 — 전부 로컬 Blob.
 */

export interface ShareInput {
  title: string;
  text: string;
  blob: Blob;
  filename: string;  // e.g. "motiq_20260420.mp4"
}

export type ShareOutcome =
  | { kind: 'shared' }          // navigator.share 성공
  | { kind: 'downloaded' }      // 파일 다운로드 진행
  | { kind: 'copied' }          // URL 클립보드 복사
  | { kind: 'cancelled' }       // 사용자 취소
  | { kind: 'failed'; reason: string };

export interface ShareDeps {
  /** navigator.share 래퍼. */
  share?: ((data: { title: string; text: string; files: File[] }) => Promise<void>) | null;
  /** canShare 래퍼. files 포함 공유 가능한지. */
  canShareFiles?: ((files: File[]) => boolean) | null;
  /** 클립보드에 문자열 쓰기. */
  writeText?: ((s: string) => Promise<void>) | null;
  /** a[download] 강제 클릭으로 파일 저장. */
  triggerDownload?: ((url: string, filename: string) => void) | null;
  /** Blob → 임시 URL. 기본 URL.createObjectURL. */
  createObjectURL?: (b: Blob) => string;
  /** URL 해제. */
  revokeObjectURL?: (u: string) => void;
}

export async function shareResult(input: ShareInput, deps: ShareDeps = {}): Promise<ShareOutcome> {
  const file = new File([input.blob], input.filename, { type: input.blob.type || 'video/mp4' });

  // 1. Web Share API
  const share = deps.share !== undefined ? deps.share : resolveBrowserShare();
  const canShareFiles = deps.canShareFiles !== undefined ? deps.canShareFiles : resolveBrowserCanShare();
  if (share && canShareFiles?.([file])) {
    try {
      await share({ title: input.title, text: input.text, files: [file] });
      return { kind: 'shared' };
    } catch (err) {
      if (isAbortError(err)) return { kind: 'cancelled' };
      // fall through to download
    }
  }

  // 2. 파일 다운로드
  const makeURL = deps.createObjectURL ?? ((b: Blob) => URL.createObjectURL(b));
  const revoke = deps.revokeObjectURL ?? ((u: string) => URL.revokeObjectURL(u));
  const trigger = deps.triggerDownload ?? browserTriggerDownload;
  try {
    const url = makeURL(input.blob);
    trigger(url, input.filename);
    // 안전하게 revoke (즉시 하면 다운로드 전에 해제될 수 있어 10s 뒤)
    setTimeout(() => revoke(url), 10_000);
    return { kind: 'downloaded' };
  } catch (err) {
    // 3. 클립보드 폴백 (메타 정보만)
    const write = deps.writeText !== undefined ? deps.writeText : resolveBrowserClipboard();
    if (write) {
      try {
        await write(`${input.title}\n${input.text}`);
        return { kind: 'copied' };
      } catch { /* ignore */ }
    }
    return { kind: 'failed', reason: err instanceof Error ? err.message : 'unknown' };
  }
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError';
}

function browserTriggerDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') throw new Error('SSR');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function resolveBrowserShare(): ShareDeps['share'] {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof n.share !== 'function') return null;
  return (data) => n.share!({ title: data.title, text: data.text, files: data.files });
}

function resolveBrowserCanShare(): ShareDeps['canShareFiles'] {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof n.canShare !== 'function') return null;
  return (files) => {
    try { return n.canShare!({ files }); } catch { return false; }
  };
}

function resolveBrowserClipboard(): ShareDeps['writeText'] {
  if (typeof navigator === 'undefined') return null;
  const c = navigator.clipboard;
  if (!c || typeof c.writeText !== 'function') return null;
  return (s) => c.writeText(s);
}

/** 결과 파일 이름 생성 — 결정적(테스트 가능). */
export function makeResultFilename(templateId: string, nowMs: number, ext = 'mp4'): string {
  const d = new Date(nowMs);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const ts = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const safe = templateId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  return `motiq_${safe}_${ts}.${ext}`;
}
