import { describe, it, expect, vi } from 'vitest';
import { Compositor, type Renderer } from './compositor';

function makeEnv() {
  let nowMs = 0;
  const rafCbs: Array<(ts: number) => void> = [];
  const raf = vi.fn((cb: (ts: number) => void) => {
    rafCbs.push(cb);
    return rafCbs.length;
  });
  const cancelRaf = vi.fn();
  const now = () => nowMs;
  const advance = (dt: number) => { nowMs += dt; };
  const fireNext = () => {
    const cb = rafCbs.shift();
    cb?.(nowMs);
  };
  return { raf, cancelRaf, now, advance, fireNext, rafCbs };
}

describe('Compositor 상태/루프', () => {
  it('start() → isRunning=true, stop() → false', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    expect(c.isRunning()).toBe(false);
    c.start();
    expect(c.isRunning()).toBe(true);
    c.stop();
    expect(c.isRunning()).toBe(false);
  });

  it('두 번 start 해도 한 번만 스케줄', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    c.start();
    const before = env.raf.mock.calls.length;
    c.start();
    expect(env.raf.mock.calls.length).toBe(before);
  });

  it('stop() 시 cancelRaf 호출', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    c.start();
    c.stop();
    expect(env.cancelRaf).toHaveBeenCalled();
  });
});

describe('Compositor 렌더러', () => {
  it('addRenderer로 추가 + unsubscribe 반환', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    const r: Renderer = vi.fn();
    const off = c.addRenderer(r);
    expect(c.rendererCount()).toBe(1);
    off();
    expect(c.rendererCount()).toBe(0);
  });

  it('drawOnce는 모든 렌더러를 호출', () => {
    const env = makeEnv();
    const c = new Compositor({ id: 'ctx' }, { width: 16, height: 9 }, env);
    const r1: Renderer = vi.fn();
    const r2: Renderer = vi.fn();
    c.addRenderer(r1);
    c.addRenderer(r2);
    c.start();
    env.advance(50);
    c.drawOnce();
    expect(r1).toHaveBeenCalled();
    expect(r2).toHaveBeenCalled();
    const rc = (r1 as unknown as { mock: { calls: Array<[{ tMs: number; width: number; height: number; frameIndex: number; ctx: unknown }]> } }).mock.calls[0][0];
    expect(rc.width).toBe(16);
    expect(rc.height).toBe(9);
    expect(rc.tMs).toBe(50);
  });

  it('렌더러 예외는 격리 (다음 렌더러도 호출됨)', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    const r1: Renderer = vi.fn(() => { throw new Error('boom'); });
    const r2: Renderer = vi.fn();
    c.addRenderer(r1);
    c.addRenderer(r2);
    c.start();
    c.drawOnce();
    expect(r2).toHaveBeenCalled();
  });
});

describe('Compositor 타이밍', () => {
  it('targetFps 미만 간격에서는 drawFrame 스킵', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10, targetFps: 30 }, env);
    const r: Renderer = vi.fn();
    c.addRenderer(r);
    c.start();
    // 첫 tick at 0ms → 그림
    env.fireNext();
    expect(r).toHaveBeenCalledTimes(1);
    // 10ms 후 tick → 33ms 미만이므로 스킵
    env.advance(10);
    env.fireNext();
    expect(r).toHaveBeenCalledTimes(1);
    // 추가 30ms → 40ms 경과, 두 번째 draw
    env.advance(30);
    env.fireNext();
    expect(r).toHaveBeenCalledTimes(2);
  });

  it('frameIndex가 draw마다 증가', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10 }, env);
    const seen: number[] = [];
    c.addRenderer((rc) => { seen.push(rc.frameIndex); });
    c.start();
    c.drawOnce();
    env.advance(100);
    c.drawOnce();
    expect(seen).toEqual([0, 1]);
    expect(c.getFrameIndex()).toBe(2);
  });

  it('stop 후 tick은 더 이상 그리지 않음', () => {
    const env = makeEnv();
    const c = new Compositor({}, { width: 10, height: 10, targetFps: 30 }, env);
    const r: Renderer = vi.fn();
    c.addRenderer(r);
    c.start();
    c.stop();
    env.fireNext(); // 혹시 남은 콜백이 있어도 running=false라 무시
    expect(r).not.toHaveBeenCalled();
  });
});
