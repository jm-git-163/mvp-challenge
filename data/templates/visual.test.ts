/**
 * data/templates/visual.test.ts
 *
 * FIX-Z17 (2026-04-22): 사용자 피드백 "멋진 인트로 아웃트로 여러가지 화면 효과, 레이어, 이미지,
 * 자막 등의 효과는 없었다" 대응.
 *
 * 각 템플릿에 대해 인트로/메인/아웃트로 구간마다 activeRange 로 필터링 후
 * 활성 레이어 수가 충분한지 + 장르별 타입 집합이 서로 다른지 검증.
 */
import { describe, it, expect } from 'vitest';
import { parseTemplate, type Template, type BaseLayer } from '../../engine/templates/schema';
import { neonArena } from './neon-arena';
import { newsAnchor } from './news-anchor';
import { emojiExplosion } from './emoji-explosion';

/** 특정 tSec 시점에 활성(enabled + activeRange 포함)된 레이어들만 반환. */
function activeAt(t: Template, tSec: number): BaseLayer[] {
  return t.layers.filter((l) => {
    if (!l.enabled) return false;
    if (l.activeRange) {
      if (tSec < l.activeRange.startSec || tSec > l.activeRange.endSec) return false;
    }
    return true;
  });
}

describe('template visual richness (FIX-Z17)', () => {
  const all: Array<[string, Template]> = [
    ['neon-arena', neonArena],
    ['news-anchor', newsAnchor],
    ['emoji-explosion', emojiExplosion],
  ];

  for (const [name, t] of all) {
    it(`${name}: 모든 샘플 시점에서 10개 이상 레이어 활성`, () => {
      parseTemplate(t); // 스키마 재검증
      const samples = [0.5, 1.5, 2.5, 5, 10, t.duration - 3, t.duration - 1];
      for (const s of samples) {
        const active = activeAt(t, s);
        expect(active.length, `${name} @ ${s}s → ${active.length} layers`).toBeGreaterThanOrEqual(10);
      }
    });

    it(`${name}: 인트로(0~2.5s) 구간에 intro_* 레이어가 하나 이상 활성`, () => {
      const intro = activeAt(t, 0.8);
      const hasIntro = intro.some((l) => l.id.startsWith('intro_'));
      expect(hasIntro, `${name} 인트로에 intro_* 없음`).toBe(true);
    });

    it(`${name}: 아웃트로(duration-2s) 구간에 outro_* 레이어가 하나 이상 활성`, () => {
      const outro = activeAt(t, t.duration - 1.5);
      const hasOutro = outro.some((l) => l.id.startsWith('outro_'));
      expect(hasOutro, `${name} 아웃트로에 outro_* 없음`).toBe(true);
    });

    it(`${name}: 메인 구간에 해시태그 스트립 활성`, () => {
      const mid = (t.duration) / 2;
      const mainLayers = activeAt(t, mid);
      const hasStrip = mainLayers.some((l) => l.id === 'hashtag_strip');
      expect(hasStrip, `${name} mid @ ${mid}s hashtag_strip 없음`).toBe(true);
    });

    it(`${name}: 캡션/헤드라인이 최소 4개 이상 (메인 구간 총합)`, () => {
      const captionLike = t.layers.filter(
        (l) =>
          l.type === 'kinetic_text' &&
          (l.id.startsWith('cap_') || l.id.startsWith('head_') || l.id.startsWith('cue_')),
      );
      expect(captionLike.length, `${name} caption-like count=${captionLike.length}`).toBeGreaterThanOrEqual(4);
    });

    it(`${name}: hashtags 6개 이상`, () => {
      expect(t.hashtags?.length ?? 0).toBeGreaterThanOrEqual(6);
    });
  }

  it('3개 템플릿의 레이어 타입 집합이 서로 완전히 동일하지 않음 (장르 차별화)', () => {
    const sets = all.map(([, t]) => new Set(t.layers.map((l) => l.type)));
    // 모든 쌍이 완전히 같으면 차별화 실패.
    const [a, b, c] = sets;
    const eq = (x: Set<string>, y: Set<string>) =>
      x.size === y.size && [...x].every((v) => y.has(v));
    expect(eq(a, b) && eq(b, c)).toBe(false);
  });

  it('3개 템플릿의 mood 가 서로 다름', () => {
    const moods = all.map(([, t]) => t.mood);
    expect(new Set(moods).size).toBe(3);
  });

  it('3개 템플릿의 cameraFraming.kind 가 서로 다름', () => {
    const kinds = all.map(([, t]) => t.cameraFraming.kind);
    expect(new Set(kinds).size).toBe(3);
  });
});
