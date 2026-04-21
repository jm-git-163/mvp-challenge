/**
 * utils/sttFactory.test.ts — STT 엔진 선택 로직 검증.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSttEngine, _resetSttCache } from './sttFactory';

function setLocation(search: string): void {
  // jsdom 의 window.location 은 readonly 지만 href 변경으로 검색 파라미터 갱신 가능
  const url = new URL('https://example.test/record' + search);
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: url.search, href: url.href },
    writable: true,
  });
}

describe('resolveSttEngine (WHISPER_ENABLED=false 잠금 상태)', () => {
  beforeEach(() => {
    _resetSttCache();
    try { window.localStorage.clear(); } catch {}
    setLocation('');
    // @ts-ignore
    if (typeof process !== 'undefined') delete process.env.EXPO_PUBLIC_STT_ENGINE;
  });

  // FIX-I7: 현재 Whisper 엔진은 프로덕션 미준비로 강제 webkit 잠금.
  //   Session 2 (Worker 격리 + WASM 경로 수동 지정) 완료 후 아래 테스트들을
  //   원래의 우선순위 검증으로 복원한다.

  it('기본값은 webkit', () => {
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('?stt=whisper 무시 (잠금) → webkit', () => {
    setLocation('?stt=whisper');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('localStorage sticky=whisper 무시 (잠금) → webkit', () => {
    window.localStorage.setItem('motiq_stt', 'whisper');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('env EXPO_PUBLIC_STT_ENGINE=whisper 무시 (잠금) → webkit', () => {
    // @ts-ignore
    process.env.EXPO_PUBLIC_STT_ENGINE = 'whisper';
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('캐싱 동작 유지', () => {
    const first = resolveSttEngine();
    const second = resolveSttEngine();
    expect(second).toBe(first);
  });
});
