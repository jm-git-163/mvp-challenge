/**
 * utils/sttFactory.test.ts — STT 엔진 선택 로직 검증.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveSttEngine, _resetSttCache } from './sttFactory';

function setLocation(search: string): void {
  // jsdom 의 window.location 은 readonly 지만 href 변경으로 검색 파라미터 갱신 가능
  const url = new URL('https://example.test/record' + search);
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: url.search, href: url.href },
    writable: true,
  });
}

function setUA(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

describe('resolveSttEngine (WHISPER_ENABLED=true, FIX-Y5)', () => {
  beforeEach(() => {
    _resetSttCache();
    try { window.localStorage.clear(); } catch {}
    setLocation('');
    // @ts-ignore
    if (typeof process !== 'undefined') delete process.env.EXPO_PUBLIC_STT_ENGINE;
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  });

  it('데스크톱 UA → webkit', () => {
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('Android UA → whisper (자동)', () => {
    setUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120');
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('iPhone UA → whisper (자동)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605');
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('?stt=webkit 오버라이드 (모바일에서도 webkit)', () => {
    setUA('Mozilla/5.0 (Linux; Android 13) Mobile');
    setLocation('?stt=webkit');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('?stt=whisper 오버라이드 (데스크톱에서도 whisper)', () => {
    setLocation('?stt=whisper');
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('localStorage sticky 우선', () => {
    setUA('Mozilla/5.0 (Linux; Android)');
    window.localStorage.setItem('motiq_stt', 'webkit');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('캐싱 동작 유지', () => {
    const first = resolveSttEngine();
    const second = resolveSttEngine();
    expect(second).toBe(first);
  });
});
