import { describe, it, expect } from 'vitest';
import { classifyError } from './errorClassifier';

function err(name: string, message = name): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('classifyError', () => {
  it('NotAllowedError → permission', () => {
    const c = classifyError(err('NotAllowedError'));
    expect(c.category).toBe('permission');
    expect(c.recoverable).toBe(true);
  });
  it('NotFoundError → notfound', () => {
    expect(classifyError(err('NotFoundError')).category).toBe('notfound');
  });
  it('NotReadableError → busy', () => {
    expect(classifyError(err('NotReadableError')).category).toBe('busy');
  });
  it('OverconstrainedError → overconstrained', () => {
    expect(classifyError(err('OverconstrainedError')).category).toBe('overconstrained');
  });
  it('SecurityError → security, 복구 불가', () => {
    const c = classifyError(err('SecurityError'));
    expect(c.category).toBe('security');
    expect(c.recoverable).toBe(false);
  });
  it('AbortError → aborted', () => {
    expect(classifyError(err('AbortError')).category).toBe('aborted');
  });
  it('quota 메시지 → storage', () => {
    expect(classifyError(new Error('QuotaExceeded: storage full')).category).toBe('storage');
  });
  it('codec 메시지 → codec', () => {
    expect(classifyError(new Error('Unsupported MediaRecorder codec')).category).toBe('codec');
  });
  it('timeout → timeout', () => {
    expect(classifyError(err('TimeoutError')).category).toBe('timeout');
  });
  it('failed to fetch → network', () => {
    expect(classifyError(new Error('Failed to fetch')).category).toBe('network');
  });
  it('기타 Error → internal', () => {
    const c = classifyError(new Error('boom'));
    expect(c.category).toBe('internal');
    expect(c.recoverable).toBe(true);
  });
  it('문자열 → unknown', () => {
    expect(classifyError('weird string').category).toBe('unknown');
  });
  it('undefined → unknown', () => {
    expect(classifyError(undefined).category).toBe('unknown');
  });
  it('play() 실패 → camera-play-failed', () => {
    expect(classifyError(new Error('video.play() failed: autoplay')).category).toBe('camera-play-failed');
  });
  it('videoWidth 준비 안됨 → camera-not-ready', () => {
    expect(classifyError(new Error('videoWidth=0 not ready')).category).toBe('camera-not-ready');
  });
  it('navigation cleanup 실패 → navigation-cleanup-failed', () => {
    expect(classifyError(new Error('unmount cleanup failed')).category).toBe('navigation-cleanup-failed');
  });
  it('debugDetail 은 원본 정보 포함', () => {
    const c = classifyError(err('NotAllowedError', 'denied by user'));
    expect(c.debugDetail).toContain('NotAllowedError');
    expect(c.debugDetail).toContain('denied');
  });
});
