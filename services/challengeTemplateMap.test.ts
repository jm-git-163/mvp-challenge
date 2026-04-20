import { describe, it, expect } from 'vitest';
import {
  resolveLayeredTemplate,
  OFFICIAL_CHALLENGE_SLUGS,
  LAYERED_TEMPLATES,
} from './challengeTemplateMap';

describe('challengeTemplateMap', () => {
  it('10개 공식 챌린지 slug 전부 매칭 성공', () => {
    for (const slug of OFFICIAL_CHALLENGE_SLUGS) {
      const t = resolveLayeredTemplate(slug);
      expect(t, `slug "${slug}" 매칭 실패`).not.toBeNull();
    }
  });

  it('kpop-dance / social-viral → neon-arena', () => {
    expect(resolveLayeredTemplate('kpop-dance')?.id).toBe('neon-arena');
    expect(resolveLayeredTemplate('social-viral')?.id).toBe('neon-arena');
    expect(resolveLayeredTemplate('kpop')?.id).toBe('neon-arena');
  });

  it('news-anchor / motivation-speech / english-speaking → news-anchor', () => {
    expect(resolveLayeredTemplate('news-anchor')?.id).toBe('news-anchor');
    expect(resolveLayeredTemplate('motivation-speech')?.id).toBe('news-anchor');
    expect(resolveLayeredTemplate('english-speaking')?.id).toBe('news-anchor');
  });

  it('daily-vlog / storybook / travel / food / unboxing → emoji-explosion', () => {
    expect(resolveLayeredTemplate('daily-vlog')?.id).toBe('emoji-explosion');
    expect(resolveLayeredTemplate('storybook-reading')?.id).toBe('emoji-explosion');
    expect(resolveLayeredTemplate('travel-checkin')?.id).toBe('emoji-explosion');
    expect(resolveLayeredTemplate('food-review')?.id).toBe('emoji-explosion');
    expect(resolveLayeredTemplate('unboxing-promo')?.id).toBe('emoji-explosion');
  });

  it('알 수 없는 키 → null (legacy fallback 신호)', () => {
    expect(resolveLayeredTemplate('random-xyz')).toBeNull();
    expect(resolveLayeredTemplate('')).toBeNull();
    expect(resolveLayeredTemplate(null)).toBeNull();
    expect(resolveLayeredTemplate(undefined)).toBeNull();
  });

  it('대소문자·공백 허용', () => {
    expect(resolveLayeredTemplate('  KPOP  ')?.id).toBe('neon-arena');
    expect(resolveLayeredTemplate('News-Anchor')?.id).toBe('news-anchor');
  });

  it('Template id 직접 조회 가능', () => {
    expect(resolveLayeredTemplate('neon-arena')?.id).toBe('neon-arena');
    expect(resolveLayeredTemplate('news-anchor')?.id).toBe('news-anchor');
    expect(resolveLayeredTemplate('emoji-explosion')?.id).toBe('emoji-explosion');
  });

  it('LAYERED_TEMPLATES 레지스트리는 3개 고정', () => {
    expect(Object.keys(LAYERED_TEMPLATES).sort()).toEqual([
      'emoji-explosion',
      'neon-arena',
      'news-anchor',
    ]);
  });
});
