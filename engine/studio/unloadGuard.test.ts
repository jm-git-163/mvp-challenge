import { describe, it, expect, vi } from 'vitest';
import { UnloadGuard, type UnloadHost } from './unloadGuard';

function makeHost() {
  let handler: ((e: BeforeUnloadEvent) => void) | null = null;
  const host: UnloadHost = {
    addBeforeUnload: (fn) => { handler = fn; },
    removeBeforeUnload: (fn) => { if (handler === fn) handler = null; },
  };
  return {
    host,
    hasHandler: () => handler !== null,
    fire: () => {
      const e = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent;
      handler?.(e);
      return e;
    },
  };
}

describe('UnloadGuard', () => {
  it('초기 isArmed=false', () => {
    const { host } = makeHost();
    const g = new UnloadGuard(host);
    expect(g.isArmed()).toBe(false);
  });

  it('arm → 핸들러 등록, preventDefault 호출', () => {
    const m = makeHost();
    const g = new UnloadGuard(m.host);
    g.arm();
    expect(g.isArmed()).toBe(true);
    expect(m.hasHandler()).toBe(true);
    const e = m.fire();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.returnValue).toBe('');
  });

  it('중복 arm 무시', () => {
    const m = makeHost();
    const addSpy = vi.spyOn(m.host, 'addBeforeUnload');
    const g = new UnloadGuard(m.host);
    g.arm();
    g.arm();
    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('disarm → 핸들러 제거', () => {
    const m = makeHost();
    const g = new UnloadGuard(m.host);
    g.arm();
    g.disarm();
    expect(g.isArmed()).toBe(false);
    expect(m.hasHandler()).toBe(false);
  });

  it('arm 없이 disarm 호출은 noop', () => {
    const m = makeHost();
    const g = new UnloadGuard(m.host);
    expect(() => g.disarm()).not.toThrow();
  });
});
