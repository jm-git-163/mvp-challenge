/**
 * hipMotionGate.test.ts — TEAM-ACCURACY (2026-04-23)
 *
 * 가짜 스쿼트 카운트 차단 게이트 단위테스트.
 * 사용자 제보 시나리오 (의자에 앉아 가만히 있는데 카운트 12 개) 회귀 방지.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HipMotionGate } from './hipMotionGate';
import type { NormalizedLandmark } from '../../utils/poseUtils';

/** MoveNet 17-keypoint stub. hip 인덱스 11/12. */
function lm(opts: {
  hipY?: number;
  hipVis?: number;
  noseY?: number;
} = {}): NormalizedLandmark[] {
  const hipY = opts.hipY ?? 0.7;
  const hipVis = opts.hipVis ?? 0.9;
  const arr: NormalizedLandmark[] = new Array(17).fill(null).map(() => ({
    x: 0.5, y: 0.5, score: 0,
  }));
  arr[0] = { x: 0.5, y: opts.noseY ?? 0.2, score: 0.9 };
  arr[5] = { x: 0.45, y: 0.35, score: 0.8 };
  arr[6] = { x: 0.55, y: 0.35, score: 0.8 };
  arr[11] = { x: 0.45, y: hipY, score: hipVis };
  arr[12] = { x: 0.55, y: hipY, score: hipVis };
  return arr;
}

describe('HipMotionGate', () => {
  let gate: HipMotionGate;
  beforeEach(() => { gate = new HipMotionGate(); });

  it('hip 좌표가 30 초간 완전히 정지면 allow=false (앉아있음 시뮬)', () => {
    let t = 0;
    let lastResult: ReturnType<HipMotionGate['update']> | null = null;
    // 30 초 × 20fps = 600 프레임, hipY 0.7 고정 (앉은 자세 가정)
    for (let i = 0; i < 600; i++) {
      lastResult = gate.update(lm({ hipY: 0.7 }), t);
      t += 50;
    }
    expect(lastResult?.allow).toBe(false);
    expect(lastResult?.amplitude).toBeLessThan(0.001);
    expect(lastResult?.reason).toBe('no-amplitude');
  });

  it('hip visibility 가 항상 0.3 미만이면 allow=false (몸이 안 보임)', () => {
    let t = 0;
    let last: ReturnType<HipMotionGate['update']> | null = null;
    for (let i = 0; i < 60; i++) {
      const y = 0.5 + Math.sin(i * 0.5) * 0.15; // 큰 진폭이 있어도 visibility 가 낮으면 거부
      last = gate.update(lm({ hipY: y, hipVis: 0.2 }), t);
      t += 50;
    }
    expect(last?.allow).toBe(false);
    // visibility 가 낮아 visible 샘플이 부족 → too-few-samples 또는 low-visibility
    expect(['low-visibility', 'too-few-samples']).toContain(last?.reason);
  });

  it('미세 노이즈 (±0.02) + 평균 visibility 0.5 → allow=false (앉아서 살짝 들썩)', () => {
    let t = 0;
    let last: ReturnType<HipMotionGate['update']> | null = null;
    for (let i = 0; i < 60; i++) {
      const noise = (Math.random() - 0.5) * 0.04; // ±0.02 jitter
      last = gate.update(lm({ hipY: 0.7 + noise, hipVis: 0.5 }), t);
      t += 50;
    }
    expect(last?.allow).toBe(false);
    expect(last?.amplitude).toBeLessThan(0.06);
    expect(last?.reason).toBe('no-amplitude');
  });

  it('정상 스쿼트 진폭 (0.55 → 0.75 → 0.55) → allow=true (회귀 방지)', () => {
    let t = 0;
    let last: ReturnType<HipMotionGate['update']> | null = null;
    // 1.5 초 윈도 안에 hip 이 0.55 → 0.75 → 0.55 까지 왕복 (진짜 스쿼트 하강·상승)
    // 30 프레임 (50ms 간격) = 1.5 초
    for (let i = 0; i < 30; i++) {
      const phase = (i / 30) * Math.PI * 2;
      const y = 0.65 + Math.sin(phase) * 0.10; // 진폭 0.20
      last = gate.update(lm({ hipY: y, hipVis: 0.85 }), t);
      t += 50;
    }
    expect(last?.allow).toBe(true);
    expect(last?.amplitude).toBeGreaterThan(0.06);
    expect(last?.reason).toBe('ok');
  });

  it('landmarks 가 비었으면 allow=false', () => {
    const r = gate.update([], 0);
    expect(r.allow).toBe(false);
    expect(r.reason).toBe('no-landmarks');
  });

  it('reset 후엔 history 비고 다시 정지하면 allow=false', () => {
    let t = 0;
    // 먼저 진폭 큰 데이터 채움
    for (let i = 0; i < 30; i++) {
      const y = 0.65 + Math.sin(i * 0.3) * 0.10;
      gate.update(lm({ hipY: y, hipVis: 0.85 }), t);
      t += 50;
    }
    gate.reset();
    // 리셋 후 정지
    let last: ReturnType<HipMotionGate['update']> | null = null;
    for (let i = 0; i < 60; i++) {
      last = gate.update(lm({ hipY: 0.7, hipVis: 0.85 }), t);
      t += 50;
    }
    expect(last?.allow).toBe(false);
    expect(last?.reason).toBe('no-amplitude');
  });
});
