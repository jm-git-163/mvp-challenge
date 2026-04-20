import { describe, it, expect } from 'vitest';
import { PoseHoldMission, similarityFromAngles, stabilityFromHistory } from './poseHoldMission';

describe('similarityFromAngles', () => {
  it('동일 → 1', () => {
    expect(similarityFromAngles([90, 120], [90, 120])).toBe(1);
  });
  it('완전 반대 (180° 차이) → 0', () => {
    expect(similarityFromAngles([0, 0], [180, 180])).toBe(0);
  });
  it('30° 차이 → 1 - 30/180 ≈ 0.833', () => {
    expect(similarityFromAngles([90], [120])).toBeCloseTo(0.833, 2);
  });
  it('dim mismatch → 0', () => {
    expect(similarityFromAngles([1, 2], [1])).toBe(0);
  });
});

describe('stabilityFromHistory', () => {
  it('완전 정적 → 1', () => {
    const h = Array.from({ length: 10 }, () => [90, 120]);
    expect(stabilityFromHistory(h)).toBe(1);
  });
  it('큰 흔들림 (std > 20) → 0', () => {
    const h = [[0, 0], [40, 40], [0, 0], [40, 40], [0, 0], [40, 40]];
    expect(stabilityFromHistory(h)).toBe(0);
  });
  it('히스토리 1개면 0', () => {
    expect(stabilityFromHistory([[90, 120]])).toBe(0);
  });
});

describe('PoseHoldMission', () => {
  const target = [90, 120, 170, 170, 170, 170, 90, 90]; // 8-dim

  it('target 없으면 state 변화 없음', () => {
    const m = new PoseHoldMission();
    m.push(target, 0);
    expect(m.getState().sampleCount).toBe(0);
  });

  it('target과 동일 포즈 유지 → holding=true, peakSimilarity=1', () => {
    const m = new PoseHoldMission();
    m.setTarget(target);
    m.push(target, 0);
    m.push(target, 100);
    expect(m.getState().holding).toBe(true);
    expect(m.similarity()).toBe(1);
  });

  it('3초 유지 → holdRatio=1, totalScore 높음', () => {
    const m = new PoseHoldMission({ targetHoldMs: 3000 });
    m.setTarget(target);
    // 20 frames at 50ms = 1000ms, then 3000ms hold
    for (let i = 0; i <= 60; i++) m.push(target, i * 50);
    expect(m.holdRatio()).toBe(1);
    expect(m.totalScore()).toBeGreaterThanOrEqual(95);
  });

  it('유사도 낮은 포즈 → holding 안 됨', () => {
    const m = new PoseHoldMission({ enterSimilarity: 0.8 });
    m.setTarget(target);
    const wrong = target.map(a => a + 60); // 60° 차이 → sim ≈ 0.667
    m.push(wrong, 0);
    m.push(wrong, 100);
    expect(m.getState().holding).toBe(false);
  });

  it('hysteresis: enterSimilarity 넘어가야 진입, exitSimilarity 이하로 떨어져야 해제', () => {
    const m = new PoseHoldMission({ enterSimilarity: 0.8, exitSimilarity: 0.7 });
    m.setTarget(target);
    m.push(target, 0);                          // sim=1 → hold
    const slight = target.map(a => a + 20);     // ≈ 0.889 → still hold
    m.push(slight, 100);
    expect(m.getState().holding).toBe(true);
    const more = target.map(a => a + 30);       // ≈ 0.833 → still hold (above exit 0.7)
    m.push(more, 200);
    expect(m.getState().holding).toBe(true);
    const far = target.map(a => a + 70);        // ≈ 0.611 → below exit
    m.push(far, 300);
    expect(m.getState().holding).toBe(false);
    expect(m.getState().bestHoldMs).toBeGreaterThanOrEqual(200);
  });

  it('차원 불일치 throw', () => {
    const m = new PoseHoldMission();
    m.setTarget([1, 2, 3]);
    expect(() => m.push([1, 2], 0)).toThrow();
  });

  it('reset() 초기화', () => {
    const m = new PoseHoldMission();
    m.setTarget(target);
    m.push(target, 0);
    m.reset();
    expect(m.getState().sampleCount).toBe(0);
    expect(m.similarity()).toBe(0);
  });
});
