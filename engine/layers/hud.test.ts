import { describe, it, expect } from 'vitest';
import { timerRingAngle, timerIsCritical, counterOvershoot, scoreCountUp, missionPromptAlpha, missionPromptPosition } from './hud';

describe('timer ring', () => {
  it('시작 시 2π', () => {
    expect(timerRingAngle({ elapsedSec: 0, totalSec: 10 })).toBeCloseTo(Math.PI * 2, 5);
  });
  it('종료 시 0', () => {
    expect(timerRingAngle({ elapsedSec: 10, totalSec: 10 })).toBe(0);
  });
  it('절반 시 π', () => {
    expect(timerRingAngle({ elapsedSec: 5, totalSec: 10 })).toBeCloseTo(Math.PI, 5);
  });
  it('초과 시 0', () => {
    expect(timerRingAngle({ elapsedSec: 12, totalSec: 10 })).toBe(0);
  });
  it('total<=0이면 0', () => {
    expect(timerRingAngle({ elapsedSec: 0, totalSec: 0 })).toBe(0);
  });
  it('5초 미만 남으면 critical', () => {
    expect(timerIsCritical({ elapsedSec: 6, totalSec: 10 })).toBe(true);
    expect(timerIsCritical({ elapsedSec: 4, totalSec: 10 })).toBe(false);
  });
});

describe('counter overshoot', () => {
  it('시작/종료는 1', () => {
    expect(counterOvershoot(0)).toBe(1);
    expect(counterOvershoot(240)).toBe(1);
  });
  it('중간에 > 1 (피크)', () => {
    const peak = counterOvershoot(120);
    expect(peak).toBeGreaterThan(1.1);
  });
  it('음수/초과는 1', () => {
    expect(counterOvershoot(-10)).toBe(1);
    expect(counterOvershoot(500)).toBe(1);
  });
});

describe('score count up', () => {
  it('시작 시 prev', () => {
    expect(scoreCountUp(50, 80, 0, 600)).toBe(50);
  });
  it('종료 시 next', () => {
    expect(scoreCountUp(50, 80, 600, 600)).toBe(80);
  });
  it('중간값은 사이', () => {
    const v = scoreCountUp(0, 100, 300, 600);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(100);
  });
});

describe('mission prompt alpha', () => {
  it('페이드 인 / 유지 / 페이드 아웃', () => {
    expect(missionPromptAlpha(0)).toBeCloseTo(0, 3);
    expect(missionPromptAlpha(150)).toBeCloseTo(0.5, 2); // 페이드 인 중간
    expect(missionPromptAlpha(300)).toBe(1);
    expect(missionPromptAlpha(2000)).toBe(1);
    expect(missionPromptAlpha(2300)).toBeCloseTo(1, 3);
    expect(missionPromptAlpha(2450)).toBeCloseTo(0.5, 2); // 페이드 아웃 중간
    expect(missionPromptAlpha(2600)).toBe(0);
  });
  it('음수 elapsedMs는 0', () => {
    expect(missionPromptAlpha(-100)).toBe(0);
  });
});

describe('mission prompt position', () => {
  it('세이프 영역 하단', () => {
    const p = missionPromptPosition(1080, 1920);
    expect(p.x).toBe(540);
    expect(p.y).toBeCloseTo(1920 * 0.82, 2);
  });
});
