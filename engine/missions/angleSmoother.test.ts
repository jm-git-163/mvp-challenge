/**
 * engine/missions/angleSmoother.test.ts
 *
 * Focused Session-4 Candidate N 검증.
 */
import { describe, it, expect } from 'vitest';
import { createAngleSmoother } from './angleSmoother';

describe('createAngleSmoother — Session-4 N', () => {
  it('smoothing=none: 원 값 그대로 통과', () => {
    const s = createAngleSmoother();
    expect(s.push(170)).toBe(170);
    expect(s.push(120)).toBe(120);
    expect(s.push(90)).toBe(90);
  });

  it('maxAnglePerFrame: 급변 스파이크 reject (null 반환)', () => {
    const s = createAngleSmoother({ maxAnglePerFrame: 30 });
    expect(s.push(170)).toBe(170);
    expect(s.push(30)).toBeNull();   // Δ=140 → reject
    expect(s.push(160)).toBe(160);   // Δ=10 vs last(170) → accept
  });

  it('ema: 초기값은 그대로, 이후 서서히 수렴', () => {
    const s = createAngleSmoother({ smoothing: 'ema', emaAlpha: 0.5 });
    expect(s.push(100)).toBe(100);
    expect(s.push(200)!).toBeCloseTo(150, 2); // 0.5*200 + 0.5*100
    expect(s.push(200)!).toBeCloseTo(175, 2);
  });

  it('median3: 3-샘플 중앙값', () => {
    const s = createAngleSmoother({ smoothing: 'median3' });
    expect(s.push(100)).toBe(100);
    expect(s.push(200)).toBe(200); // [100,200] sorted, floor(2/2)=1 → 200
    expect(s.push(50)).toBe(100);  // sorted [50,100,200] → idx 1 = 100
    expect(s.push(80)).toBe(80);   // sorted [50,80,200] → idx 1 = 80
  });

  it('reset: 내부 상태 초기화', () => {
    const s = createAngleSmoother({ smoothing: 'ema', emaAlpha: 0.5 });
    s.push(100);
    s.push(200);
    s.reset();
    expect(s.push(50)).toBe(50); // 리셋 후 첫 값 = 그대로
  });

  it('NaN/Infinity 입력 → null', () => {
    const s = createAngleSmoother();
    expect(s.push(NaN)).toBeNull();
    expect(s.push(Infinity)).toBeNull();
  });

  it('outlier 이후 last 갱신 안됨 → 다음 프레임 기준은 직전 accepted', () => {
    const s = createAngleSmoother({ maxAnglePerFrame: 20 });
    s.push(100);                    // accept, last=100
    expect(s.push(200)).toBeNull(); // reject, last 그대로 100
    expect(s.push(115)).toBe(115);  // Δ vs 100 = 15 → accept
  });
});
