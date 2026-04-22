import { describe, it, expect } from 'vitest';
import {
  resolveLayeredTemplate,
  OFFICIAL_CHALLENGE_SLUGS,
  LAYERED_TEMPLATES,
} from './challengeTemplateMap';

describe('challengeTemplateMap (11개 1:1 매핑)', () => {
  it('11개 공식 챌린지 slug 전부 매칭 성공', () => {
    for (const slug of OFFICIAL_CHALLENGE_SLUGS) {
      const t = resolveLayeredTemplate(slug);
      expect(t, `slug "${slug}" 매칭 실패`).not.toBeNull();
    }
  });

  it('각 slug 는 서로 다른 템플릿으로 1:1 매핑', () => {
    const ids = new Set<string>();
    for (const slug of OFFICIAL_CHALLENGE_SLUGS) {
      const t = resolveLayeredTemplate(slug);
      expect(t).not.toBeNull();
      expect(t!.id, `slug "${slug}" 템플릿 중복`).not.toBe('__dup__');
      ids.add(t!.id);
    }
    expect(ids.size).toBe(OFFICIAL_CHALLENGE_SLUGS.length);
  });

  it('직접 id/slug 매칭', () => {
    expect(resolveLayeredTemplate('kpop-dance')?.id).toBe('kpop-dance');
    expect(resolveLayeredTemplate('squat-master')?.id).toBe('squat-master');
    expect(resolveLayeredTemplate('news-anchor')?.id).toBe('news-anchor');
    expect(resolveLayeredTemplate('daily-vlog')?.id).toBe('daily-vlog');
    expect(resolveLayeredTemplate('social-viral')?.id).toBe('social-viral');
    expect(resolveLayeredTemplate('unboxing-promo')?.id).toBe('unboxing-promo');
    expect(resolveLayeredTemplate('food-review')?.id).toBe('food-review');
    expect(resolveLayeredTemplate('english-speaking')?.id).toBe('english-speaking');
    expect(resolveLayeredTemplate('storybook-reading')?.id).toBe('storybook-reading');
    expect(resolveLayeredTemplate('travel-checkin')?.id).toBe('travel-checkin');
    expect(resolveLayeredTemplate('motivation-speech')?.id).toBe('motivation-speech');
  });

  it('장르/별칭 매칭', () => {
    expect(resolveLayeredTemplate('kpop')?.id).toBe('kpop-dance');
    expect(resolveLayeredTemplate('fitness')?.id).toBe('squat-master');
    expect(resolveLayeredTemplate('viral')?.id).toBe('social-viral');
    expect(resolveLayeredTemplate('vlog')?.id).toBe('daily-vlog');
  });

  it('알 수 없는 키 → null', () => {
    expect(resolveLayeredTemplate('random-xyz')).toBeNull();
    expect(resolveLayeredTemplate('')).toBeNull();
    expect(resolveLayeredTemplate(null)).toBeNull();
    expect(resolveLayeredTemplate(undefined)).toBeNull();
  });

  it('대소문자·공백 허용', () => {
    expect(resolveLayeredTemplate('  KPOP  ')?.id).toBe('kpop-dance');
    expect(resolveLayeredTemplate('News-Anchor')?.id).toBe('news-anchor');
  });

  it('Legacy alias 도 조회 가능 (neon-arena, emoji-explosion)', () => {
    expect(resolveLayeredTemplate('neon-arena')?.id).toBe('neon-arena');
    expect(resolveLayeredTemplate('emoji-explosion')?.id).toBe('emoji-explosion');
  });

  it('LAYERED_TEMPLATES 레지스트리는 11 신규 + 2 legacy = 13', () => {
    const keys = Object.keys(LAYERED_TEMPLATES).sort();
    expect(keys).toContain('squat-master');
    expect(keys).toContain('kpop-dance');
    expect(keys).toContain('daily-vlog');
    expect(keys.length).toBe(13);
  });
});
