import { describe, it, expect } from 'vitest';
import { PresenceWatcher, DEFAULT_PRESENCE } from './presenceWatcher';

describe('PresenceWatcher', () => {
  it('기본 상태 present', () => {
    const w = new PresenceWatcher();
    expect(w.getState()).toBe('present');
  });

  it('계속 감지되면 이벤트 없음', () => {
    const w = new PresenceWatcher();
    expect(w.observe(true, 0)).toEqual([]);
    expect(w.observe(true, 100)).toEqual([]);
    expect(w.observe(true, 200)).toEqual([]);
  });

  it('warningAfterMs 전에는 이벤트 없음', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    expect(w.observe(false, 1000)).toEqual([]);
    expect(w.observe(false, 2999)).toEqual([]);
  });

  it('warningAfterMs 경과 → warn', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    const ev = w.observe(false, 3100);
    expect(ev).toEqual([{ kind: 'warn' }]);
    expect(w.getState()).toBe('warning');
  });

  it('pauseAfterMs 경과 → pause', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    w.observe(false, 3100); // warn
    const ev = w.observe(false, 10100);
    expect(ev).toEqual([{ kind: 'pause' }]);
    expect(w.getState()).toBe('absent');
  });

  it('warn 후 복귀 → enter 이벤트', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    w.observe(false, 3100);
    const ev = w.observe(true, 4000);
    expect(ev).toEqual([{ kind: 'enter' }]);
    expect(w.getState()).toBe('present');
  });

  it('pause 후 복귀 → resume 이벤트', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    w.observe(false, 11000);
    const ev = w.observe(true, 12000);
    expect(ev).toEqual([{ kind: 'resume' }]);
  });

  it('warn·pause 동시 트리거 (긴 간격 프레임)', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    const ev = w.observe(false, 12000);
    expect(ev).toEqual([{ kind: 'warn' }, { kind: 'pause' }]);
  });

  it('복귀 후 다시 이탈하면 카운트 재시작', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    w.observe(false, 3100);      // warn
    w.observe(true, 4000);       // enter
    w.observe(false, 4001);      // 이탈 다시
    expect(w.observe(false, 7000)).toEqual([]); // 3초 전이므로
    expect(w.observe(false, 7200)).toEqual([{ kind: 'warn' }]);
  });

  it('reset: 상태 초기화', () => {
    const w = new PresenceWatcher();
    w.observe(false, 0);
    w.observe(false, 11000);
    w.reset();
    expect(w.getState()).toBe('present');
    expect(w.observe(false, 0)).toEqual([]);
  });

  it('DEFAULT_PRESENCE 값', () => {
    expect(DEFAULT_PRESENCE.warningAfterMs).toBe(3000);
    expect(DEFAULT_PRESENCE.pauseAfterMs).toBe(10000);
  });
});
