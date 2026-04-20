import { describe, it, expect } from 'vitest';
import { SquatCounter } from './squatCounter';

function simulateSquat(sq: SquatCounter, opts: {
  startT: number; minAngle: number; holdMs: number; stepMs?: number; upAngle?: number;
}) {
  const step = opts.stepMs ?? 50;
  const upA = opts.upAngle ?? 170;
  let t = opts.startT;
  // descent
  for (let a = upA; a >= opts.minAngle; a -= 10) {
    sq.push(a, t); t += step;
  }
  // hold
  const holdEnd = t + opts.holdMs;
  while (t < holdEnd) {
    sq.push(opts.minAngle, t); t += step;
  }
  // ascent
  for (let a = opts.minAngle; a <= upA; a += 10) {
    sq.push(a, t); t += step;
  }
  return t;
}

describe('SquatCounter basics', () => {
  it('초기 상태 phase=up, reps=0', () => {
    const sq = new SquatCounter();
    const s = sq.getState();
    expect(s.phase).toBe('up');
    expect(s.reps).toBe(0);
  });

  it('full down→up 사이클 → 1 rep', () => {
    const sq = new SquatCounter();
    simulateSquat(sq, { startT: 0, minAngle: 80, holdMs: 200 });
    expect(sq.getState().reps).toBe(1);
    expect(sq.getState().phase).toBe('up');
    expect(sq.getState().repList[0].minAngle).toBe(80);
  });

  it('깊이 부족 (각도 > downAngle=100) → rep 미인정', () => {
    const sq = new SquatCounter();
    // minAngle=120 → down 진입 안 함
    simulateSquat(sq, { startT: 0, minAngle: 120, holdMs: 200 });
    expect(sq.getState().reps).toBe(0);
  });

  it('down 유지 시간 < downHoldMs → 지터로 처리, rep 불인정', () => {
    // 직접 시퀀스: up → 급강하 → down 진입 → 매우 짧게 홀드 → 급상승
    const sq = new SquatCounter({ downHoldMs: 150 });
    sq.push(170, 0);
    sq.push(150, 10);    // descending
    sq.push(80, 20);     // down (enter)
    sq.push(81, 30);     // still down (within +5 hysteresis)
    sq.push(110, 40);    // try to leave — held=20ms < 150 → 지터 취급, ascending 전환 안 됨
    expect(sq.getState().phase).toBe('descending');
    expect(sq.getState().reps).toBe(0);
  });

  it('5회 연속 스쿼트 → reps=5', () => {
    const sq = new SquatCounter();
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t = simulateSquat(sq, { startT: t, minAngle: 80, holdMs: 200 });
      t += 100; // 사이 쉼
    }
    expect(sq.getState().reps).toBe(5);
  });
});

describe('SquatCounter scoring', () => {
  it('달성률: 10회 목표에서 5회 = 0.5', () => {
    const sq = new SquatCounter({ target: 10 });
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t = simulateSquat(sq, { startT: t, minAngle: 80, holdMs: 200 });
      t += 100;
    }
    expect(sq.achievement()).toBe(0.5);
  });

  it('달성률 cap: 초과해도 최대 1', () => {
    const sq = new SquatCounter({ target: 3 });
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t = simulateSquat(sq, { startT: t, minAngle: 80, holdMs: 200 });
      t += 100;
    }
    expect(sq.achievement()).toBe(1);
  });

  it('깊이: 60°이하 → 1.0, 100° → 0', () => {
    const deep = new SquatCounter();
    simulateSquat(deep, { startT: 0, minAngle: 60, holdMs: 200 });
    expect(deep.depth()).toBeCloseTo(1, 2);

    const shallow = new SquatCounter();
    // 정확히 100° 근처 달성 (downAngle 경계)
    simulateSquat(shallow, { startT: 0, minAngle: 100, holdMs: 200 });
    if (shallow.getState().reps > 0) {
      expect(shallow.depth()).toBeLessThan(0.1);
    }
  });

  it('템포: 일정 간격 → 높은 점수, 불규칙 → 낮은 점수', () => {
    const steady = new SquatCounter();
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t = simulateSquat(steady, { startT: t, minAngle: 80, holdMs: 200 });
      t += 300; // 일정
    }
    const steadyTempo = steady.tempo();

    const jittery = new SquatCounter();
    let t2 = 0;
    const jitter = [100, 1000, 200, 1500, 150];
    for (let i = 0; i < 5; i++) {
      t2 = simulateSquat(jittery, { startT: t2, minAngle: 80, holdMs: 200 });
      t2 += jitter[i];
    }
    expect(steadyTempo).toBeGreaterThan(jittery.tempo());
  });

  it('totalScore 최대값 근처 (10회 깊게 일정) ≥ 90', () => {
    const sq = new SquatCounter({ target: 10 });
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t = simulateSquat(sq, { startT: t, minAngle: 60, holdMs: 250 });
      t += 400;
    }
    expect(sq.totalScore()).toBeGreaterThanOrEqual(90);
  });
});

describe('SquatCounter 상태 머신', () => {
  it('descending 중 복귀 → 취소', () => {
    const sq = new SquatCounter();
    sq.push(170, 0);
    sq.push(140, 50);  // descending
    expect(sq.getState().phase).toBe('descending');
    sq.push(175, 100); // 다시 올라옴
    expect(sq.getState().phase).toBe('up');
    expect(sq.getState().reps).toBe(0);
  });

  it('reset() 후 초기 상태', () => {
    const sq = new SquatCounter();
    simulateSquat(sq, { startT: 0, minAngle: 80, holdMs: 200 });
    sq.reset();
    expect(sq.getState().reps).toBe(0);
    expect(sq.getState().phase).toBe('up');
  });
});
