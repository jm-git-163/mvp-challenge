import { describe, it, expect } from 'vitest';
import { summarize, evaluate, PerfSampler, DEFAULT_BUDGET } from './performanceBudget';

describe('summarize', () => {
  it('빈 배열 → 0 값', () => {
    const s = summarize([], 33.3);
    expect(s.count).toBe(0);
    expect(s.p50Ms).toBe(0);
  });

  it('30fps 균등 (33.3ms) → 드롭 0', () => {
    const arr = Array(100).fill(33.3);
    const s = summarize(arr, 33.3);
    expect(s.droppedPct).toBe(0);
    expect(s.p50Ms).toBeCloseTo(33.3, 1);
  });

  it('일부 긴 프레임 → p95 반영', () => {
    const arr = [...Array(95).fill(33), ...Array(5).fill(100)];
    const s = summarize(arr, 33.3);
    expect(s.p95Ms).toBeGreaterThan(50);
    expect(s.droppedPct).toBeGreaterThan(0);
  });
});

describe('evaluate', () => {
  it('30fps 이상적 → pass', () => {
    const r = evaluate(Array(60).fill(33.3));
    expect(r.pass).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('p95 초과 → violation', () => {
    const arr = [...Array(90).fill(33), ...Array(10).fill(80)];
    const r = evaluate(arr);
    expect(r.pass).toBe(false);
    expect(r.violations.some((v) => v.includes('p95'))).toBe(true);
  });

  it('드롭률 초과 → violation', () => {
    const arr = [...Array(60).fill(33), ...Array(40).fill(70)];
    const r = evaluate(arr, { ...DEFAULT_BUDGET, p95MaxMs: 1000 });
    expect(r.pass).toBe(false);
    expect(r.violations.some((v) => v.includes('드롭'))).toBe(true);
  });

  it('빈 입력 → pass', () => {
    expect(evaluate([]).pass).toBe(true);
  });
});

describe('PerfSampler', () => {
  it('첫 tick 은 샘플 없음, 두 번째부터 delta 기록', () => {
    const s = new PerfSampler();
    s.tick(1000);
    expect(s.size()).toBe(0);
    s.tick(1033);
    expect(s.size()).toBe(1);
  });

  it('maxSamples 초과 시 FIFO drop', () => {
    const s = new PerfSampler(3);
    s.tick(0);
    s.tick(10);
    s.tick(20);
    s.tick(30);
    s.tick(40);
    expect(s.size()).toBe(3);
  });

  it('10초 이상 갭은 무시 (탭 suspend 후 복귀)', () => {
    const s = new PerfSampler();
    s.tick(0);
    s.tick(15_000);
    expect(s.size()).toBe(0);
  });

  it('report 는 evaluate 위임', () => {
    const s = new PerfSampler();
    let t = 0;
    for (let i = 0; i < 30; i++) { t += 33; s.tick(t); }
    const r = s.report();
    expect(r.count).toBe(29);
    expect(r.pass).toBe(true);
  });

  it('reset 으로 상태 초기화', () => {
    const s = new PerfSampler();
    s.tick(0); s.tick(33);
    s.reset();
    expect(s.size()).toBe(0);
    s.tick(100);
    expect(s.size()).toBe(0); // lastMs=null 이라 첫 tick 만으로는 샘플 없음
  });
});
