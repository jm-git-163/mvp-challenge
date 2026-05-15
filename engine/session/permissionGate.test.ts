import { describe, it, expect, vi } from 'vitest';
import { PermissionGate, describeFailure, type GateState } from './permissionGate';
import { MediaSession } from './mediaSession';
import { WakeLockManager } from './wakeLock';
import { PopupSuppressor } from './popupSuppressor';
import { MIME_CANDIDATES } from './compatibilityCheck';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

function goodCompatDeps() {
  return {
    navigator: {
      userAgent: IPHONE_UA,
      mediaDevices: { getUserMedia: () => {} },
      permissions: { query: () => {} },
      wakeLock: { request: () => {} },
    },
    window: {
      MediaRecorder: { isTypeSupported: (t: string) => t === MIME_CANDIDATES[0] },
      webkitSpeechRecognition: function() {},
      HTMLVideoElement: { prototype: { requestVideoFrameCallback: () => {} } },
    },
  };
}

function makeStream(): MediaStream {
  const track = { kind: 'video', readyState: 'live', addEventListener() {}, stop() {} };
  return { getTracks: () => [track, { ...track, kind: 'audio' }] } as unknown as MediaStream;
}

function makeDeps(opts: {
  compatDeps?: ReturnType<typeof goodCompatDeps>;
  mediaError?: unknown;
  wakeKind?: 'native' | 'polyfill' | 'none';
}) {
  const media = new MediaSession({
    getUserMedia: opts.mediaError
      ? vi.fn().mockRejectedValue(opts.mediaError)
      : vi.fn().mockResolvedValue(makeStream()),
  });
  const sentinel = {
    released: false,
    async release() { this.released = true; },
    addEventListener() {},
  };
  const wakeLock = new WakeLockManager({
    requestNative: opts.wakeKind === 'native'
      ? vi.fn().mockResolvedValue(sentinel)
      : opts.wakeKind === 'polyfill'
        ? vi.fn().mockRejectedValue(new Error('no native'))
        : vi.fn().mockRejectedValue(new Error('no native')),
    createPolyfill: opts.wakeKind === 'polyfill'
      ? () => ({ enable: vi.fn(), disable: vi.fn() })
      : undefined,
  });
  const popupSuppressor = new PopupSuppressor({
    window: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    document: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  return { media, wakeLock, popupSuppressor, compatDeps: opts.compatDeps ?? goodCompatDeps() };
}

describe('PermissionGate', () => {
  it('happy path: ready + wakeLockKind=native', async () => {
    const gate = new PermissionGate(makeDeps({ wakeKind: 'native' }));
    const state = await gate.run();
    expect(state.phase).toBe('ready');
    expect(state.wakeLockKind).toBe('native');
    expect(state.blockers).toEqual([]);
  });

  it('compat blocker → compat_failed', async () => {
    const bad = goodCompatDeps();
    bad.navigator.mediaDevices = undefined as unknown as typeof bad.navigator.mediaDevices;
    const gate = new PermissionGate(makeDeps({ compatDeps: bad }));
    const state = await gate.run();
    expect(state.phase).toBe('compat_failed');
    expect(state.blockers.length).toBeGreaterThan(0);
  });

  it('media denied → media_denied phase', async () => {
    // getUserMedia가 NotAllowedError 던짐 → MediaSession이 kind=denied로 분류해 즉시 throw
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const gate = new PermissionGate(makeDeps({ mediaError: err }));
    const state = await gate.run();
    expect(state.phase).toBe('media_denied');
  });

  it('media NotReadable (장치 점유) → media_failed', async () => {
    const err = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    const gate = new PermissionGate(makeDeps({ mediaError: err }));
    const state = await gate.run();
    expect(state.phase).toBe('media_failed');
  });

  it('wake lock 실패해도 ready로 진행 (폴리필 없음=none)', async () => {
    const gate = new PermissionGate(makeDeps({ wakeKind: 'none' }));
    const state = await gate.run();
    expect(state.phase).toBe('ready');
    expect(state.wakeLockKind).toBe('none');
  });

  it('subscribe()는 상태 변화마다 콜백', async () => {
    const gate = new PermissionGate(makeDeps({ wakeKind: 'native' }));
    const phases: string[] = [];
    gate.subscribe(s => phases.push(s.phase));
    await gate.run();
    expect(phases).toContain('idle');
    expect(phases).toContain('checking_compat');
    expect(phases).toContain('requesting_media');
    expect(phases).toContain('acquiring_wake');
    expect(phases).toContain('ready');
  });

  it('retry()는 거부 후 재시도 가능', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const media = new MediaSession({
      getUserMedia: vi.fn()
        .mockRejectedValueOnce(denied)
        .mockResolvedValueOnce(makeStream()),
    });
    const wakeLock = new WakeLockManager({ requestNative: vi.fn().mockRejectedValue(new Error('no')) });
    const popupSuppressor = new PopupSuppressor({
      window: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      document: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    const gate = new PermissionGate({ media, wakeLock, popupSuppressor, compatDeps: goodCompatDeps() });
    const s1 = await gate.run();
    expect(s1.phase).toBe('media_denied');
    const s2 = await gate.retry();
    expect(s2.phase).toBe('ready');
  });
});

describe('describeFailure', () => {
  it('compat_failed → retryable false', () => {
    const s: GateState = { phase: 'compat_failed', compat: null, blockers: ['x'], warnings: [], error: null, wakeLockKind: null };
    expect(describeFailure(s).retryable).toBe(false);
  });
  it('media_denied → retryable true', () => {
    const s: GateState = { phase: 'media_denied', compat: null, blockers: [], warnings: [], error: null, wakeLockKind: null };
    expect(describeFailure(s).retryable).toBe(true);
  });
  it('ready → 빈 title', () => {
    const s: GateState = { phase: 'ready', compat: null, blockers: [], warnings: [], error: null, wakeLockKind: 'native' };
    expect(describeFailure(s).title).toBe('');
  });
});
