import { describe, it, expect } from 'vitest';
import { negotiateCodec, estimateTier, BITRATE_BY_TIER } from './codecNegotiator';
import { MIME_CANDIDATES } from '../session/compatibilityCheck';

describe('negotiateCodec', () => {
  it('isTypeSupported 없으면 실패', () => {
    const r = negotiateCodec({ isTypeSupported: undefined });
    // node 환경에서는 MediaRecorder 없음 → 실패
    if (!r.ok) expect(r.reason).toMatch(/unavailable/);
  });

  it('mp4 지원 (iOS Safari 시나리오) → mp4 선택', () => {
    const r = negotiateCodec({
      isTypeSupported: (t) => t === MIME_CANDIDATES[0],
      tier: 'high',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.selection.mimeType).toBe(MIME_CANDIDATES[0]);
      expect(r.selection.videoBitsPerSecond).toBe(BITRATE_BY_TIER.high.video);
      expect(r.selection.timesliceMs).toBe(1000);
    }
  });

  it('webm vp9 (Android Chrome) → webm 선택', () => {
    const r = negotiateCodec({
      isTypeSupported: (t) => t === MIME_CANDIDATES[1],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selection.mimeType).toBe(MIME_CANDIDATES[1]);
  });

  it('지원 코덱 없음 → 실패', () => {
    const r = negotiateCodec({ isTypeSupported: () => false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/코덱/);
  });

  it('isTypeSupported 예외 안전', () => {
    const r = negotiateCodec({
      isTypeSupported: (t) => { if (t === MIME_CANDIDATES[0]) throw new Error('x'); return t === MIME_CANDIDATES[2]; },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selection.mimeType).toBe(MIME_CANDIDATES[2]);
  });

  it('tier별 비트레이트 반영', () => {
    const low = negotiateCodec({ isTypeSupported: () => true, tier: 'low' });
    const high = negotiateCodec({ isTypeSupported: () => true, tier: 'high' });
    if (low.ok && high.ok) {
      expect(low.selection.videoBitsPerSecond).toBeLessThan(high.selection.videoBitsPerSecond);
    }
  });
});

describe('estimateTier', () => {
  it('deviceMemory 6+ & cpu 6+ → high', () => {
    expect(estimateTier({ deviceMemory: 8, hardwareConcurrency: 8 } as Navigator)).toBe('high');
  });
  it('deviceMemory 4 → mid', () => {
    expect(estimateTier({ deviceMemory: 4, hardwareConcurrency: 4 } as Navigator)).toBe('mid');
  });
  it('deviceMemory 2 → low', () => {
    expect(estimateTier({ deviceMemory: 2, hardwareConcurrency: 4 } as Navigator)).toBe('low');
  });
  it('iOS (no deviceMemory) cpu 6 → high', () => {
    expect(estimateTier({ hardwareConcurrency: 6 } as Navigator)).toBe('high');
  });
  it('iOS cpu 2 → low', () => {
    expect(estimateTier({ hardwareConcurrency: 2 } as Navigator)).toBe('low');
  });
  it('정보 없음 → low', () => {
    expect(estimateTier({} as Navigator)).toBe('low');
  });
});
