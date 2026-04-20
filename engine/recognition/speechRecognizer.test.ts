import { describe, it, expect, vi } from 'vitest';
import {
  normalizeKorean,
  levenshtein,
  similarity,
  completion,
  SpeechRecognizer,
  type RecognitionLike,
  type SpeechResultEvent,
} from './speechRecognizer';

// ─── 텍스트 유틸 ────────────────────────────────────────────────────────────

describe('normalizeKorean', () => {
  it('공백/구두점 제거', () => {
    expect(normalizeKorean('안녕하세요,  반갑습니다!')).toBe('안녕하세요 반갑습니다');
  });
  it('소문자화', () => {
    expect(normalizeKorean('Hello World')).toBe('hello world');
  });
});

describe('levenshtein', () => {
  it('동일 문자열 거리 0', () => {
    expect(levenshtein('kitten', 'kitten')).toBe(0);
  });
  it('kitten → sitting = 3', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
  it('빈 문자열과의 거리 = 길이', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('한글 거리', () => {
    expect(levenshtein('사과', '사과')).toBe(0);
    expect(levenshtein('사과', '과자')).toBe(2);
  });
});

describe('similarity', () => {
  it('동일 문장 → 1', () => {
    expect(similarity('안녕하세요', '안녕하세요')).toBe(1);
  });
  it('완전히 다름 → 낮은 값', () => {
    expect(similarity('안녕', '고양이')).toBeLessThan(0.5);
  });
  it('구두점만 다르면 ≈1', () => {
    expect(similarity('안녕하세요!', '안녕하세요.')).toBe(1);
  });
});

describe('completion', () => {
  it('모든 단어 포함 → 1', () => {
    expect(completion('나는 학교에 간다', '나는 학교에 간다')).toBe(1);
  });
  it('절반만 포함 → 0.5', () => {
    expect(completion('나는 학교에', '나는 학교에 간다 오늘')).toBeCloseTo(0.5, 2);
  });
  it('빈 스크립트 → 1', () => {
    expect(completion('뭐든', '')).toBe(1);
  });
});

// ─── 래퍼 ───────────────────────────────────────────────────────────────────

function makeFakeCtor() {
  const instances: FakeRec[] = [];
  class FakeRec implements RecognitionLike {
    lang = '';
    continuous = false;
    interimResults = false;
    onresult: ((e: SpeechResultEvent) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    started = false; stopped = false;
    constructor() { instances.push(this); }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.onend?.(); }
    emitFinal(t: string) {
      this.onresult?.({ results: [{ isFinal: true, transcript: t }] });
    }
    emitInterim(t: string) {
      this.onresult?.({ results: [{ isFinal: false, transcript: t }] });
    }
    emitEnd() { this.onend?.(); }
    emitError(e: string) { this.onerror?.({ error: e }); }
  }
  return { Ctor: FakeRec as unknown as new () => RecognitionLike, instances };
}

describe('SpeechRecognizer lifecycle', () => {
  it('isSupported=false면 start 즉시 error', () => {
    const r = new SpeechRecognizer({}, { ctor: undefined });
    expect(r.isSupported()).toBe(false);
    r.start();
    expect(r.getState()).toBe('error');
  });

  it('start → running, final 결과 누적', () => {
    const { Ctor, instances } = makeFakeCtor();
    const r = new SpeechRecognizer({}, { ctor: Ctor });
    r.start();
    expect(r.getState()).toBe('running');
    const fake = instances[0] as unknown as { emitFinal: (t: string) => void };
    fake.emitFinal('안녕');
    fake.emitFinal('반갑습니다');
    expect(r.getTranscript()).toBe('안녕 반갑습니다');
  });

  it('interim은 transcript에 포함 안 되지만 subscribe 콜백으로 전달', () => {
    const { Ctor, instances } = makeFakeCtor();
    const r = new SpeechRecognizer({}, { ctor: Ctor });
    const states: Array<{ final: string; interim: string }> = [];
    r.subscribe((s) => states.push({ final: s.final, interim: s.interim }));
    r.start();
    const fake = instances[0] as unknown as { emitInterim: (t: string) => void };
    fake.emitInterim('안녕하...');
    expect(r.getTranscript()).toBe('');
    expect(states.at(-1)?.interim).toBe('안녕하...');
  });

  it('iOS: onend 시 setTimeout 예약으로 재시작', () => {
    const { Ctor, instances } = makeFakeCtor();
    const timeouts: Array<() => void> = [];
    const r = new SpeechRecognizer({}, {
      ctor: Ctor,
      isIOS: true,
      setTimeout: (cb) => { timeouts.push(cb); return 0; },
    });
    r.start();
    (instances[0] as unknown as { emitEnd: () => void }).emitEnd();
    expect(timeouts.length).toBe(1);
    timeouts[0](); // run delayed restart
    expect(instances.length).toBe(2);
    expect(r.getState()).toBe('running');
  });

  it('non-iOS: onend → 재시작 없이 ended 상태', () => {
    const { Ctor, instances } = makeFakeCtor();
    const r = new SpeechRecognizer({}, { ctor: Ctor, isIOS: false });
    r.start();
    (instances[0] as unknown as { emitEnd: () => void }).emitEnd();
    expect(r.getState()).toBe('ended');
    expect(instances.length).toBe(1);
  });

  it('not-allowed 에러 → shouldRun=false, error 상태', () => {
    const { Ctor, instances } = makeFakeCtor();
    const r = new SpeechRecognizer({}, { ctor: Ctor, isIOS: true, setTimeout: (cb) => { cb(); return 0; } });
    r.start();
    (instances[0] as unknown as { emitError: (e: string) => void }).emitError('not-allowed');
    (instances[0] as unknown as { emitEnd: () => void }).emitEnd();
    expect(r.getState()).toBe('error');
    expect(instances.length).toBe(1); // 재시작 안 됨
  });

  it('연속 실패 3회 초과 시 재시작 중단', () => {
    const { Ctor, instances } = makeFakeCtor();
    const r = new SpeechRecognizer({ maxConsecutiveErrors: 3 }, {
      ctor: Ctor, isIOS: true, setTimeout: (cb) => { cb(); return 0; },
    });
    r.start();
    for (let i = 0; i < 5; i++) {
      const last = instances.at(-1) as unknown as { emitError: (e: string) => void; emitEnd: () => void };
      last.emitError('network');
      last.emitEnd();
    }
    expect(r.getState()).toBe('error');
  });

  it('stop() 호출 후 onend 재시작 안 함', () => {
    const { Ctor, instances } = makeFakeCtor();
    const timeouts: Array<() => void> = [];
    const r = new SpeechRecognizer({}, {
      ctor: Ctor, isIOS: true, setTimeout: (cb) => { timeouts.push(cb); return 0; },
    });
    r.start();
    r.stop();
    timeouts.forEach(t => t());
    expect(instances.length).toBe(1);
    expect(r.getState()).toBe('ended');
  });
});
