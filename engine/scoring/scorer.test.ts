import { describe, it, expect } from 'vitest';
import {
  aggregate,
  starsFromScore,
  clampScore,
  missionResultOf,
  type MissionResult,
} from './scorer';

describe('clampScore', () => {
  it('범위 밖 값 클램프', () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(50.4)).toBe(50);
    expect(clampScore(50.6)).toBe(51);
  });
  it('NaN/Infinity → 0', () => {
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(0);
  });
});

describe('starsFromScore 경계값', () => {
  it('0 → 1성', () => { expect(starsFromScore(0)).toBe(1); });
  it('12 → 1성 (round(12/25)=0)', () => { expect(starsFromScore(12)).toBe(1); });
  it('13 → 2성 (round(13/25)=1)', () => { expect(starsFromScore(13)).toBe(2); });
  it('37 → 2성 (round(37/25)=1)', () => { expect(starsFromScore(37)).toBe(2); });
  it('38 → 3성 (round(38/25)=2)', () => { expect(starsFromScore(38)).toBe(3); });
  it('62 → 3성 (round(62/25)=2)', () => { expect(starsFromScore(62)).toBe(3); });
  it('63 → 4성 (round(63/25)=3)', () => { expect(starsFromScore(63)).toBe(4); });
  it('87 → 4성', () => { expect(starsFromScore(87)).toBe(4); });
  it('88 → 5성', () => { expect(starsFromScore(88)).toBe(5); });
  it('100 → 5성', () => { expect(starsFromScore(100)).toBe(5); });
  it('범위 밖은 클램프 후 계산', () => { expect(starsFromScore(-50)).toBe(1); expect(starsFromScore(200)).toBe(5); });
});

describe('aggregate', () => {
  it('빈 배열 → total=0, stars=1, passed=false', () => {
    const s = aggregate([]);
    expect(s).toEqual({ total: 0, stars: 1, missions: [], passed: false });
  });

  it('동일 weight → 산술 평균', () => {
    const missions: MissionResult[] = [
      { kind: 'squat', id: 'a', score: 80, weight: 1 },
      { kind: 'smile', id: 'b', score: 60, weight: 1 },
    ];
    expect(aggregate(missions).total).toBe(70);
  });

  it('가중 평균', () => {
    const missions: MissionResult[] = [
      { kind: 'squat', id: 'a', score: 100, weight: 3 },
      { kind: 'smile', id: 'b', score: 40, weight: 1 },
    ];
    // (100*0.75 + 40*0.25) = 75 + 10 = 85
    expect(aggregate(missions).total).toBe(85);
  });

  it('weight=0 전부 → 평균으로 폴백', () => {
    const missions: MissionResult[] = [
      { kind: 'squat', id: 'a', score: 80, weight: 0 },
      { kind: 'smile', id: 'b', score: 40, weight: 0 },
    ];
    expect(aggregate(missions).total).toBe(60);
  });

  it('passingScore 기본 60', () => {
    expect(aggregate([{ kind: 'smile', id: 'a', score: 59, weight: 1 }]).passed).toBe(false);
    expect(aggregate([{ kind: 'smile', id: 'a', score: 60, weight: 1 }]).passed).toBe(true);
  });

  it('passingScore 커스텀', () => {
    const s = aggregate([{ kind: 'squat', id: 'a', score: 70, weight: 1 }], { passingScore: 80 });
    expect(s.passed).toBe(false);
  });

  it('missions 내 score 범위 밖은 클램프되어 집계', () => {
    const missions: MissionResult[] = [
      { kind: 'squat', id: 'a', score: 150 as number, weight: 1 },
    ];
    expect(aggregate(missions).total).toBe(100);
  });
});

describe('missionResultOf', () => {
  it('Scorer의 totalScore를 0..100 정수로 클램프', () => {
    const r = missionResultOf('smile', 'm1', { totalScore: () => 87.6 }, 2, { foo: 1 });
    expect(r).toEqual({ kind: 'smile', id: 'm1', score: 88, weight: 2, detail: { foo: 1 } });
  });
  it('weight 기본 1', () => {
    const r = missionResultOf('gesture', 'g', { totalScore: () => 50 });
    expect(r.weight).toBe(1);
  });
});

describe('결정론 검증', () => {
  it('같은 입력 → 항상 같은 출력', () => {
    const missions: MissionResult[] = [
      { kind: 'squat', id: 'a', score: 77, weight: 2 },
      { kind: 'smile', id: 'b', score: 91, weight: 1 },
      { kind: 'gesture', id: 'c', score: 44, weight: 3 },
    ];
    const a = aggregate(missions);
    const b = aggregate(missions);
    expect(a).toEqual(b);
  });
});
