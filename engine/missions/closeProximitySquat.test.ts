/**
 * engine/missions/closeProximitySquat.test.ts
 * FIX-O: 재설계된 pivot/velocity-reversal 기반 카운터 테스트.
 */
import { describe, it, expect } from 'vitest';
import { CloseProximitySquatDetector } from './closeProximitySquat';

function makeLms(faceY: number, vis = 0.9) {
  const lms: any[] = [];
  for (let i = 0; i < 33; i++) {
    if (i <= 8) lms.push({ x: 0.5, y: faceY, z: 0, visibility: vis });
    else        lms.push({ x: 0.5, y: 1.2, z: 0, visibility: 0.05 });
  }
  return lms;
}

/**
 * 부드러운 아래-위 곡선 생성 (cosine).
 * standing(yStand) → squatting(ySquat) → standing 왕복 1회.
 */
function feedSquat(d: CloseProximitySquatDetector, opts: {
  yStand: number; ySquat: number; durationMs: number; fps?: number; t0: number;
}): number {
  const fps = opts.fps ?? 30;
  const frames = Math.round((opts.durationMs / 1000) * fps);
  const mid  = (opts.yStand + opts.ySquat) / 2;
  const amp  = (opts.ySquat - opts.yStand) / 2;
  let t = opts.t0;
  for (let i = 0; i < frames; i++) {
    const phase = (i / frames) * 2 * Math.PI;
    const y = mid - amp * Math.cos(phase);
    d.update(makeLms(y), t);
    t += 1000 / fps;
  }
  return t;
}

describe('CloseProximitySquatDetector (FIX-O)', () => {
  it('얼굴 안 잡히면 active=false', () => {
    const d = new CloseProximitySquatDetector();
    const s = d.update(makeLms(0.3, 0.05), 0);
    expect(s.active).toBe(false);
    expect(s.count).toBe(0);
  });

  it('가만히 서 있으면 count=0', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 60; i++) { d.update(makeLms(0.3), t); t += 33; }
    expect(d.getCount()).toBe(0);
  });

  it('앉는 동작 1회(편도) 는 count=0 (rep 미완성)', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 30; i++) { d.update(makeLms(0.30), t); t += 33; }
    for (let i = 0; i < 15; i++) {
      const y = 0.30 + (0.60 - 0.30) * (i / 14);
      d.update(makeLms(y), t);
      t += 33;
    }
    for (let i = 0; i < 60; i++) { d.update(makeLms(0.60), t); t += 33; }
    expect(d.getCount()).toBe(0);
  });

  it('앉은 상태에서 작은 머리 흔들림은 count=0 (false positive 방지 — 핵심 버그)', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 120; i++) {
      const noise = Math.sin(i * 0.3) * 0.02;
      d.update(makeLms(0.55 + noise), t);
      t += 33;
    }
    expect(d.getCount()).toBe(0);
  });

  it('실제 스쿼트 1회 왕복 시 count=1', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    t = feedSquat(d, { yStand: 0.30, ySquat: 0.50, durationMs: 1500, t0: t });
    // 스쿼트 끝난 뒤 서 있는 정지 구간 (실제 유저 행동 재현)
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    expect(d.getCount()).toBe(1);
  });

  it('연속 3회 스쿼트 → count>=2', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    for (let r = 0; r < 3; r++) {
      t = feedSquat(d, { yStand: 0.30, ySquat: 0.52, durationMs: 1200, t0: t });
      for (let i = 0; i < 6; i++) { d.update(makeLms(0.30), t); t += 33; }
    }
    expect(d.getCount()).toBeGreaterThanOrEqual(2);
  });

  it('진폭 너무 작으면(노이즈) 카운트 안됨', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    for (let r = 0; r < 5; r++) {
      t = feedSquat(d, { yStand: 0.30, ySquat: 0.31, durationMs: 1200, t0: t });
    }
    expect(d.getCount()).toBe(0);
  });

  it('너무 빠른 움직임(머리 끄덕임) 은 카운트 안됨', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    for (let r = 0; r < 5; r++) {
      t = feedSquat(d, { yStand: 0.30, ySquat: 0.50, durationMs: 200, t0: t });
    }
    expect(d.getCount()).toBe(0);
  });

  it('reset() — 카운트·상태 초기화', () => {
    const d = new CloseProximitySquatDetector();
    let t = 0;
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    t = feedSquat(d, { yStand: 0.30, ySquat: 0.52, durationMs: 1500, t0: t });
    for (let i = 0; i < 15; i++) { d.update(makeLms(0.30), t); t += 33; }
    expect(d.getCount()).toBeGreaterThan(0);
    d.reset();
    expect(d.getCount()).toBe(0);
    expect(d.getPhase()).toBe('unknown');
  });
});
