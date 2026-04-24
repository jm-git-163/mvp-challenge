import { describe, it, expect } from 'vitest';
import { GestureMission } from './gestureMission';

describe('GestureMission', () => {
  it('초기: 프롬프트 없으면 isFinished=false (미시작)', () => {
    const g = new GestureMission();
    expect(g.isFinished()).toBe(false); // currentIdx=-1, prompts.length=0 → -1 >= 0 false
    expect(g.currentPrompt()).toBeNull();
  });

  it('begin() 후 currentPrompt 노출', () => {
    const g = new GestureMission();
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    expect(g.currentPrompt()?.target).toBe('Thumb_Up');
  });

  it('매칭 (target + confidence ≥ min) → 다음 프롬프트로', () => {
    const g = new GestureMission({ minConfidence: 0.6 });
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    g.push('None', 0.9, 100);
    g.push('Thumb_Up', 0.4, 200); // confidence 부족
    expect(g.currentPrompt()?.target).toBe('Thumb_Up');
    g.push('Thumb_Up', 0.8, 500);
    expect(g.currentPrompt()?.target).toBe('Victory');
    expect(g.getResults()[0].matched).toBe(true);
    expect(g.getResults()[0].responseMs).toBe(500);
  });

  it('timeout → 실패 기록 후 진행', () => {
    const g = new GestureMission({ defaultTimeoutMs: 1000 });
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    g.push('None', 0.9, 500);
    g.push('None', 0.9, 1200); // elapsed 1200 ≥ 1000
    expect(g.getResults()[0].matched).toBe(false);
    expect(g.currentPrompt()?.target).toBe('Victory');
  });

  it('모든 프롬프트 소화 시 isFinished', () => {
    const g = new GestureMission();
    g.begin([{ target: 'Thumb_Up' }], 0);
    g.push('Thumb_Up', 0.9, 500);
    expect(g.isFinished()).toBe(true);
  });

  it('responseSpeed: fastResponseMs 이하 → 1', () => {
    const g = new GestureMission({ fastResponseMs: 800, slowResponseMs: 4000 });
    g.begin([{ target: 'Thumb_Up' }], 0);
    g.push('Thumb_Up', 0.9, 500); // 500ms < 800 → 만점
    expect(g.responseSpeed()).toBe(1);
  });

  it('responseSpeed: slowResponseMs 이상 → 0', () => {
    const g = new GestureMission({ fastResponseMs: 800, slowResponseMs: 4000 });
    g.begin([{ target: 'Thumb_Up' }], 0);
    g.push('Thumb_Up', 0.9, 4500);
    expect(g.responseSpeed()).toBe(0);
  });

  it('meanConfidence: 매칭된 신뢰도 평균', () => {
    const g = new GestureMission();
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    g.push('Thumb_Up', 0.8, 500);
    g.push('Victory', 0.6, 1000);
    expect(g.meanConfidence()).toBeCloseTo(0.7, 2);
  });

  it('totalScore: 모두 매칭·빠른 응답·높은 신뢰도 → 100 근처', () => {
    const g = new GestureMission();
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    g.push('Thumb_Up', 1.0, 400);
    g.push('Victory', 1.0, 400 + 400);
    expect(g.totalScore()).toBe(100);
  });

  it('totalScore: 반만 매칭 → 점수 반토막', () => {
    const g = new GestureMission({ defaultTimeoutMs: 1000 });
    g.begin([{ target: 'Thumb_Up' }, { target: 'Victory' }], 0);
    g.push('Thumb_Up', 1.0, 400);        // 매칭
    g.push('None', 0.9, 400 + 1100);     // 타임아웃 실패
    const score = g.totalScore();
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(60);
  });

  it('reset() 초기화', () => {
    const g = new GestureMission();
    g.begin([{ target: 'Thumb_Up' }], 0);
    g.push('Thumb_Up', 1, 100);
    g.reset();
    expect(g.getResults().length).toBe(0);
    expect(g.currentPrompt()).toBeNull();
  });
});
