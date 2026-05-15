/**
 * engine/composition/speechBridge.test.ts
 *
 * Focused Session-4 Candidate L 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  wrapInterimCallback,
  wrapFinalCallback,
  makeSpeechBridge,
  resetLiveState,
} from './speechBridge';
import { getLiveState } from './liveState';

describe('speechBridge — Session-4 L', () => {
  beforeEach(() => resetLiveState());

  it('wrapInterimCallback: liveState.speechInterim 갱신 + 원 콜백 호출', () => {
    const cb = vi.fn();
    const wrapped = wrapInterimCallback(cb);
    wrapped('안녕');
    expect(getLiveState().speechInterim).toBe('안녕');
    expect(getLiveState().speechTranscript).toBe('');
    expect(cb).toHaveBeenCalledWith('안녕');
  });

  it('wrapFinalCallback: speechTranscript 갱신 + interim 비움', () => {
    const cb = vi.fn();
    const wrapped = wrapFinalCallback(cb);
    // 이전 interim 이 있는 상태
    wrapInterimCallback()('진행중');
    expect(getLiveState().speechInterim).toBe('진행중');
    wrapped('최종 텍스트입니다.');
    expect(getLiveState().speechTranscript).toBe('최종 텍스트입니다.');
    expect(getLiveState().speechInterim).toBe('');
    expect(cb).toHaveBeenCalledWith('최종 텍스트입니다.');
  });

  it('사용자 콜백 없이도 동작 (undefined cb)', () => {
    expect(() => wrapInterimCallback(undefined)('x')).not.toThrow();
    expect(() => wrapFinalCallback()('y')).not.toThrow();
    expect(getLiveState().speechTranscript).toBe('y');
  });

  it('사용자 콜백이 throw 해도 liveState 는 이미 갱신', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const wrapped = wrapInterimCallback(bad);
    expect(() => wrapped('hello')).not.toThrow();
    expect(getLiveState().speechInterim).toBe('hello');
    expect(bad).toHaveBeenCalled();
  });

  it('makeSpeechBridge: 한 번에 페어 생성 + reset 으로 speech 만 비움', () => {
    const onInterim = vi.fn();
    const onFinal = vi.fn();
    const b = makeSpeechBridge({ onInterim, onFinal });
    b.onInterim('a');
    b.onFinal('b');
    expect(getLiveState().speechTranscript).toBe('b');
    expect(onInterim).toHaveBeenCalledWith('a');
    expect(onFinal).toHaveBeenCalledWith('b');
    b.reset();
    expect(getLiveState().speechTranscript).toBe('');
    expect(getLiveState().speechInterim).toBe('');
  });

  it('null/undefined 입력 → 빈 문자열로 정규화', () => {
    const w = wrapInterimCallback();
    w(undefined as unknown as string);
    expect(getLiveState().speechInterim).toBe('');
    const wf = wrapFinalCallback();
    wf(null as unknown as string);
    expect(getLiveState().speechTranscript).toBe('');
  });
});
