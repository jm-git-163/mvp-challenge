import { describe, it, expect, vi } from 'vitest';
import { Haptics, PATTERNS } from './haptics';

function makeMockVibrate() {
  const calls: (number | number[])[] = [];
  const fn = vi.fn((p: number | number[]) => {
    calls.push(p);
    return true;
  });
  return { fn, calls };
}

describe('Haptics', () => {
  it('isSupported: vibrate 주입 없으면 false', () => {
    const h = new Haptics({ vibrate: null });
    expect(h.isSupported()).toBe(false);
    expect(h.fire('tick')).toBe(false);
  });

  it('fire: 정상 호출', () => {
    const { fn } = makeMockVibrate();
    const h = new Haptics({ vibrate: fn, now: () => 0 });
    expect(h.fire('go')).toBe(true);
    expect(fn).toHaveBeenCalledWith(PATTERNS.go);
  });

  it('muted 면 모두 false', () => {
    const { fn } = makeMockVibrate();
    const h = new Haptics({ vibrate: fn, muted: true });
    expect(h.fire('go')).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('동일 패턴 minIntervalMs 내 호출은 무시', () => {
    const { fn } = makeMockVibrate();
    let t = 0;
    const h = new Haptics({ vibrate: fn, now: () => t, minIntervalMs: 50 });
    expect(h.fire('rep')).toBe(true);
    t = 30;
    expect(h.fire('rep')).toBe(false);
    t = 80;
    expect(h.fire('rep')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('서로 다른 패턴은 각자 throttle', () => {
    const { fn } = makeMockVibrate();
    let t = 0;
    const h = new Haptics({ vibrate: fn, now: () => t, minIntervalMs: 100 });
    expect(h.fire('tick')).toBe(true);
    expect(h.fire('go')).toBe(true); // 다른 패턴이므로 허용
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel: vibrate(0) 호출', () => {
    const { fn } = makeMockVibrate();
    const h = new Haptics({ vibrate: fn });
    h.cancel();
    expect(fn).toHaveBeenCalledWith(0);
  });

  it('패턴 정의 완전성', () => {
    expect(PATTERNS.success).toEqual([20, 40, 20]);
    expect(PATTERNS.tick).toBe(15);
    expect(PATTERNS.error).toHaveLength(3);
  });
});
