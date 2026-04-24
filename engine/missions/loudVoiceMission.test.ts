import { describe, it, expect } from 'vitest';
import { LoudVoiceMission } from './loudVoiceMission';

describe('LoudVoiceMission', () => {
  it('초기 peakDb=-100, 점수 0', () => {
    const m = new LoudVoiceMission();
    expect(m.dbScore()).toBe(0);
    expect(m.sustainScore()).toBe(0);
    expect(m.totalScore()).toBe(0);
  });

  it('activateDb 넘으면 active', () => {
    const m = new LoudVoiceMission({ activateDb: -20 });
    m.push(-30, 0);
    expect(m.getState().active).toBe(false);
    m.push(-15, 100);
    expect(m.getState().active).toBe(true);
  });

  it('hysteresis: deactivateDb 이하에서만 비활성', () => {
    const m = new LoudVoiceMission({ activateDb: -20, deactivateDb: -25 });
    m.push(-15, 0);
    m.push(-22, 100); // 여전히 active
    expect(m.getState().active).toBe(true);
    m.push(-30, 200);
    expect(m.getState().active).toBe(false);
  });

  it('2초 유지 → sustainScore=1', () => {
    const m = new LoudVoiceMission({ targetSustainMs: 2000 });
    m.push(-10, 0);
    m.push(-10, 2000);
    expect(m.sustainScore()).toBeGreaterThanOrEqual(1);
  });

  it('1초 유지 → sustainScore=0.5', () => {
    const m = new LoudVoiceMission({ targetSustainMs: 2000 });
    m.push(-10, 0);
    m.push(-10, 1000);
    m.push(-40, 1000); // 해제
    expect(m.sustainScore()).toBeCloseTo(0.5, 2);
  });

  it('dbScore: −10dB=1.0, −40dB=0, −25dB=0.5', () => {
    const a = new LoudVoiceMission();
    a.push(-10, 0);
    expect(a.dbScore()).toBe(1);

    const b = new LoudVoiceMission();
    b.push(-40, 0);
    expect(b.dbScore()).toBe(0);

    const c = new LoudVoiceMission();
    c.push(-25, 0);
    expect(c.dbScore()).toBeCloseTo(0.5, 2);
  });

  it('dbScore clamp: −5dB는 여전히 1', () => {
    const m = new LoudVoiceMission();
    m.push(-5, 0);
    expect(m.dbScore()).toBe(1);
  });

  it('totalScore: 최대 dB + 2초 유지 → 100', () => {
    const m = new LoudVoiceMission();
    m.push(-10, 0);
    m.push(-10, 2000);
    expect(m.totalScore()).toBe(100);
  });

  it('reset() 초기화', () => {
    const m = new LoudVoiceMission();
    m.push(-10, 0); m.push(-10, 1000);
    m.reset();
    expect(m.getState().peakDb).toBe(-100);
    expect(m.getState().bestSustainedMs).toBe(0);
  });
});
