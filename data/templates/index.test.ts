import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../engine/templates/schema';
import { neonArena } from './neon-arena';
import { newsAnchor } from './news-anchor';
import { emojiExplosion } from './emoji-explosion';

describe('reference templates', () => {
  const all = [neonArena, newsAnchor, emojiExplosion];

  it('세 템플릿 모두 zTemplate 스키마 통과', () => {
    for (const t of all) {
      expect(() => parseTemplate(t)).not.toThrow();
    }
  });

  it('모든 템플릿 id 고유', () => {
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('canvasSize 는 1080x1920', () => {
    for (const t of all) {
      expect(t.canvasSize).toEqual({ w: 1080, h: 1920 });
    }
  });

  it('scoreWeight 합 = 1.0 (±0.01)', () => {
    for (const t of all) {
      const sum = t.missionTimeline.reduce((a, m) => a + m.scoreWeight, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
    }
  });

  it('모든 mission.endSec ≤ duration', () => {
    for (const t of all) {
      for (const m of t.missionTimeline) {
        expect(m.endSec).toBeLessThanOrEqual(t.duration);
      }
    }
  });

  it('emoji-explosion: 3씬 구성', () => {
    expect(emojiExplosion.missionTimeline).toHaveLength(3);
    expect(emojiExplosion.missionTimeline.map((m) => m.mission.kind)).toEqual([
      'smile',
      'gesture',
      'pose_hold',
    ]);
  });
});
