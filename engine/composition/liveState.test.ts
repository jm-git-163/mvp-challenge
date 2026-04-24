/**
 * engine/composition/liveState.test.ts
 *
 * Focused Session-3 Candidate G 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLiveState,
  setSpeechTranscript,
  setBeatIntensity,
  setMissionState,
  resetLiveState,
  subscribeLiveState,
  mergeLiveIntoState,
} from './liveState';

describe('liveState 싱글톤', () => {
  beforeEach(() => resetLiveState());

  it('초기값: 모두 공백/0/빈객체', () => {
    const s = getLiveState();
    expect(s.speechTranscript).toBe('');
    expect(s.speechInterim).toBe('');
    expect(s.beatIntensity).toBe(0);
    expect(s.missionState).toEqual({});
  });

  it('setSpeechTranscript: final + interim 동시 반영', () => {
    setSpeechTranscript('안녕하세요.', '스쿼');
    const s = getLiveState();
    expect(s.speechTranscript).toBe('안녕하세요.');
    expect(s.speechInterim).toBe('스쿼');
  });

  it('setBeatIntensity: 0~1 범위 clamp', () => {
    setBeatIntensity(2.5);
    expect(getLiveState().beatIntensity).toBe(1);
    setBeatIntensity(-0.3);
    expect(getLiveState().beatIntensity).toBe(0);
    setBeatIntensity(0.7);
    expect(getLiveState().beatIntensity).toBeCloseTo(0.7);
  });

  it('setMissionState: partial 병합 유지', () => {
    setMissionState({ repCount: 3 });
    setMissionState({ lastTag: 'perfect' });
    const s = getLiveState();
    expect(s.missionState.repCount).toBe(3);
    expect(s.missionState.lastTag).toBe('perfect');
  });

  it('resetLiveState: 모든 필드 초기화', () => {
    setSpeechTranscript('X', 'Y');
    setBeatIntensity(0.5);
    setMissionState({ repCount: 10 });
    resetLiveState();
    const s = getLiveState();
    expect(s.speechTranscript).toBe('');
    expect(s.beatIntensity).toBe(0);
    expect(s.missionState).toEqual({});
  });

  it('getLiveState: 동일 객체 ref 유지 (hot-path 할당 없음)', () => {
    const a = getLiveState();
    setBeatIntensity(0.5);
    const b = getLiveState();
    expect(a).toBe(b);
  });

  it('subscribeLiveState: setter 호출 시 listener 실행', () => {
    const cb = vi.fn();
    const unsub = subscribeLiveState(cb);
    setSpeechTranscript('hi');
    expect(cb).toHaveBeenCalled();
    unsub();
    cb.mockClear();
    setSpeechTranscript('bye');
    expect(cb).not.toHaveBeenCalled();
  });

  it('subscribe: listener 에러는 격리됨 (다른 리스너 실행 유지)', () => {
    const ok = vi.fn();
    const bad = vi.fn(() => { throw new Error('boom'); });
    subscribeLiveState(bad);
    subscribeLiveState(ok);
    expect(() => setBeatIntensity(0.1)).not.toThrow();
    expect(ok).toHaveBeenCalled();
  });

  it('mergeLiveIntoState: 기존 state 키는 우선(오버라이드), 나머지는 live 주입', () => {
    setSpeechTranscript('live 전사');
    setBeatIntensity(0.4);
    const merged = mergeLiveIntoState({ videoEl: 'X' as any, beatIntensity: 0.9 });
    expect(merged.speechTranscript).toBe('live 전사');
    expect(merged.beatIntensity).toBe(0.9); // 수동 오버라이드가 이김
    expect((merged as any).videoEl).toBe('X');
  });

  it('mergeLiveIntoState: 빈 state 도 안전', () => {
    setSpeechTranscript('A');
    const merged = mergeLiveIntoState({});
    expect(merged.speechTranscript).toBe('A');
    expect(merged.missionState).toBeDefined();
  });
});
