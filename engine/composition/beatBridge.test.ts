/**
 * engine/composition/beatBridge.test.ts
 *
 * Focused Session-4 Candidate M 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachBeatClockToLiveState, type BeatClockLike } from './beatBridge';
import { getLiveState, resetLiveState } from './liveState';

function makeFakeClock() {
  const beatCbs: Array<(i: number, t: number) => void> = [];
  const onsetCbs: Array<(i: number, t: number) => void> = [];
  const clock: BeatClockLike = {
    onBeat: (cb) => { beatCbs.push(cb); return () => { const i = beatCbs.indexOf(cb); if (i >= 0) beatCbs.splice(i, 1); }; },
    onOnset: (cb) => { onsetCbs.push(cb); return () => { const i = onsetCbs.indexOf(cb); if (i >= 0) onsetCbs.splice(i, 1); }; },
  };
  return { clock, fireBeat: () => beatCbs.forEach((c) => c(0, 0)), fireOnset: () => onsetCbs.forEach((c) => c(0, 0)) };
}

/** 가짜 시간 유틸: setTimeout 을 큐에 저장하고 advance(ms) 로 수동 소비. */
function fakeTimers() {
  type Task = { id: number; at: number; cb: () => void };
  let now = 0;
  let nextId = 1;
  const tasks: Task[] = [];
  const setTimeoutFn = (cb: () => void, ms: number) => {
    const t: Task = { id: nextId++, at: now + ms, cb };
    tasks.push(t);
    return t.id as unknown as number;
  };
  const clearTimeoutFn = (h: unknown) => {
    const id = h as number;
    const i = tasks.findIndex((t) => t.id === id);
    if (i >= 0) tasks.splice(i, 1);
  };
  function advance(ms: number) {
    const target = now + ms;
    while (true) {
      const next = tasks
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      const i = tasks.indexOf(next);
      if (i >= 0) tasks.splice(i, 1);
      next.cb();
    }
    now = target;
  }
  return { now: () => now, setTimeoutFn, clearTimeoutFn, advance };
}

describe('attachBeatClockToLiveState — Session-4 M', () => {
  beforeEach(() => resetLiveState());

  it('onBeat 발화 → beatIntensity 1.0 펄스', () => {
    const { clock, fireBeat } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, {}, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    expect(getLiveState().beatIntensity).toBe(0);
    fireBeat();
    expect(getLiveState().beatIntensity).toBeCloseTo(1, 2);
    h.detach();
  });

  it('decay: decayMs 이후 0 으로 수렴', () => {
    const { clock, fireBeat } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, { decayMs: 100, tickMs: 20 }, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    fireBeat();
    t.advance(50);
    const mid = getLiveState().beatIntensity;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    t.advance(60);
    expect(getLiveState().beatIntensity).toBe(0);
    h.detach();
  });

  it('연속 펄스 중 더 큰 값 유지 (짧은 펄스가 긴 펄스 덮어쓰지 않음)', () => {
    const { clock, fireBeat } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, { decayMs: 200 }, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    fireBeat();                         // peak=1
    t.advance(50);
    expect(getLiveState().beatIntensity).toBeGreaterThan(0.7); // 아직 높음
    h.pulse(0.3);                       // 작은 추가 펄스
    // 기존 decay 값이 새 값(0.3)보다 크면 유지
    expect(getLiveState().beatIntensity).toBeGreaterThanOrEqual(0.3);
    h.detach();
  });

  it('includeOnsets: onset 콜백도 펄스 (0.7)', () => {
    const { clock, fireOnset } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, { includeOnsets: true }, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    fireOnset();
    expect(getLiveState().beatIntensity).toBeCloseTo(0.7, 2);
    h.detach();
  });

  it('detach: liveState 0 으로 리셋 + 이후 beat 는 영향 없음', () => {
    const { clock, fireBeat } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, {}, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    fireBeat();
    h.detach();
    expect(getLiveState().beatIntensity).toBe(0);
    fireBeat();
    expect(getLiveState().beatIntensity).toBe(0);
  });

  it('수동 pulse: 외부에서 직접 호출 가능', () => {
    const { clock } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, {}, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    h.pulse(0.5);
    expect(getLiveState().beatIntensity).toBeCloseTo(0.5, 2);
    h.detach();
  });

  it('intensity clamp: >1 → 1, <0 → 0', () => {
    const { clock } = makeFakeClock();
    const t = fakeTimers();
    const h = attachBeatClockToLiveState(clock, {}, {
      now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
    });
    h.pulse(5);
    expect(getLiveState().beatIntensity).toBe(1);
    h.pulse(-1);
    // decay + negative 펄스 → 기존 값 유지 (max 로 덮어쓰지 않음)
    h.detach();
  });

  it('decayMs/tickMs 최소값 보정 (너무 작은 값 방어)', () => {
    const { clock } = makeFakeClock();
    const t = fakeTimers();
    expect(() => {
      const h = attachBeatClockToLiveState(clock, { decayMs: 0, tickMs: 0 }, {
        now: t.now, setTimeout: t.setTimeoutFn, clearTimeout: t.clearTimeoutFn,
      });
      h.detach();
    }).not.toThrow();
  });
});
