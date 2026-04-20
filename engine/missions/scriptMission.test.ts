import { describe, it, expect } from 'vitest';
import { ScriptMission } from './scriptMission';

describe('ScriptMission', () => {
  const script = '안녕하세요 반갑습니다 오늘 날씨가 좋네요';

  it('미시작 상태 timeScore=0', () => {
    const m = new ScriptMission({ script });
    expect(m.timeScore()).toBe(0);
  });

  it('정확 낭독 + 목표 시간 내 → 100 근접', () => {
    const m = new ScriptMission({ script, targetReadMs: 8000 });
    m.begin(0);
    m.update(script, 5000);
    m.finish(5000);
    expect(m.totalScore()).toBe(100);
  });

  it('절반만 일치 → similarity↓, completion↓', () => {
    const m = new ScriptMission({ script, targetReadMs: 8000 });
    m.begin(0);
    m.update('안녕하세요 반갑습니다', 5000);
    m.finish(5000);
    expect(m.similarity()).toBeLessThan(1);
    expect(m.completion()).toBeCloseTo(2 / 5, 2); // 2 out of 5 words
  });

  it('완전히 다른 말 → 낮은 점수', () => {
    const m = new ScriptMission({ script, targetReadMs: 8000 });
    m.begin(0);
    m.update('고양이 강아지 사자', 5000);
    m.finish(5000);
    expect(m.totalScore()).toBeLessThan(40);
  });

  it('시간 초과 → timeScore < 1', () => {
    const m = new ScriptMission({ script, targetReadMs: 8000 });
    m.begin(0);
    m.update(script, 16000);
    m.finish(16000);
    expect(m.timeScore()).toBeCloseTo(0.5, 2);
  });

  it('시간 초과해도 minTimeScore 이상', () => {
    const m = new ScriptMission({ script, targetReadMs: 8000, minTimeScore: 0.3 });
    m.begin(0);
    m.update(script, 100000);
    m.finish(100000);
    expect(m.timeScore()).toBe(0.3);
  });

  it('reset() 초기화', () => {
    const m = new ScriptMission({ script });
    m.begin(0); m.update(script, 1000); m.finish(1000);
    m.reset();
    expect(m.getState().started).toBe(false);
    expect(m.totalScore()).toBe(0);
  });
});
