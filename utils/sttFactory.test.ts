/**
 * utils/sttFactory.test.ts — STT 엔진 선택 로직 검증.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveSttEngine, _resetSttCache } from './sttFactory';

function setLocation(search: string): void {
  const url = new URL('https://example.test/record' + search);
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: url.search, href: url.href },
    writable: true,
  });
}

function setUA(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

// FIX-Z1: Whisper 다시 잠금(프로덕션 미준비). 디버그용 ?stt=whisper 오버라이드만 통과.
describe('resolveSttEngine (WHISPER_ENABLED=false, FIX-Z1)', () => {
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

  it('모바일 UA 도 webkit (Whisper 잠금)', () => {
    setUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('?stt=whisper 만 통과 (개발자 오버라이드)', () => {
    setLocation('?stt=whisper');
    expect(resolveSttEngine()).toBe('whisper');
  });

  it('localStorage sticky=whisper 무시 (잠금)', () => {
    window.localStorage.setItem('motiq_stt', 'whisper');
    expect(resolveSttEngine()).toBe('webkit');
  });

  it('캐싱 동작 유지', () => {
    const first = resolveSttEngine();
    const second = resolveSttEngine();
    expect(second).toBe(first);
  });
});
