import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MediaSession,
  MediaSessionError,
  __resetMediaSessionForTests,
  getMediaSession,
} from './mediaSession';

// ─── 가짜 MediaStreamTrack/MediaStream ──────────────────────────────────────

type Listener = () => void;

class FakeTrack {
  public readyState: 'live' | 'ended' = 'live';
  private listeners: Record<string, Listener[]> = {};
  constructor(public kind: 'video' | 'audio') {}
  addEventListener(name: string, cb: Listener) {
    (this.listeners[name] ??= []).push(cb);
  }
  stop() {
    this.readyState = 'ended';
  }
  fireEnded() {
    this.readyState = 'ended';
    for (const cb of this.listeners['ended'] ?? []) cb();
  }
}

class FakeStream {
  private tracks: FakeTrack[];
  constructor(tracks?: FakeTrack[]) {
    this.tracks = tracks ?? [new FakeTrack('video'), new FakeTrack('audio')];
  }
  getTracks() { return this.tracks; }
}

function makeStream() {
  return new FakeStream() as unknown as MediaStream;
}

function denied() {
  const e = new Error('denied'); e.name = 'NotAllowedError'; return e;
}
function overconstrained() {
  const e = new Error('over'); e.name = 'OverconstrainedError'; return e;
}
function notFound() {
  const e = new Error('nf'); e.name = 'NotFoundError'; return e;
}
function notReadable() {
  const e = new Error('nr'); e.name = 'NotReadableError'; return e;
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('MediaSession.acquire', () => {
  it('한 번만 getUserMedia를 호출하고 캐시 반환', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream());
    const s = new MediaSession({ getUserMedia: gum });
    const a = await s.acquire();
    const b = await s.acquire();
    expect(a).toBe(b);
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('동시 acquire()는 단일 in-flight promise로 dedupe', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream());
    const s = new MediaSession({ getUserMedia: gum });
    const [a, b, c] = await Promise.all([s.acquire(), s.acquire(), s.acquire()]);
    expect(a).toBe(b); expect(b).toBe(c);
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('OverconstrainedError → 폴백 체인에서 다음 제약으로 재시도', async () => {
    const ok = makeStream();
    const gum = vi.fn()
      .mockRejectedValueOnce(overconstrained())
      .mockResolvedValueOnce(ok);
    const s = new MediaSession({ getUserMedia: gum });
    const got = await s.acquire();
    expect(got).toBe(ok);
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it('NotAllowedError(denied) → 즉시 throw, 폴백 중단', async () => {
    const gum = vi.fn().mockRejectedValue(denied());
    const s = new MediaSession({ getUserMedia: gum });
    await expect(s.acquire()).rejects.toBeInstanceOf(MediaSessionError);
    expect(gum).toHaveBeenCalledTimes(1);
    try { await s.acquire(); } catch (e) {
      expect((e as MediaSessionError).kind).toBe('denied');
    }
  });

  it('NotFoundError → 즉시 중단', async () => {
    const gum = vi.fn().mockRejectedValue(notFound());
    const s = new MediaSession({ getUserMedia: gum });
    await expect(s.acquire()).rejects.toMatchObject({ kind: 'notfound' });
    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('NotReadable 연속 실패 후 전부 실패하면 unknown/notreadable로 throw', async () => {
    const gum = vi.fn().mockRejectedValue(notReadable());
    const s = new MediaSession({ getUserMedia: gum });
    await expect(s.acquire()).rejects.toBeInstanceOf(MediaSessionError);
    // FALLBACK_CHAIN 길이만큼 시도
    expect(gum.mock.calls.length).toBeGreaterThan(1);
  });

  it('override 제공 시 첫 시도는 override 제약으로', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream());
    const s = new MediaSession({ getUserMedia: gum });
    await s.acquire({ video: { width: { ideal: 320 } } });
    const firstCallArg = gum.mock.calls[0][0];
    expect(firstCallArg.video).toMatchObject({ width: { ideal: 320 } });
  });
});

describe('MediaSession track lifecycle', () => {
  it('track "ended" 이벤트 → stale 마킹 + onEnded 콜백', async () => {
    const stream = new FakeStream();
    const gum = vi.fn().mockResolvedValue(stream as unknown as MediaStream);
    const s = new MediaSession({ getUserMedia: gum });
    const cb = vi.fn();
    s.onEnded(cb);
    await s.acquire();
    stream.getTracks()[0].fireEnded();
    expect(cb).toHaveBeenCalledWith('track-ended');
    expect(s.getStream()).toBeNull();
  });

  it('stale 후 재acquire → 신규 getUserMedia 호출', async () => {
    const first = new FakeStream();
    const second = new FakeStream();
    const gum = vi.fn()
      .mockResolvedValueOnce(first as unknown as MediaStream)
      .mockResolvedValueOnce(second as unknown as MediaStream);
    const s = new MediaSession({ getUserMedia: gum });
    await s.acquire();
    first.getTracks()[0].fireEnded();
    const reacquired = await s.acquire();
    expect(reacquired).toBe(second as unknown as MediaStream);
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it('release() → 모든 트랙 stop + explicit-release 콜백', async () => {
    const stream = new FakeStream();
    const gum = vi.fn().mockResolvedValue(stream as unknown as MediaStream);
    const s = new MediaSession({ getUserMedia: gum });
    const cb = vi.fn();
    s.onEnded(cb);
    await s.acquire();
    s.release();
    expect(stream.getTracks()[0].readyState).toBe('ended');
    expect(stream.getTracks()[1].readyState).toBe('ended');
    expect(cb).toHaveBeenCalledWith('explicit-release');
    expect(s.getStream()).toBeNull();
  });

  it('markStale() → 다음 acquire가 재호출', async () => {
    const gum = vi.fn()
      .mockResolvedValueOnce(makeStream())
      .mockResolvedValueOnce(makeStream());
    const s = new MediaSession({ getUserMedia: gum });
    await s.acquire();
    s.markStale();
    await s.acquire();
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it('onEnded 구독 해제 동작', async () => {
    const stream = new FakeStream();
    const gum = vi.fn().mockResolvedValue(stream as unknown as MediaStream);
    const s = new MediaSession({ getUserMedia: gum });
    const cb = vi.fn();
    const unsub = s.onEnded(cb);
    await s.acquire();
    unsub();
    stream.getTracks()[0].fireEnded();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('MediaSession constructor', () => {
  it('getUserMedia 구현 없으면 MediaSessionError(notfound) throw', () => {
    // globalThis.navigator 없는 node 환경에서는 자동으로 notfound
    expect(() => new MediaSession({ getUserMedia: undefined as unknown as never }))
      .toThrow(MediaSessionError);
  });
});

describe('싱글톤', () => {
  beforeEach(() => {
    __resetMediaSessionForTests(vi.fn().mockResolvedValue(makeStream()));
  });

  it('getMediaSession은 동일 인스턴스 반환', () => {
    const a = getMediaSession();
    const b = getMediaSession();
    expect(a).toBe(b);
  });

  it('__resetMediaSessionForTests는 새 인스턴스 생성', () => {
    const a = getMediaSession();
    const b = __resetMediaSessionForTests(vi.fn().mockResolvedValue(makeStream()));
    expect(a).not.toBe(b);
  });
});
