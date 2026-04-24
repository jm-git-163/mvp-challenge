import { describe, it, expect } from 'vitest';
import {
  runCompatibilityCheck,
  detectIOS,
  selectSupportedMime,
  getBlockers,
  getWarnings,
  MIME_CANDIDATES,
  type CompatCheckDeps,
} from './compatibilityCheck';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const IPHONE_14_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.210 Mobile Safari/537.36';
const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0';
const CHROME_ON_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';

describe('detectIOS', () => {
  it('identifies iOS iPhone Safari with version', () => {
    const r = detectIOS(IPHONE_UA);
    expect(r.isIOS).toBe(true);
    expect(r.isMobileSafari).toBe(true);
    expect(r.iOSVersion).toBeCloseTo(17.02, 2);
  });

  it('parses older iOS correctly', () => {
    const r = detectIOS(IPHONE_14_UA);
    expect(r.isIOS).toBe(true);
    expect(r.iOSVersion).toBeCloseTo(14.03, 2);
  });

  it('Chrome on iOS is NOT Mobile Safari', () => {
    const r = detectIOS(CHROME_ON_IOS_UA);
    expect(r.isIOS).toBe(true);
    expect(r.isMobileSafari).toBe(false);
  });

  it('Android Chrome is not iOS', () => {
    const r = detectIOS(ANDROID_CHROME_UA);
    expect(r.isIOS).toBe(false);
    expect(r.isMobileSafari).toBe(false);
    expect(r.iOSVersion).toBeNull();
  });

  it('Desktop Chrome is not iOS', () => {
    const r = detectIOS(DESKTOP_CHROME_UA);
    expect(r.isIOS).toBe(false);
    expect(r.iOSVersion).toBeNull();
  });
});

describe('selectSupportedMime', () => {
  it('returns null when isTypeSupported missing', () => {
    expect(selectSupportedMime(undefined)).toBeNull();
  });

  it('returns first supported mime', () => {
    const supported = new Set<string>([MIME_CANDIDATES[1], MIME_CANDIDATES[2]]);
    const mime = selectSupportedMime(t => supported.has(t));
    expect(mime).toBe(MIME_CANDIDATES[1]);
  });

  it('prefers mp4 when Safari supports it (iOS)', () => {
    const mime = selectSupportedMime(t => t === MIME_CANDIDATES[0]);
    expect(mime).toBe(MIME_CANDIDATES[0]);
  });

  it('returns null when none supported', () => {
    expect(selectSupportedMime(() => false)).toBeNull();
  });

  it('swallows exceptions from isTypeSupported', () => {
    const mime = selectSupportedMime(t => {
      if (t === MIME_CANDIDATES[0]) throw new Error('boom');
      return t === MIME_CANDIDATES[2];
    });
    expect(mime).toBe(MIME_CANDIDATES[2]);
  });
});

function makeDeps(opts: {
  ua: string;
  hasMediaDevices?: boolean;
  hasMediaRecorder?: boolean;
  supportedMimes?: string[];
  hasWakeLock?: boolean;
  hasSpeech?: 'standard' | 'webkit' | 'none';
  hasPermissions?: boolean;
  hasRVFC?: boolean;
  hasVibrate?: boolean;
}): CompatCheckDeps {
  const supported = new Set(opts.supportedMimes ?? []);
  return {
    navigator: {
      userAgent: opts.ua,
      mediaDevices: opts.hasMediaDevices ? { getUserMedia: () => {} } : undefined,
      permissions: opts.hasPermissions ? { query: () => {} } : undefined,
      wakeLock: opts.hasWakeLock ? { request: () => {} } : undefined,
      vibrate: opts.hasVibrate ? (() => true) : undefined,
    },
    window: {
      MediaRecorder: opts.hasMediaRecorder
        ? { isTypeSupported: (t: string) => supported.has(t) }
        : undefined,
      SpeechRecognition: opts.hasSpeech === 'standard' ? function() {} : undefined,
      webkitSpeechRecognition: opts.hasSpeech === 'webkit' ? function() {} : undefined,
      HTMLVideoElement: opts.hasRVFC
        ? { prototype: { requestVideoFrameCallback: () => {} } }
        : undefined,
    },
  };
}

