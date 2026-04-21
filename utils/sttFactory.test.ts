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

describe('resolveSttEngine', () => {
  beforeEach(() => {
    _resetSttCache();
    try { window.localStorage.clear(); } catch {}
    setLocation('');
    // @ts-ignore
    if (typeof process !== 'undefined') delete process.env.EXPO_PUBLIC_STT_ENGINE;
  });

  it('기본값은 webkit', () => {
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('?stt=whisper → whisper + localStorage 저장', () => {
    setLocation('?stt=whisper');
    expect(resolveSttEngine()).toBe('whisper');
    expect(window.localStorage.getItem('motiq_stt')).toBe('whisper');
  });

  it('?stt=webkit 명시 → webkit + localStorage 저장', () => {
    setLocation('?stt=webkit');
    expect(resolveSttEngine()).toBe('webkit');
    expect(window.localStorage.getItem('motiq_stt')).toBe('webkit');
  });

  it('localStorage sticky → URL 쿼리 없어도 유지', () => {
    window.localStorage.setItem('motiq_stt', 'whisper');
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('URL 쿼리가 localStorage 를 덮어쓴다', () => {
    window.localStorage.setItem('motiq_stt', 'whisper');
    setLocation('?stt=webkit');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('env EXPO_PUBLIC_STT_ENGINE 반영', () => {
    // @ts-ignore
    process.env.EXPO_PUBLIC_STT_ENGINE = 'whisper';
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('값 캐싱 — 두 번째 호출은 재평가 없음', () => {
    setLocation('?stt=whisper');
    const first = resolveSttEngine();
    setLocation('?stt=webkit');  // 변경해도
    const second = resolveSttEngine();
    expect(second).toBe(first);   // 캐시됨
  });
});
