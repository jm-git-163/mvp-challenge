/**
 * utils/share.platform.test.ts
 *
 * Verifies sharePlatform() preserves the user-gesture chain:
 *   - On environments where canShare({files}) is true, navigator.share is
 *     called BEFORE any await (download/clipboard). Old bug: clipboard await
 *     came first and consumed the iOS user-activation token.
 *   - On environments without Web Share Level 2 (desktop), window.open is
 *     called synchronously for the platform's upload URL.
 *   - Toast (ShareResult.kind/message) is honest about what happened
 *     (web-share / cancelled / fallback / error).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the inviteShareCard side import so share.ts doesn't try to load DOM bits.
vi.mock('./inviteShareCard', () => ({
  isInAppBrowserWithBrokenShare: () => false,
}));
vi.mock('./inviteLinks', () => ({
  buildInviteUrl: () => 'https://example/invite',
  buildInviteShareCaption: () => 'caption',
  buildInviteShortCaption: () => 'short',
}));
vi.mock('./shareVideo', () => ({
  blobToShareFile: (blob: Blob, name: string) =>
    new File([blob], `${name}.mp4`, { type: 'video/mp4' }),
}));

function makeFile(size = 50 * 1024) {
  const buf = new Uint8Array(size);
  return new File([buf], 'clip.mp4', { type: 'video/mp4' });
}

function setupAndroidWebShare() {
  // Order matters: log call sites in real order to catch gesture-chain breakage.
  const callOrder: string[] = [];
  const shareSpy = vi.fn(() => {
    callOrder.push('navigator.share');
    return Promise.resolve();
  });
  const writeTextSpy = vi.fn(async () => {
    callOrder.push('clipboard.writeText');
  });
  const openSpy = vi.fn(() => {
    callOrder.push('window.open');
    return {} as any;
  });
  const clickSpy = vi.fn(() => {
    callOrder.push('anchor.click');
  });

  // Minimal DOM
  (globalThis as any).document = {
    createElement: () => ({
      click: clickSpy,
      style: {},
      set href(_v: string) {},
      set download(_v: string) {},
      set rel(_v: string) {},
    }),
    body: { appendChild: () => {}, removeChild: () => {} },
    execCommand: () => true,
  };
  (globalThis as any).URL.createObjectURL = () => 'blob:mock';
  (globalThis as any).URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'window', { value: { open: openSpy }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/120',
      share: shareSpy,
      canShare: () => true,
      clipboard: { writeText: writeTextSpy },
    },
    configurable: true,
    writable: true,
  });
  return { callOrder, shareSpy, writeTextSpy, openSpy, clickSpy };
}

function setupDesktopChrome() {
  const callOrder: string[] = [];
  const openSpy = vi.fn(() => {
    callOrder.push('window.open');
    return {} as any;
  });
  const writeTextSpy = vi.fn(async () => {
    callOrder.push('clipboard.writeText');
  });
  const clickSpy = vi.fn(() => {
    callOrder.push('anchor.click');
  });
  (globalThis as any).document = {
    createElement: () => ({
      click: clickSpy, style: {},
      set href(_v: string) {}, set download(_v: string) {}, set rel(_v: string) {},
    }),
    body: { appendChild: () => {}, removeChild: () => {} },
    execCommand: () => true,
  };
  (globalThis as any).URL.createObjectURL = () => 'blob:mock';
  (globalThis as any).URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'window', { value: { open: openSpy }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Windows NT 10) Chrome/120',
      // No navigator.share on desktop chrome (true at time of writing for files)
      clipboard: { writeText: writeTextSpy },
    },
    configurable: true,
    writable: true,
  });
  return { callOrder, openSpy, writeTextSpy, clickSpy };
}

describe('sharePlatform — user-gesture chain', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('Android Chrome: calls navigator.share BEFORE any await (download/clipboard)', async () => {
    const env = setupAndroidWebShare();
    const { sharePlatform } = await import('./share');
    const file = makeFile();
    const res = await sharePlatform({ file, caption: 'hi', platform: 'kakao' });

    expect(env.shareSpy).toHaveBeenCalledTimes(1);
    expect(env.shareSpy).toHaveBeenCalledWith({ files: [file] });
    // Critical: share must be the very first synchronous side-effect.
    // It MUST come before clipboard.writeText (which would await earlier and
    // break the iOS user-activation chain).
    expect(env.callOrder[0]).toBe('navigator.share');
    expect(env.callOrder).toContain('anchor.click');
    expect(env.callOrder.indexOf('navigator.share')).toBeLessThan(
      env.callOrder.indexOf('clipboard.writeText'),
    );

    expect(res.kind).toBe('web-share');
    expect(res.downloaded).toBe(true);
  });

  it('Android Chrome: AbortError surfaces as cancelled (not fake success)', async () => {
    const env = setupAndroidWebShare();
    env.shareSpy.mockImplementationOnce(() => {
      const e = new Error('cancel');
      (e as any).name = 'AbortError';
      return Promise.reject(e);
    });
    const { sharePlatform } = await import('./share');
    const res = await sharePlatform({
      file: makeFile(), caption: 'hi', platform: 'tiktok',
    });
    expect(res.kind).toBe('cancelled');
  });

  it('Desktop Chrome: opens platform upload URL synchronously in new tab', async () => {
    const env = setupDesktopChrome();
    const { sharePlatform } = await import('./share');
    const res = await sharePlatform({
      file: makeFile(), caption: 'hi', platform: 'tiktok',
    });
    expect(env.openSpy).toHaveBeenCalledTimes(1);
    expect(env.openSpy.mock.calls[0][0]).toBe('https://www.tiktok.com/upload');
    // window.open must come before clipboard await (popup blocker).
    expect(env.callOrder[0]).toBe('window.open');
    expect(res.kind).toBe('fallback');
    expect(res.downloaded).toBe(true);
  });

  it('Desktop Chrome / kakao (no upload URL): degrades to download-only fallback toast', async () => {
    const env = setupDesktopChrome();
    const { sharePlatform } = await import('./share');
    const res = await sharePlatform({
      file: makeFile(), caption: 'hi', platform: 'kakao',
    });
    expect(env.openSpy).not.toHaveBeenCalled();
    expect(res.kind).toBe('fallback');
    expect(res.downloaded).toBe(true);
    expect(res.message).toContain('카카오톡');
  });

  it('Desktop Chrome: youtube upload URL', async () => {
    const env = setupDesktopChrome();
    const { sharePlatform } = await import('./share');
    await sharePlatform({ file: makeFile(), caption: 'hi', platform: 'youtube' });
    expect(env.openSpy.mock.calls[0][0]).toBe('https://www.youtube.com/upload');
  });

  it('rejects undersized file before touching share/download', async () => {
    setupDesktopChrome();
    const { sharePlatform } = await import('./share');
    const tinyFile = new File([new Uint8Array(100)], 'x.mp4', { type: 'video/mp4' });
    const res = await sharePlatform({ file: tinyFile, caption: '', platform: 'kakao' });
    expect(res.kind).toBe('unsupported');
  });
});
