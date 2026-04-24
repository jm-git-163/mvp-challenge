import { describe, it, expect } from 'vitest';
import { countdownState, countdownEvents, DEFAULT_COUNTDOWN } from './countdown';

describe('countdownState', () => {
  it('음수 elapsed → idle', () => {
    const s = countdownState(-10);
    expect(s.phase).toBe('idle');
    expect(s.opacity).toBe(0);
  });

  it('0ms → 3 표시', () => {
    const s = countdownState(0);
    expect(s.phase).toBe('counting');
    expect(s.displayNumber).toBe(3);
  });

  it('1500ms → 2 표시', () => {
    const s = countdownState(1500);
    expect(s.displayNumber).toBe(2);
  });

  it('2999ms → 1 표시', () => {
    const s = countdownState(2999);
    expect(s.displayNumber).toBe(1);
  });

  it('3000ms → GO', () => {
    const s = countdownState(3000);
    expect(s.phase).toBe('go');
    expect(s.displayNumber).toBe(0);
  });

  it('3500ms → done', () => {
    const s = countdownState(3500);
    expect(s.phase).toBe('done');
  });

  it('scale 은 0 시점 0.6, 중간 피크 > 1', () => {
    const start = countdownState(0);
    const peak = countdownState(200); // local=0.2 → 피크 1.1
    expect(start.scale).toBeCloseTo(0.6, 5);
    expect(peak.scale).toBeGreaterThan(1);
    expect(peak.scale).toBeCloseTo(1.1, 5);
  });

  it('opacity 는 경계에서 낮아짐', () => {
    const mid = countdownState(500);
    const nearEnd = countdownState(990); // local=0.99
    expect(mid.opacity).toBe(1);
    expect(nearEnd.opacity).toBeLessThan(0.2);
  });
});

describe('countdownEvents', () => {
  it('기본 4개 이벤트 (3 tick + go + end)', () => {
    const ev = countdownEvents();
    expect(ev).toHaveLength(5);
    expect(ev[0]).toEqual({ tMs: 0, kind: 'tick', number: 3 });
    expect(ev[1]).toEqual({ tMs: 1000, kind: 'tick', number: 2 });
    expect(ev[2]).toEqual({ tMs: 2000, kind: 'tick', number: 1 });
    expect(ev[3]).toEqual({ tMs: 3000, kind: 'go' });
    expect(ev[4]).toEqual({ tMs: 3500, kind: 'end' });
  });

  it('from=5 커스텀', () => {
    const ev = countdownEvents({ ...DEFAULT_COUNTDOWN, from: 5 });
    expect(ev.filter((e) => e.kind === 'tick')).toHaveLength(5);
  });
});
