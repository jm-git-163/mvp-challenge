import { describe, it, expect } from 'vitest';
import { OneEuroFilter, OneEuroVectorFilter } from './oneEuroFilter';

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function variance(xs: number[]) { const m = mean(xs); return mean(xs.map(x => (x - m) ** 2)); }

describe('OneEuroFilter', () => {
  it('첫 샘플은 그대로 반환', () => {
    const f = new OneEuroFilter();
    expect(f.filter(5, 0)).toBe(5);
  });

  it('정지 신호 + 노이즈 → 스무딩되어 분산 감소', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0 });
    const raw: number[] = [];
    const smooth: number[] = [];
    let rnd = 1;
    const next = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
    for (let i = 0; i < 200; i++) {
      const t = i * (1000 / 60); // 60fps
      const x = 10 + (next() - 0.5) * 2; // ±1 noise around 10
      raw.push(x);
      smooth.push(f.filter(x, t));
    }
    // warm-up 30 샘플 뒤 비교
    const rawVar = variance(raw.slice(30));
    const smoothVar = variance(smooth.slice(30));
    expect(smoothVar).toBeLessThan(rawVar);
  });

  it('스텝 신호 추종: 100 샘플 후 거의 수렴', () => {
    const f = new OneEuroFilter({ minCutoff: 2.0, beta: 0.02 });
    let last = 0;
    for (let i = 0; i < 100; i++) {
      const t = i * (1000 / 60);
      last = f.filter(i < 5 ? 0 : 10, t);
    }
    expect(Math.abs(last - 10)).toBeLessThan(0.5);
  });

  it('reset() 후 다시 첫 샘플 그대로', () => {
    const f = new OneEuroFilter();
    f.filter(5, 0); f.filter(7, 16);
    f.reset();
    expect(f.filter(42, 100)).toBe(42);
  });

  it('동일 타임스탬프에도 안전 (0으로 나누기 방지)', () => {
    const f = new OneEuroFilter();
    f.filter(1, 100);
    expect(() => f.filter(2, 100)).not.toThrow();
  });
});

describe('OneEuroVectorFilter', () => {
  it('차원 불일치 throw', () => {
    const v = new OneEuroVectorFilter(3);
    expect(() => v.filter([1, 2], 0)).toThrow();
  });

  it('3D 랜드마크 각 축 독립 필터링', () => {
    const v = new OneEuroVectorFilter(3, { minCutoff: 1, beta: 0 });
    const out1 = v.filter([0, 0, 0], 0);
    expect(out1).toEqual([0, 0, 0]);
    for (let i = 1; i < 50; i++) v.filter([1, 2, 3], i * 16);
    const out = v.filter([1, 2, 3], 50 * 16);
    expect(out[0]).toBeCloseTo(1, 1);
    expect(out[1]).toBeCloseTo(2, 1);
    expect(out[2]).toBeCloseTo(3, 1);
  });
});
