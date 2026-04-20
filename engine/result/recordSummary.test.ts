import { describe, it, expect } from 'vitest';
import { summarizeResult, humanBytes } from './recordSummary';
import type { SessionScore } from '../scoring/scorer';

const baseMeta = {
  templateId: 'neon-arena',
  templateTitle: '네온 아레나',
  durationSec: 20,
  recordedAtMs: Date.UTC(2026, 3, 20),
  blobBytes: 12_345_678,
};

function makeSession(total: number, stars: number, passed: boolean): SessionScore {
  return {
    total,
    stars,
    passed,
    missions: [
      { kind: 'squat', id: 'm1', score: total, weight: 1.0 },
    ],
  };
}

describe('summarizeResult', () => {
  it('headline 은 총점에 따라 변화', () => {
    const high = summarizeResult(makeSession(96, 5, true), baseMeta);
    const low = summarizeResult(makeSession(30, 2, false), baseMeta);
    expect(high.headline).toMatch(/완벽/);
    expect(low.headline).toMatch(/도전|집중/);
  });

  it('별점 이모지는 5개 길이', () => {
    const r = summarizeResult(makeSession(80, 4, true), baseMeta);
    expect(r.starEmoji.length).toBeGreaterThanOrEqual(5); // 이모지는 multi-byte
    expect(r.starEmoji).toContain('⭐');
    expect(r.starEmoji).toContain('☆');
  });

  it('missionLines 는 한글 라벨 + 점수 + 가중', () => {
    const r = summarizeResult(makeSession(80, 4, true), baseMeta);
    expect(r.missionLines[0]).toBe('스쿼트 · 80점 (가중 100%)');
  });

  it('shareText 는 템플릿 제목 + 총점 + 통과여부', () => {
    const pass = summarizeResult(makeSession(80, 4, true), baseMeta);
    const fail = summarizeResult(makeSession(40, 2, false), baseMeta);
    expect(pass.shareText).toContain('네온 아레나');
    expect(pass.shareText).toContain('80점');
    expect(pass.shareText).toContain('통과');
    expect(fail.shareText).toContain('도전');
  });

  it('여러 미션 전부 라인 생성', () => {
    const s: SessionScore = {
      total: 75, stars: 4, passed: true,
      missions: [
        { kind: 'smile', id: 'a', score: 80, weight: 0.5 },
        { kind: 'gesture', id: 'b', score: 70, weight: 0.5 },
      ],
    };
    const r = summarizeResult(s, baseMeta);
    expect(r.missionLines).toHaveLength(2);
    expect(r.missionLines[0]).toMatch(/미소/);
    expect(r.missionLines[1]).toMatch(/제스처/);
  });
});

describe('humanBytes', () => {
  it('경계값', () => {
    expect(humanBytes(0)).toBe('0 B');
    expect(humanBytes(500)).toBe('500 B');
    expect(humanBytes(2048)).toBe('2.0 KB');
    expect(humanBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(humanBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });
});
