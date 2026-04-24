import { describe, it, expect } from 'vitest';
import { ParticleSystem, PARTICLE_PRESETS, type Rng } from './particles';

function seededRng(seed = 1): Rng {
  let s = seed >>> 0;
  return () => {
    // Mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ParticleSystem: 풀 관리', () => {
  it('capacity 초과 발사 시 풀 크기만큼만 생성', () => {
    const s = new ParticleSystem(10, seededRng());
    const n = s.emit({ ...PARTICLE_PRESETS.sparkle(0, 0), count: 25 });
    expect(n).toBe(10);
    expect(s.aliveCount()).toBe(10);
  });

  it('수명 경과 후 재사용 가능', () => {
    const s = new ParticleSystem(5, seededRng());
    s.emit({ ...PARTICLE_PRESETS.sparkle(0, 0), count: 5, lifeMs: { min: 100, max: 100 } });
    s.update(200);
    expect(s.aliveCount()).toBe(0);
    const again = s.emit({ ...PARTICLE_PRESETS.sparkle(0, 0), count: 5 });
    expect(again).toBe(5);
  });

  it('clear() 모두 kill', () => {
    const s = new ParticleSystem(10, seededRng());
    s.emit({ ...PARTICLE_PRESETS.sparkle(0, 0), count: 10 });
    s.clear();
    expect(s.aliveCount()).toBe(0);
  });
});

describe('ParticleSystem: 물리', () => {
  it('중력 적용 시 vy 증가', () => {
    const s = new ParticleSystem(1, seededRng());
    s.emit({
      count: 1, x: 0, y: 0,
      speed: { min: 0, max: 0 }, angleDeg: { min: 0, max: 0 },
      size: { min: 1, max: 1 }, colors: ['#fff'],
      lifeMs: { min: 10000, max: 10000 },
      gravity: 100, fadeOut: false,
    });
    const initial: number[] = [];
    s.forEachAlive((p) => initial.push(p.vy));
    s.update(1000); // 1초
    const after: number[] = [];
    s.forEachAlive((p) => after.push(p.vy));
    expect(after[0] - initial[0]).toBeCloseTo(100, 0);
  });

  it('위치는 vx/vy * dt만큼 이동', () => {
    const s = new ParticleSystem(1, seededRng());
    s.emit({
      count: 1, x: 0, y: 0,
      speed: { min: 100, max: 100 }, angleDeg: { min: 0, max: 0 }, // 오른쪽
      size: { min: 1, max: 1 }, colors: ['#fff'],
      lifeMs: { min: 10000, max: 10000 },
      fadeOut: false,
    });
    s.update(500); // 0.5초 → x=50
    let x = 0;
    s.forEachAlive((p) => { x = p.x; });
    expect(x).toBeCloseTo(50, 0);
  });

  it('fadeOut=true면 마지막 30%에서 alpha 감소', () => {
    const s = new ParticleSystem(1, seededRng());
    s.emit({
      count: 1, x: 0, y: 0,
      speed: { min: 0, max: 0 }, angleDeg: { min: 0, max: 0 },
      size: { min: 1, max: 1 }, colors: ['#fff'],
      lifeMs: { min: 1000, max: 1000 },
      fadeOut: true,
    });
    s.update(500); // 50% → alpha=1
    let a = 0;
    s.forEachAlive((p) => { a = p.alpha; });
    expect(a).toBeCloseTo(1, 2);
    s.update(400); // 90% → alpha ~ 1 - (0.9-0.7)/0.3 = 0.333
    s.forEachAlive((p) => { a = p.alpha; });
    expect(a).toBeCloseTo(1 - 0.2 / 0.3, 2);
  });
});

describe('ParticleSystem: 결정론', () => {
  it('같은 seed → 같은 결과', () => {
    const a = new ParticleSystem(20, seededRng(42));
    const b = new ParticleSystem(20, seededRng(42));
    a.emit({ ...PARTICLE_PRESETS.confettiBurst(100, 100, ['#f00', '#0f0']), count: 10 });
    b.emit({ ...PARTICLE_PRESETS.confettiBurst(100, 100, ['#f00', '#0f0']), count: 10 });
    const aX: number[] = []; const bX: number[] = [];
    a.forEachAlive((p) => aX.push(p.x + p.vx + p.size));
    b.forEachAlive((p) => bX.push(p.x + p.vx + p.size));
    expect(aX).toEqual(bX);
  });
});

describe('PARTICLE_PRESETS', () => {
  it('confettiBurst는 위쪽으로 튐 (angleDeg -180..0)', () => {
    const o = PARTICLE_PRESETS.confettiBurst(0, 0, ['#f00']);
    expect(o.angleDeg.min).toBeLessThan(0);
    expect(o.angleDeg.max).toBeLessThanOrEqual(0);
    expect(o.gravity).toBeGreaterThan(0); // 중력으로 떨어짐
    expect(o.shape).toBe('square');
  });
  it('sparkle은 전방향 (0..360), shape circle', () => {
    const o = PARTICLE_PRESETS.sparkle(0, 0);
    expect(o.angleDeg.min).toBe(0);
    expect(o.angleDeg.max).toBe(360);
    expect(o.shape).toBe('circle');
  });
});
