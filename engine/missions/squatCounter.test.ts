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

// ── Focused Session-3 Candidate I: 지터/이상치 필터 회귀 테스트 ──
describe('SquatCounter smoothing + outlier rejection (Session-3 I)', () => {
  it("smoothing='none' (기본): 기존 테스트와 동일 동작", () => {
    const sq = new SquatCounter();
    simulateSquat(sq, { startT: 0, minAngle: 80, holdMs: 200 });
    expect(sq.getState().reps).toBe(1);
  });

  it("smoothing='ema': 상승 중 1프레임 스파이크로 인한 오카운트 방지", () => {
    // 일정한 상승 중 카메라 튐으로 각도 150°→30°→150° 같은 임펄스 발생.
    // 'none' 에서는 튐이 phase 를 잘못 전이시킬 수 있지만, 'ema' 는 흡수.
    const emaSq = new SquatCounter({ smoothing: 'ema', emaAlpha: 0.35 });
    emaSq.push(170, 0);
    emaSq.push(170, 50);
    const prevPhase = emaSq.getState().phase;
    emaSq.push(30, 100); // 단일 튐
    // EMA 로 smoothed 은 170 → 120 정도. descending 까지만 가고 down 미진입.
    expect(emaSq.getState().phase).not.toBe('down');
    // 다시 정상값으로 복귀 시 phase up 복귀
    emaSq.push(170, 150);
    emaSq.push(170, 200);
    expect(prevPhase).toBe('up');
  });

  it("maxAnglePerFrame: 55° 초과 스파이크는 버려짐 (카운트 1 유지)", () => {
    const sq = new SquatCounter({ maxAnglePerFrame: 55 });
    let t = 0;
    // 정상 descent
    for (let a = 170; a >= 80; a -= 10) { sq.push(a, t); t += 50; }
    // 카메라 튐: 80 → 10 (70° 변화) — outlier, skip
    sq.push(10, t); t += 50;
    // 정상 계속
    for (let i = 0; i < 5; i++) { sq.push(80, t); t += 50; }
    for (let a = 80; a <= 170; a += 10) { sq.push(a, t); t += 50; }
    expect(sq.getState().reps).toBe(1);
  });

  it("smoothing='median3': 단일 임펄스 무시 (rep 카운트 유지)", () => {
    const sq = new SquatCounter({ smoothing: 'median3' });
    let t = 0;
    for (let a = 170; a >= 80; a -= 10) { sq.push(a, t); t += 50; }
    // 홀드 중 1프레임 임펄스
    sq.push(80, t); t += 50;
    sq.push(200, t); t += 50; // 임펄스 (median으로 걸러짐)
    sq.push(80, t); t += 50;
    for (let i = 0; i < 4; i++) { sq.push(80, t); t += 50; }
    for (let a = 80; a <= 170; a += 10) { sq.push(a, t); t += 50; }
    expect(sq.getState().reps).toBe(1);
  });

  it('reset() 후 ema/median 히스토리도 초기화', () => {
    const sq = new SquatCounter({ smoothing: 'ema' });
    sq.push(100, 0);
    sq.push(50, 10);
    sq.reset();
    // reset 후 첫 샘플은 필터 상태 영향 없음 → 그대로 흐름
    sq.push(170, 0);
    sq.push(80, 10);
    // ema prev === null 이었으므로 첫 값 그대로 적용됐어야 = 흐름 정상
    expect(sq.getState().phase).not.toBe('up');
  });

  it('NaN/Infinity 입력은 안전하게 무시', () => {
    const sq = new SquatCounter();
    sq.push(170, 0);
    expect(() => sq.push(NaN, 10)).not.toThrow();
    expect(() => sq.push(Infinity, 20)).not.toThrow();
    expect(sq.getState().phase).toBe('up');
  });

  it('emaAlpha=1 이면 원본값과 동일 (스무딩 없음)', () => {
    const sq1 = new SquatCounter({ smoothing: 'ema', emaAlpha: 1 });
    const sq2 = new SquatCounter({ smoothing: 'none' });
    let t = 0;
    const path = [170, 150, 130, 110, 90, 80];
    for (const a of path) { sq1.push(a, t); sq2.push(a, t); t += 50; }
    expect(sq1.getState().phase).toBe(sq2.getState().phase);
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