describe('runCompatibilityCheck', () => {
  it('iPhone 17 Safari: full feature set', () => {
    const deps = makeDeps({
      ua: IPHONE_UA,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      supportedMimes: [MIME_CANDIDATES[0], MIME_CANDIDATES[3]],
      hasWakeLock: true,
      hasSpeech: 'webkit',
      hasPermissions: true,
      hasRVFC: true,
      hasVibrate: false,
    });
    const r = runCompatibilityCheck(deps);
    expect(r.mediaDevices).toBe(true);
    expect(r.mediaRecorder).toBe(true);
    expect(r.mediaRecorderMime).toBe(MIME_CANDIDATES[0]);
    expect(r.wakeLock).toBe('native');
    expect(r.speechRecognition).toBe(true);
    expect(r.permissionsAPI).toBe(true);
    expect(r.requestVideoFrameCallback).toBe(true);
    expect(r.vibrate).toBe(false);
    expect(r.isIOS).toBe(true);
    expect(r.isMobileSafari).toBe(true);
  });

  it('Android Chrome: speech supported via standard, vibrate works', () => {
    const deps = makeDeps({
      ua: ANDROID_CHROME_UA,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      supportedMimes: [MIME_CANDIDATES[1]],
      hasWakeLock: true,
      hasSpeech: 'standard',
      hasPermissions: true,
      hasRVFC: true,
      hasVibrate: true,
    });
    const r = runCompatibilityCheck(deps);
    expect(r.mediaRecorderMime).toBe(MIME_CANDIDATES[1]);
    expect(r.speechRecognition).toBe(true);
    expect(r.vibrate).toBe(true);
    expect(r.isIOS).toBe(false);
  });

  it('Firefox: no speech recognition, no wake lock native', () => {
    const deps = makeDeps({
      ua: FIREFOX_UA,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      supportedMimes: [MIME_CANDIDATES[2]],
      hasWakeLock: false,
      hasSpeech: 'none',
      hasPermissions: true,
      hasRVFC: false,
      hasVibrate: true,
    });
    const r = runCompatibilityCheck(deps);
    expect(r.speechRecognition).toBe(false);
    expect(r.wakeLock).toBe('polyfill');
    expect(r.mediaRecorderMime).toBe(MIME_CANDIDATES[2]);
  });

  it('missing mediaDevices → blocker', () => {
    const deps = makeDeps({
      ua: DESKTOP_CHROME_UA,
      hasMediaDevices: false,
      hasMediaRecorder: true,
      supportedMimes: [MIME_CANDIDATES[1]],
    });
    const r = runCompatibilityCheck(deps);
    const blockers = getBlockers(r);
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers[0]).toMatch(/카메라/);
  });

  it('all mimes unsupported → blocker about codec', () => {
    const deps = makeDeps({
      ua: DESKTOP_CHROME_UA,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      supportedMimes: [],
    });
    const r = runCompatibilityCheck(deps);
    const blockers = getBlockers(r);
    expect(blockers.some(b => /코덱/.test(b))).toBe(true);
  });

  it('no speech → warning only, not blocker', () => {
    const deps = makeDeps({
      ua: DESKTOP_CHROME_UA,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      supportedMimes: [MIME_CANDIDATES[1]],
      hasSpeech: 'none',
    });
    const r = runCompatibilityCheck(deps);
    expect(getBlockers(r)).toEqual([]);
    expect(getWarnings(r).some(w => /음성 인식/.test(w))).toBe(true);
  });

  it('no inputs at all falls back to empty report safely', () => {
    const r = runCompatibilityCheck({ navigator: { userAgent: '' }, window: {} });
    expect(r.mediaDevices).toBe(false);
    expect(r.mediaRecorder).toBe(false);
    expect(r.mediaRecorderMime).toBeNull();
    expect(r.isIOS).toBe(false);
  });
});
