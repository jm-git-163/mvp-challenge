/**
 * engine/ar/landmarkStream.test.ts
 *
 * Focused Session-5 Candidate T 검증.
 */
import { describe, it, expect } from 'vitest';
import { createLandmarkSmoother } from './landmarkStream';

describe('createLandmarkSmoother — Session-5 T', () => {
  it('count=3: 첫 push 는 initAsIs=true 기본이라 거의 그대로', () => {
    const sm = createLandmarkSmoother(3, { minCutoff: 1.0, beta: 0 });
    const out = sm.push([
      { x: 0.1, y: 0.2, z: 0.3, visibility: 1 },
      { x: 0.4, y: 0.5, z: 0.6, visibility: 1 },
      { x: 0.7, y: 0.8, z: 0.9, visibility: 1 },
    ], 0);
    expect(out).toHaveLength(3);
    expect(out[0].x).toBeCloseTo(0.1, 3);
    expect(out[2].z).toBeCloseTo(0.9, 3);
  });

  it('visibility 임계치 미만이면 이전 값 유지', () => {
    const sm = createLandmarkSmoother(1, { visibilityThreshold: 0.5 });
    sm.push([{ x: 10, y: 20, z: 0, visibility: 1 }], 0);
    const out = sm.push([{ x: 999, y: 999, z: 999, visibility: 0.1 }], 33);
    // visibility 0.1 < 0.5 → 새 값 무시, 이전 그대로
    expect(out[0].x).toBeCloseTo(10, 3);
    expect(out[0].y).toBeCloseTo(20, 3);
  });

  it('visibility 누락 → score 로 폴백', () => {
    const sm = createLandmarkSmoother(1, { visibilityThreshold: 0.5 });
    const out1 = sm.push([{ x: 1, y: 2, z: 0, score: 1 }], 0);
    expect(out1[0].x).toBeCloseTo(1, 3);
    const out2 = sm.push([{ x: 999, y: 999, z: 0, score: 0.2 }], 33);
    expect(out2[0].x).toBeCloseTo(1, 3); // 이전 값 유지
  });

  it('고정 입력을 반복하면 점근적으로 입력에 수렴 (지터 없음)', () => {
    const sm = createLandmarkSmoother(1, { minCutoff: 1.0, beta: 0 });
    let t = 0;
    sm.push([{ x: 0, y: 0, z: 0, visibility: 1 }], t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      sm.push([{ x: 1.0, y: 1.0, z: 1.0, visibility: 1 }], t);
    }
    const snap = sm.snapshot();
    expect(snap[0].x).toBeGreaterThan(0.9);
    expect(snap[0].y).toBeGreaterThan(0.9);
  });

  it('스파이크 입력은 minCutoff=1.0/beta=0 에서 크게 감쇠', () => {
    const sm = createLandmarkSmoother(1, { minCutoff: 1.0, beta: 0 });
    sm.push([{ x: 0, y: 0, z: 0, visibility: 1 }], 0);
    // 1프레임 후 단일 스파이크 — 16ms
    const out = sm.push([{ x: 100, y: 0, z: 0, visibility: 1 }], 16);
    // 100 까지 치솟지 않고 감쇠 (dt=0.016s, cutoff=1Hz → α≈0.09)
    expect(out[0].x).toBeLessThan(15);
  });

  it('reset: 스냅샷도 초기화', () => {
    const sm = createLandmarkSmoother(2);
    sm.push([{ x: 5, y: 5, z: 0, visibility: 1 }, { x: 7, y: 7, z: 0, visibility: 1 }], 0);
    sm.reset();
    const snap = sm.snapshot();
    expect(snap[0]).toEqual({ x: 0, y: 0, z: 0, visibility: 0 });
    expect(snap[1]).toEqual({ x: 0, y: 0, z: 0, visibility: 0 });
  });

  it('length 부족한 입력 → 나머지 인덱스는 이전 값 유지', () => {
    const sm = createLandmarkSmoother(3);
    sm.push([
      { x: 1, y: 1, z: 0, visibility: 1 },
      { x: 2, y: 2, z: 0, visibility: 1 },
      { x: 3, y: 3, z: 0, visibility: 1 },
    ], 0);
    const out = sm.push([{ x: 10, y: 10, z: 0, visibility: 1 }], 33);
    expect(out[0].x).toBeGreaterThan(1); // 갱신됨
    expect(out[1].x).toBeCloseTo(2, 3);  // 유지
    expect(out[2].x).toBeCloseTo(3, 3);  // 유지
  });

  it('useZ=false 이면 z 축 스무딩 생략 (원본 그대로)', () => {
    const sm = createLandmarkSmoother(1, { useZ: false });
    const out = sm.push([{ x: 0, y: 0, z: 0.7, visibility: 1 }], 0);
    expect(out[0].z).toBeCloseTo(0.7, 3);
  });

  it('NaN x → 관측 실패로 이전 값 유지', () => {
    const sm = createLandmarkSmoother(1);
    sm.push([{ x: 1, y: 2, z: 0, visibility: 1 }], 0);
    const out = sm.push([{ x: NaN, y: 999, z: 0, visibility: 1 }], 33);
    expect(out[0].x).toBeCloseTo(1, 3);
    expect(out[0].y).toBeCloseTo(2, 3);
  });
});
