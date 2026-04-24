/**
 * utils/share.debug.test.ts
 *
 * Verifies the diagnostic shim returns the right shape for common
 * device/browser combinations. The whole point of this module is to be
 * trustworthy when the user pastes its output back to us.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { diagnoseShare, summarizeDiagnostic } from './share.debug';

const ORIGINAL_NAV = (globalThis as any).navigator;
const ORIGINAL_WIN = (globalThis as any).window;

function setNav(nav: any) {
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}
function setWin(win: any) {
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
}

function makeFile(mime: string, name: string, size = 64 * 1024): File {
  return new File([new Uint8Array(size)], name, { type: mime });
}

describe('diagnoseShare', () => {
  afterEach(() => {
    setNav(ORIGINAL_NAV);
    setWin(ORIGINAL_WIN);
  });

  it('iOS Safari rejects webm but accepts mp4', () => {
    setNav({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605',
      share: () => Promise.resolve(),
      canShare: (data: any) => {
        if (data?.files) return !data.files.some((f: File) => /webm/.test(f.type));
        return true;
      },
      clipboard: { writeText: async () => {} },
    });
    setWin({ isSecureContext: true });
    const mp4 = diagnoseShare(makeFile('video/mp4', 'a.mp4'));
    expect(mp4.platform).toBe('ios');
    expect(mp4.api.canShareFiles).toBe(true);
    expect(mp4.file.ext).toBe('mp4');

    const webm = diagnoseShare(makeFile('video/webm', 'a.webm'));
    expect(webm.api.canShareFiles).toBe(false);
    expect(webm.api.canShareFilesReason).toMatch(/webm/i);
  });

  it('desktop Chrome has share but no canShare', () => {
    setNav({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
      // share exists, canShare missing entirely (Web Share Level 1)
      share: () => Promise.resolve(),
      clipboard: { writeText: async () => {} },
    });
    setWin({ isSecureContext: true });
    const d = diagnoseShare(makeFile('video/mp4', 'a.mp4'));
    expect(d.platform).toBe('desktop');
    expect(d.api.hasShare).toBe(true);
    expect(d.api.hasCanShare).toBe(false);
    expect(d.api.canShareFiles).toBe(false);
    expect(d.api.canShareFilesReason).toMatch(/Level 2/);
  });

  it('detects KakaoTalk in-app browser', () => {
    setNav({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 KAKAOTALK 10.5.5',
      share: () => Promise.resolve(),
      canShare: () => true,
    });
    const d = diagnoseShare(null);
    expect(d.inApp.kakao).toBe(true);
    expect(d.inApp.detected).toBe(true);
    expect(d.platform).toBe('android');
  });

  it('does NOT flag in-app for plain Chrome with kakao referrer keyword', () => {
    // Sticky-detection guard: plain UA without explicit "kakaotalk" token is fine.
    setNav({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 (kakao_ver_4)',
      share: () => Promise.resolve(),
      canShare: () => true,
    });
    const d = diagnoseShare(null);
    // "kakao_ver_4" should not trip the kakaotalk-token regex.
    expect(d.inApp.kakao).toBe(false);
  });

  it('flags too-large files', () => {
    setNav({ userAgent: 'X', share: () => {}, canShare: () => true });
    // Plain duck-typed object — Blob's type/size are read-only getters in Node.
    const fakeFile = {
      name: 'huge.mp4', type: 'video/mp4', size: 600 * 1024 * 1024,
    } as unknown as File;
    const d = diagnoseShare(fakeFile);
    expect(d.file.tooLarge).toBe(true);
    expect(d.file.size).toBe(600 * 1024 * 1024);
  });

  it('flags too-small files', () => {
    setNav({ userAgent: 'X', share: () => {}, canShare: () => true });
    const d = diagnoseShare(makeFile('video/mp4', 'tiny.mp4', 1024));
    expect(d.file.tooSmall).toBe(true);
  });

  it('handles missing navigator (SSR)', () => {
    setNav(undefined);
    const d = diagnoseShare(null);
    expect(d.platform).toBe('unknown');
    expect(d.api.hasShare).toBe(false);
    expect(d.api.canShareFiles).toBeNull();
  });
});

describe('summarizeDiagnostic', () => {
  it('produces a one-line summary with key flags', () => {
    setNav({
      userAgent: 'Mozilla/5.0 (iPhone) Safari',
      share: () => {},
      canShare: () => true,
      clipboard: { writeText: async () => {} },
    });
    const d = diagnoseShare(makeFile('video/mp4', 'a.mp4'));
    const s = summarizeDiagnostic(d);
    expect(s).toMatch(/파일:YES/);
    expect(s).toMatch(/canShare:YES/);
    expect(s).toMatch(/플랫폼:ios/);
  });
});
