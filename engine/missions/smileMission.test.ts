import { describe, it, expect } from 'vitest';
import { SmileMission } from './smileMission';
import { smileIntensity, jawOpen, browUp, shapeScore } from '../recognition/faceTypes';

describe('faceTypes utils', () => {
  it('shapeScore 이름 매칭', () => {
    const shapes = [{ categoryName: 'mouthSmileLeft', score: 0.7 }];
    expect(shapeScore(shapes, 'mouthSmileLeft')).toBe(0.7);
    expect(shapeScore(shapes, 'nope')).toBe(0);
    expect(shapeScore(undefined, 'x')).toBe(0);
  });
  it('smileIntensity = max(L,R)', () => {
    const s = [
      { categoryName: 'mouthSmileLeft', score: 0.3 },
      { categoryName: 'mouthSmileRight', score: 0.8 },
    ];
    expect(smileIntensity(s)).toBe(0.8);
  });
  it('jawOpen / browUp 기본 0', () => {
    expect(jawOpen([])).toBe(0);
    expect(browUp([])).toBe(0);
  });
});

describe('SmileMission state', () => {
  it('초기: peak=0, bestSustainedMs=0', () => {
    const m = new SmileMission();
    const s = m.getState();
    expect(s.peak).toBe(0);
    expect(s.bestSustainedMs).toBe(0);
  });

  it('activateThreshold 넘으면 active', () => {
    const m = new SmileMission({ activateThreshold: 0.5 });
    m.push(0.2, 0);
    expect(m.getState().active).toBe(false);
    m.push(0.6, 100);
    expect(m.getState().active).toBe(true);
  });

  it('hysteresis: deactivateThreshold 이하에서만 비활성', () => {
    const m = new SmileMission({ activateThreshold: 0.5, deactivateThreshold: 0.35 });
    m.push(0.6, 0);
    expect(m.getState().active).toBe(true);
    m.push(0.4, 100); // 여전히 active (0.35 이하 아님)
    expect(m.getState().active).toBe(true);
    m.push(0.3, 200);
    expect(m.getState().active).toBe(false);
  });

  it('bestSustainedMs 추적', () => {
    const m = new SmileMission({ activateThreshold: 0.5, deactivateThreshold: 0.35 });
    m.push(0.6, 0);    // active at 0
    m.push(0.7, 2500); // still active → 2500ms
    m.push(0.2, 3000); // deactivate at 3000 → segment = 3000
    expect(m.getState().bestSustainedMs).toBe(3000);
    // 새 세그먼트가 더 짧아도 best는 유지
    m.push(0.6, 4000);
    m.push(0.2, 4500);
    expect(m.getState().bestSustainedMs).toBe(3000);
  });

  it('peak은 최대 강도', () => {
    const m = new SmileMission();
    m.push(0.2, 0);
    m.push(0.9, 100);
    m.push(0.5, 200);
    expect(m.intensity()).toBe(0.9);
  });

  it('sustain 점수: targetSustainMs=3000, 3초 유지 → 1.0', () => {
    const m = new SmileMission({ targetSustainMs: 3000 });
    m.push(0.8, 0);
    m.push(0.8, 3000);
    expect(m.sustain()).toBeGreaterThanOrEqual(1);
  });

  it('sustain 점수: 1.5초 유지 → 0.5', () => {
    const m = new SmileMission({ targetSustainMs: 3000 });
    m.push(0.8, 0);
    m.push(0.8, 1500);
    m.push(0.1, 1500); // 경계값 deactivate
    expect(m.sustain()).toBeCloseTo(0.5, 2);
  });

  it('totalScore: 피크 1.0 + 3초 유지 → 100', () => {
    const m = new SmileMission({ targetSustainMs: 3000 });
    m.push(1.0, 0);
    m.push(1.0, 3000);
    expect(m.totalScore()).toBe(100);
  });

  it('totalScore: 중간 수준 케이스', () => {
    const m = new SmileMission({ targetSustainMs: 3000 });
    m.push(0.6, 0);
    m.push(0.6, 1500); // 1.5초 유지, peak=0.6
    m.push(0.1, 1500);
    // intensity=0.6*50=30, sustain=0.5*50=25 → 55
    expect(m.totalScore()).toBe(55);
  });

  it('reset() 후 초기화', () => {
    const m = new SmileMission();
    m.push(0.9, 0); m.push(0.9, 2000);
    m.reset();
    expect(m.getState().peak).toBe(0);
    expect(m.getState().bestSustainedMs).toBe(0);
  });
});
