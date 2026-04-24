/**
 * scriptPrompterMission.test.ts — STT-free script mission.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptPrompterMission, pickScript, pickScriptWithHistory, computeLineDuration } from './scriptPrompterMission';

describe('computeLineDuration (FIX-PROMPTER-PACING 2026-04-24)', () => {
  it('짧은 문장(5자)은 하한 2500ms 로 클램프', () => {
    // 5 * 200 = 1000 → 2500 floor.
    expect(computeLineDuration('안녕하세요')).toBe(2500);
  });
  it('중간 길이(30자)는 선형 (chars*200)', () => {
    const t = '가'.repeat(30);
    // 30 * 200 = 6000 (in [2500, 8000])
    expect(computeLineDuration(t)).toBe(6000);
  });
  it('긴 문장(100자)은 상한 8000ms 로 클램프', () => {
    const t = '가'.repeat(100);
    // 100 * 200 = 20000 → 8000 ceiling.
    expect(computeLineDuration(t)).toBe(8000);
  });
  it('빈 문자열도 하한 (defensive)', () => {
    expect(computeLineDuration('')).toBe(2500);
  });
  it('opts override 가능', () => {
    expect(computeLineDuration('가'.repeat(10), { msPerChar: 100, minMs: 0, maxMs: 100000 })).toBe(1000);
  });
});

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

// FIX-SCRIPT-POOL (2026-04-23): 히스토리 기반 로테이션 — localStorage 모킹.
//   vitest 환경이 'node' 라 window 가 기본 없음. 인메모리 storage stub 주입.
describe('pickScriptWithHistory', () => {
  const memStore: Record<string, string> = {};
  const fakeLocalStorage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: () => null,
    length: 0,
  };

  beforeEach(() => {
    fakeLocalStorage.clear();
    (globalThis as any).window = { localStorage: fakeLocalStorage };
  });

  it('단일 엔트리 풀은 언제나 그 값', () => {
    expect(pickScriptWithHistory(['only'], 't', 'm')).toBe('only');
  });

  it('빈 풀 방어 → 빈 문자열', () => {
    expect(pickScriptWithHistory([], 't', 'm')).toBe('');
  });

  it('결정론적 rng 로 히스토리 제외 검증 (pool=5, history=3)', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    // rng=0 → 후보 중 첫 번째.
    const first  = pickScriptWithHistory(pool, 't1', 'm1', { rng: () => 0 });
    expect(first).toBe('a');
    // 두 번째 호출 — history=[0] 이므로 후보 = [1,2,3,4], rng=0 → idx 1 → 'b'.
    const second = pickScriptWithHistory(pool, 't1', 'm1', { rng: () => 0 });
    expect(second).toBe('b');
    // 세 번째 — history=[1,0], 후보=[2,3,4], rng=0 → 'c'.
    const third  = pickScriptWithHistory(pool, 't1', 'm1', { rng: () => 0 });
    expect(third).toBe('c');
    // 네 번째 — history=[2,1,0] (size=3), 후보=[3,4], rng=0 → 'd'. 'a' 는 여전히 제외.
    const fourth = pickScriptWithHistory(pool, 't1', 'm1', { rng: () => 0 });
    expect(fourth).toBe('d');
    expect(['a','b','c']).not.toContain(fourth);
  });

  it('pool 크기 ≤ historySize+1 이면 히스토리 무시하고 전체에서 선택 (폴백)', () => {
    // pool=3, historySize=3 → pool.length > historySize 거짓 → excluded 비움.
    const pool = ['x', 'y', 'z'];
    const r1 = pickScriptWithHistory(pool, 't', 'm', { historySize: 3, rng: () => 0 });
    const r2 = pickScriptWithHistory(pool, 't', 'm', { historySize: 3, rng: () => 0 });
    // 둘 다 rng=0 → 'x' (제외 없음).
    expect(r1).toBe('x');
    expect(r2).toBe('x');
  });

  it('templateId/missionId 가 다르면 히스토리 분리', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    pickScriptWithHistory(pool, 'tA', 'm1', { rng: () => 0 }); // 'a'
    // 다른 missionId → 자체 히스토리 비어 있음.
    const r = pickScriptWithHistory(pool, 'tA', 'm2', { rng: () => 0 });
    expect(r).toBe('a');
  });

  it('SSR 안전: window undefined 시뮬 — pickScript 처럼 동작', () => {
    const orig = (globalThis as any).window;
    delete (globalThis as any).window;
    try {
      const r = pickScriptWithHistory(['a', 'b', 'c'], 't', 'm', { rng: () => 0 });
      expect(r).toBe('a');
      const r2 = pickScriptWithHistory(['a', 'b', 'c'], 't', 'm', { rng: () => 0.999 });
      expect(r2).toBe('c');
    } finally {
      (globalThis as any).window = orig;
    }
  });
});
