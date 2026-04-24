import { describe, it, expect } from 'vitest';
import { POSE, angleDeg, dist2D, mean, type Landmark3D } from './poseTypes';

const L = (x: number, y: number, z = 0, v = 1): Landmark3D => ({ x, y, z, visibility: v });

describe('poseTypes', () => {
  it('POSE 인덱스 33개', () => {
    expect(Object.keys(POSE).length).toBe(33);
    expect(POSE.LEFT_KNEE).toBe(25);
    expect(POSE.RIGHT_HIP).toBe(24);
  });

  it('dist2D: (0,0)-(3,4) = 5', () => {
    expect(dist2D(L(0, 0), L(3, 4))).toBe(5);
  });

  it('angleDeg: 직각 = 90°', () => {
    // a=(1,0) b=(0,0) c=(0,1) → 90°
    expect(angleDeg(L(1, 0), L(0, 0), L(0, 1))).toBeCloseTo(90, 5);
  });

  it('angleDeg: 180° 일직선', () => {
    expect(angleDeg(L(-1, 0), L(0, 0), L(1, 0))).toBeCloseTo(180, 5);
  });

  it('angleDeg: 0° 같은 방향', () => {
    expect(angleDeg(L(1, 0), L(0, 0), L(2, 0))).toBeCloseTo(0, 5);
  });

  it('angleDeg: 정점 중첩이면 0 반환 (divide-by-zero 방어)', () => {
    expect(angleDeg(L(0, 0), L(0, 0), L(1, 1))).toBe(0);
  });

  it('mean: 좌우 평균', () => {
    const m = mean(L(0, 0, 0, 1), L(2, 4, 6, 0.5));
    expect(m.x).toBe(1); expect(m.y).toBe(2); expect(m.z).toBe(3);
    expect(m.visibility).toBe(0.5);
  });
});
