/**
 * services/challengeTemplateMap.ts
 *
 * Focused Commit A-6-b: **챌린지 → 레이어드 Template** 매핑 단일 지점.
 *
 * 10개 챌린지(daily-vlog / news-anchor / english-speaking / storybook-reading /
 *   travel-checkin / unboxing-promo / kpop-dance / food-review / motivation-speech /
 *   social-viral) 각각에 **주제에 맞는** 3개 레퍼런스 레이어드 템플릿 중 하나를 배정.
 *
 *   - neon-arena (사이버펑크 네온, 격렬): kpop-dance, social-viral, hiphop
 *   - news-anchor (CNN Breaking News 미니멀): news-anchor, motivation-speech, english-speaking
 *   - emoji-explosion (Instagram Story 스티커, 따뜻): daily-vlog, storybook-reading,
 *       travel-checkin, food-review, unboxing-promo
 *
 * 레거시 `VideoTemplate.genre` 또는 챌린지 slug 양쪽에서 해석 가능.
 * 결과 페이지/컴포지터가 새 Template 파이프라인 전환 시 단일 import 로 교체.
 */
import type { Template } from '../engine/templates/schema';
import { neonArena } from '../data/templates/neon-arena';
import { newsAnchor } from '../data/templates/news-anchor';
import { emojiExplosion } from '../data/templates/emoji-explosion';

/** 레퍼런스 Template 3종 레지스트리. */
export const LAYERED_TEMPLATES: Record<string, Template> = {
  'neon-arena':      neonArena,
  'news-anchor':     newsAnchor,
  'emoji-explosion': emojiExplosion,
};

/**
 * 챌린지 slug / 장르 키워드 → layered Template.
 * 매칭 실패 시 `null` (호출자가 legacy 경로로 폴백).
 */
export function resolveLayeredTemplate(key: string | null | undefined): Template | null {
  if (!key) return null;
  const k = key.toLowerCase().trim();

  // 직접 Template id 매칭
  if (LAYERED_TEMPLATES[k]) return LAYERED_TEMPLATES[k];

  // 장르·챌린지 slug 매핑
  if (['kpop', 'kpop-dance', 'social-viral', 'viral', 'hiphop', 'challenge'].includes(k)) {
    return neonArena;
  }
  if (['news', 'news-anchor', 'motivation', 'motivation-speech', 'english', 'english-speaking', 'speech'].includes(k)) {
    return newsAnchor;
  }
  if (['daily', 'daily-vlog', 'vlog', 'storybook', 'storybook-reading', 'kids',
       'travel', 'travel-checkin', 'food', 'food-review', 'unboxing',
       'unboxing-promo', 'promotion'].includes(k)) {
    return emojiExplosion;
  }
  return null;
}

/**
 * 진단용: 10개 공식 챌린지 slug 목록 (CLAUDE.md Phase 5i §6.2 기준).
 * A-6 가 켜진 뒤 UI/테스트에서 전체 커버리지 검증.
 */
export const OFFICIAL_CHALLENGE_SLUGS = [
  'daily-vlog',
  'news-anchor',
  'english-speaking',
  'storybook-reading',
  'travel-checkin',
  'unboxing-promo',
  'kpop-dance',
  'food-review',
  'motivation-speech',
  'social-viral',
] as const;
export type ChallengeSlug = (typeof OFFICIAL_CHALLENGE_SLUGS)[number];
