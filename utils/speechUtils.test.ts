/**
 * utils/speechUtils.test.ts
 *
 * FIX-Z20 (2026-04-22): onerror 자동 재시도 로직 검증.
 *  - no-speech / audio-capture / network 에러 시 1초 후 start() 재호출
 *  - 5회 초과 시 give-up 로 전환
 *  - onresult 수신 시 retryCountRef 리셋
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechRecognizer } from './speechUtils';

class MockRec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onend: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onstart: any = null;
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  lang = 'ko-KR';
  startCalls = 0;
  start = vi.fn(() => { this.startCalls++; });
  stop = vi.fn();
}

describe('SpeechRecognizer auto-retry (FIX-Z20)', () => {
  let mockRec: MockRec;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRec = new MockRec();
    vi.stubGlobal('window', {
      SpeechRecognition: function () { return mockRec; },
    });
    vi.stubGlobal('navigator', { userAgent: 'desktop' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('no-speech 에러 시 1초 후 start() 재호출', () => {
    const sr = new SpeechRecognizer();
    sr.listen('ko', () => {}, () => {}, 30_000);
    const before = mockRec.startCalls;
    mockRec.onerror({ error: 'no-speech' });
    // 아직 setTimeout 실행 전
    expect(mockRec.startCalls).toBe(before);
    vi.advanceTimersByTime(1000);
    expect(mockRec.startCalls).toBe(before + 1);
    expect(sr.lastEvent).toContain('auto-retry');
  });

  it('audio-capture / network 에러도 자동 재시도 대상', () => {
    const sr = new SpeechRecognizer();
    sr.listen('ko', () => {}, () => {}, 30_000);
    const before = mockRec.startCalls;
    mockRec.onerror({ error: 'audio-capture' });
    vi.advanceTimersByTime(1000);
    expect(mockRec.startCalls).toBe(before + 1);
    mockRec.onerror({ error: 'network' });
    vi.advanceTimersByTime(1000);
    expect(mockRec.startCalls).toBe(before + 2);
  });

  it('5회 초과 시 give-up 으로 전환', () => {
    const sr = new SpeechRecognizer();
    sr.listen('ko', () => {}, () => {}, 30_000);
    for (let i = 0; i < 5; i++) {
      mockRec.onerror({ error: 'no-speech' });
      vi.advanceTimersByTime(1000);
    }
    // 6번째 에러 → give-up
    mockRec.onerror({ error: 'no-speech' });
    vi.advanceTimersByTime(1000);
    expect(sr.lastEvent).toContain('give-up');
    expect(sr.lastError).toContain('5회');
  });

  it('onresult 수신 시 retry 카운터 리셋', () => {
    const sr = new SpeechRecognizer();
    sr.listen('ko', () => {}, () => {}, 30_000);
    // 2번 실패
    mockRec.onerror({ error: 'no-speech' });
    vi.advanceTimersByTime(1000);
    mockRec.onerror({ error: 'no-speech' });
    vi.advanceTimersByTime(1000);
    // 성공적 결과 → 카운터 리셋
    // SpeechRecognitionResultList 의 단순 스텁: 인덱싱 가능한 배열로 충분.
    const fakeResults: any = [
      Object.assign([{ transcript: 'hello' }], { isFinal: true }),
    ];
    mockRec.onresult({ resultIndex: 0, results: fakeResults });
    // 이후 실패해도 give-up 아닌 retry 로 처리돼야 함
    for (let i = 0; i < 4; i++) {
      mockRec.onerror({ error: 'no-speech' });
      vi.advanceTimersByTime(1000);
    }
    expect(sr.lastEvent).not.toContain('give-up');
  });
});
