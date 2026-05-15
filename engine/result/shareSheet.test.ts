import { describe, it, expect, vi } from 'vitest';
import { shareResult, makeResultFilename } from './shareSheet';

function blob() {
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
}

describe('shareResult', () => {
  it('navigator.share 성공 → shared', async () => {
    const share = vi.fn(async () => {});
    const r = await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      { share, canShareFiles: () => true },
    );
    expect(r).toEqual({ kind: 'shared' });
    expect(share).toHaveBeenCalled();
  });

  it('사용자 취소(AbortError) → cancelled', async () => {
    const err = new Error('aborted');
    (err as Error & { name: string }).name = 'AbortError';
    const share = vi.fn(async () => { throw err; });
    const r = await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      { share, canShareFiles: () => true, triggerDownload: vi.fn() },
    );
    expect(r).toEqual({ kind: 'cancelled' });
  });

  it('share 실패 (비-abort) → 다운로드 폴백', async () => {
    const share = vi.fn(async () => { throw new Error('nope'); });
    const trigger = vi.fn();
    const r = await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      {
        share, canShareFiles: () => true, triggerDownload: trigger,
        createObjectURL: () => 'blob:xyz', revokeObjectURL: () => {},
      },
    );
    expect(r).toEqual({ kind: 'downloaded' });
    expect(trigger).toHaveBeenCalledWith('blob:xyz', 'f.mp4');
  });

  it('share 미지원 → 바로 다운로드', async () => {
    const trigger = vi.fn();
    const r = await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      {
        share: null, canShareFiles: null, triggerDownload: trigger,
        createObjectURL: () => 'blob:x', revokeObjectURL: () => {},
      },
    );
    expect(r).toEqual({ kind: 'downloaded' });
  });

  it('canShareFiles=false → 다운로드', async () => {
    const share = vi.fn();
    const trigger = vi.fn();
    await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      {
        share, canShareFiles: () => false, triggerDownload: trigger,
        createObjectURL: () => 'blob:x', revokeObjectURL: () => {},
      },
    );
    expect(share).not.toHaveBeenCalled();
    expect(trigger).toHaveBeenCalled();
  });

  it('다운로드 실패 + 클립보드 성공 → copied', async () => {
    const trigger = vi.fn(() => { throw new Error('dom'); });
    const writeText = vi.fn(async () => {});
    const r = await shareResult(
      { title: 'MotiQ 결과', text: '80점', blob: blob(), filename: 'f.mp4' },
      {
        share: null, canShareFiles: null, triggerDownload: trigger, writeText,
        createObjectURL: () => 'blob:x', revokeObjectURL: () => {},
      },
    );
    expect(r).toEqual({ kind: 'copied' });
    expect(writeText).toHaveBeenCalledWith('MotiQ 결과\n80점');
  });

  it('모두 실패 → failed', async () => {
    const r = await shareResult(
      { title: 't', text: 'x', blob: blob(), filename: 'f.mp4' },
      {
        share: null, canShareFiles: null,
        triggerDownload: () => { throw new Error('a'); },
        writeText: null,
        createObjectURL: () => 'blob:x', revokeObjectURL: () => {},
      },
    );
    expect(r.kind).toBe('failed');
  });
});

describe('makeResultFilename', () => {
  it('결정적 포맷 motiq_<id>_<ts>.mp4', () => {
    const name = makeResultFilename('neon-arena', Date.UTC(2026, 3, 20, 9, 15, 42));
    expect(name).toBe('motiq_neon-arena_20260420_091542.mp4');
  });
  it('불법 문자 제거', () => {
    const name = makeResultFilename('hello/../world?', 0);
    expect(name.startsWith('motiq_hello____world__')).toBe(true);
  });
  it('확장자 교체', () => {
    const name = makeResultFilename('x', 0, 'webm');
    expect(name.endsWith('.webm')).toBe(true);
  });
});
