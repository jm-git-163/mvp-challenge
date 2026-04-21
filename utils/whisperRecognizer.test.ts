/**
 * utils/whisperRecognizer.test.ts
 *
 * FIX-I: Whisper 인식기 최소 동작 검증.
 * 실제 @xenova/transformers 는 mock 하여 단위 테스트 독립성 확보.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// @xenova/transformers 모킹 — pipeline 호출 시 모의 ASR 함수 반환
vi.mock('@xenova/transformers', () => {
  const mockAsr = vi.fn(async (_pcm: Float32Array) => ({ text: '안녕하세요' }));
  return {
    pipeline: vi.fn(async () => mockAsr),
    env: { useBrowserCache: false, useFSCache: false },
    __mockAsr: mockAsr,
  };
});

import { WhisperRecognizer } from './whisperRecognizer';

describe('WhisperRecognizer — 인터페이스', () => {
  beforeEach(() => {
    // 각 테스트마다 새 인스턴스
  });

  it('isSupported() — 브라우저 API 있으면 true', () => {
    const r = new WhisperRecognizer();
    // jsdom 에 AudioContext 없을 수 있음 → 존재 확인만
    expect(typeof r.isSupported()).toBe('boolean');
  });

  it('초기 상태 — not listening, diagnostic 0 값', () => {
    const r = new WhisperRecognizer();
    expect(r.isListening()).toBe(false);
    const d = r.getDiagnostic();
    expect(d.listening).toBe(false);
    expect(d.starts).toBe(0);
    expect(d.results).toBe(0);
    expect(d.error).toBeNull();
  });

  it('setTargetText / resetForNextMission — 외부 상태 조작', () => {
    const r = new WhisperRecognizer();
    r.setTargetText('안녕하세요');
    r.resetForNextMission();
    // 공개 상태는 없지만 메서드가 throw 없이 끝나면 OK
    expect(true).toBe(true);
  });

  it('지원 안됨 상태에서 listen → onFinal("") 호출', async () => {
    const r = new WhisperRecognizer();
    // supported 강제 false
    (r as any).supported = false;
    const final = vi.fn();
    r.listen('ko', () => {}, final);
    await new Promise((res) => setTimeout(res, 150));
    expect(final).toHaveBeenCalledWith('');
  });

  it('stop() — 리스닝 안하는 상태에서 호출해도 throw 없음', () => {
    const r = new WhisperRecognizer();
    expect(() => r.stop()).not.toThrow();
  });

  it('getDiagnostic — 카운터·에러·transcript 반영', () => {
    const r = new WhisperRecognizer();
    (r as any).startCount = 3;
    (r as any).resultCount = 7;
    (r as any).lastError = 'oops';
    (r as any).lastTranscript = '테스트';
    const d = r.getDiagnostic();
    expect(d.starts).toBe(3);
    expect(d.results).toBe(7);
    expect(d.error).toBe('oops');
    expect(d.transcript).toBe('테스트');
  });
});
