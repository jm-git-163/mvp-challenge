import { describe, it, expect, vi } from 'vitest';
import { WakeLockManager, type WakeLockSentinelLike } from './wakeLock';

function makeSentinel(): WakeLockSentinelLike & { fireRelease: () => void } {
  const listeners: Array<() => void> = [];
  const s: WakeLockSentinelLike & { fireRelease: () => void } = {
    released: false,
    async release() { this.released = true; for (const cb of listeners) cb(); },
    addEventListener(_t, cb) { listeners.push(cb); },
    fireRelease() { this.released = true; for (const cb of listeners) cb(); },
  };
  return s;
}

function makeDoc() {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener(t: string, cb: () => void) { (listeners[t] ??= []).push(cb); },
    removeEventListener(t: string, cb: () => void) {
      const arr = listeners[t] ?? []; const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1);
    },
    fire(t: string) { for (const cb of [...(listeners[t] ?? [])]) cb(); },
    setVisibility(v: DocumentVisibilityState) { this.visibilityState = v; },
  };
}

describe('WakeLockManager', () => {
  it('native 경로: request 성공 → kind=native, isActive=true', async () => {
    const sentinel = makeSentinel();
    const wl = new WakeLockManager({
      requestNative: vi.fn().mockResolvedValue(sentinel),
    });
    const kind = await wl.acquire();
    expect(kind).toBe('native');
    expect(wl.isActive()).toBe(true);
  });

  it('native 실패 + polyfill 주입 → kind=polyfill', async () => {
    const enable = vi.fn(); const disable = vi.fn();
    const wl = new WakeLockManager({
      requestNative: vi.fn().mockRejectedValue(new Error('no')),
      createPolyfill: () => ({ enable, disable }),
    });
    const kind = await wl.acquire();
    expect(kind).toBe('polyfill');
    expect(enable).toHaveBeenCalled();
    expect(wl.isActive()).toBe(true);
  });

  it('native도 polyfill도 없으면 kind=none', async () => {
    const wl = new WakeLockManager({});
    const kind = await wl.acquire();
    expect(kind).toBe('none');
    expect(wl.isActive()).toBe(false);
  });

  it('release(): native sentinel 해제 + polyfill disable', async () => {
    const sentinel = makeSentinel();
    const wl = new WakeLockManager({ requestNative: vi.fn().mockResolvedValue(sentinel) });
    await wl.acquire();
    await wl.release();
    expect(sentinel.released).toBe(true);
    expect(wl.isActive()).toBe(false);
  });

  it('visibilitychange=visible + desired + released → 자동 재취득', async () => {
    const doc = makeDoc();
    const first = makeSentinel();
    const second = makeSentinel();
    const req = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const wl = new WakeLockManager({ requestNative: req, documentRef: doc });
    await wl.acquire();
    first.fireRelease(); // 탭 백그라운드 진입 시뮬
    // 돌아옴
    doc.setVisibility('visible');
    doc.fire('visibilitychange');
    await new Promise(r => setTimeout(r, 0));
    expect(req).toHaveBeenCalledTimes(2);
  });

  it('release 후에는 visibilitychange로 재취득 안 함', async () => {
    const doc = makeDoc();
    const sentinel = makeSentinel();
    const req = vi.fn().mockResolvedValue(sentinel);
    const wl = new WakeLockManager({ requestNative: req, documentRef: doc });
    await wl.acquire();
    await wl.release();
    doc.fire('visibilitychange');
    await new Promise(r => setTimeout(r, 0));
    expect(req).toHaveBeenCalledTimes(1);
  });
});
