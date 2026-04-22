/**
 * scriptPrompterMission.test.ts — STT-free script mission.
 */
import { describe, it, expect } from 'vitest';
import { ScriptPrompterMission, pickScript } from './scriptPrompterMission';

describe('ScriptPrompterMission', () => {
  it('begin → finish 없으면 점수 0 베이스라인', () => {
    const m = new ScriptPrompterMission({ script: '안녕하세요', expectedReadMs: 5_000 });
    expect(m.completion()).toBe(0);
    expect(m.readingPace()).toBeGreaterThanOrEqual(0.3); // floor
  });

  it('기대 시간에 정확히 맞춰 끝내면 만점대', () => {
    const m = new ScriptPrompterMission({ script: '테스트', expectedReadMs: 10_000 });
    m.begin(0);
    // 모든 프레임 visible=true
    for (let t = 100; t <= 10_000; t += 100) m.tick(t, { visible: true });
    m.finish(10_000);
    expect(m.completion()).toBe(1);
    expect(m.readingPace()).toBe(1);
    expect(m.presence()).toBe(1);
    expect(m.totalScore()).toBe(100);
  });

  it('절반만 읽으면 completion 0.5, pace 감점', () => {
    const m = new ScriptPrompterMission({ script: 'x', expectedReadMs: 10_000 });
    m.begin(0);
    m.tick(2500, { visible: true });
    m.finish(5_000);
    expect(m.completion()).toBe(0.5);
    // pace = 1 - |5000-10000|/10000 = 1 - 0.5 = 0.5
    expect(m.readingPace()).toBeCloseTo(0.5, 2);
  });

  it('너무 길게 끌면 pace 가 floor 로 떨어짐', () => {
    const m = new ScriptPrompterMission({ script: 'x', expectedReadMs: 5_000, paceFloor: 0.3 });
    m.begin(0);
    m.finish(25_000); // 5배
    // raw = 1 - |25000-5000|/5000 = 1 - 4 = -3 → clamp 0.3
    expect(m.readingPace()).toBe(0.3);
    expect(m.completion()).toBe(1);
  });

  it('presence: 절반 프레임만 visible → 0.5', () => {
    const m = new ScriptPrompterMission({ script: 'x', expectedReadMs: 4_000 });
    m.begin(0);
    for (let i = 0; i < 10; i++) m.tick(i * 100, { visible: i % 2 === 0 });
    m.finish(4_000);
    expect(m.presence()).toBeCloseTo(0.5, 2);
  });

  it('reset() 상태 초기화', () => {
    const m = new ScriptPrompterMission({ script: 'x', expectedReadMs: 1000 });
    m.begin(0); m.tick(500, { visible: true }); m.finish(1000);
    expect(m.totalScore()).toBeGreaterThan(0);
    m.reset();
    expect(m.completion()).toBe(0);
  });

  it('pickScript: string 그대로, 배열이면 인덱스', () => {
    expect(pickScript('hello')).toBe('hello');
    const pool = ['a', 'b', 'c'];
    expect(pickScript(pool, () => 0)).toBe('a');
    expect(pickScript(pool, () => 0.99)).toBe('c');
    expect(pickScript(pool, () => 0.5)).toBe('b');
  });

  it('pickScript: 빈 배열 → 빈 문자열 (방어)', () => {
    expect(pickScript([])).toBe('');
  });
});
