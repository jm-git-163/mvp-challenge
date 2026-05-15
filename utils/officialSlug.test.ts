/**
 * utils/officialSlug.test.ts
 *
 * pickOfficialSlug() 가 **프로덕션 Supabase UUID** 를 전부 고유한 공식 slug 로
 * 매핑함을 검증. 이전 버그(모든 UUID → squat-master 폴백) 회귀 방지.
 */
import { describe, it, expect } from 'vitest';
import { pickOfficialSlug } from './officialSlug';
import { OFFICIAL_CHALLENGE_SLUGS } from '../services/challengeTemplateMap';

const DB_UUIDS = [
  '021ccc86-7d9f-41c0-88bd-970406bebd2e', // daily-vlog
  '77756254-94ea-40a2-9c9e-b5c4257945cd', // news-anchor
  '84592fbd-b1f2-4cc1-be02-0224284bcb98', // english-speaking
  '8e0b4493-5c5e-4ece-82dd-2ba93f9b8036', // storybook-reading
  '4c3f1f85-ec15-48fd-a197-dc507ceb8400', // travel-checkin
  'af337411-5b84-408a-b16a-e4fc04e78ebb', // unboxing-promo
  'e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54', // kpop-dance
  '981093f7-b455-4e48-82b2-6ce05850929a', // food-review
  '5ccf6904-960f-4fa0-9af7-1dada6d598f7', // motivation-speech
  '9e766788-4591-41d8-9c96-13103f269a0b', // social-viral
];

describe('pickOfficialSlug', () => {
  it('10 개 프로덕션 UUID 가 각각 고유한 공식 slug 로 매핑된다', () => {
    const slugs = DB_UUIDS.map(id => pickOfficialSlug({ id }));
    for (const s of slugs) {
      expect(OFFICIAL_CHALLENGE_SLUGS).toContain(s);
    }
    expect(new Set(slugs).size).toBe(DB_UUIDS.length);
    // squat-master 폴백이 끼어들면 10개 중 하나가 중복 → Set 크기 감소로 탐지됨.
  });

  it('공식 slug 를 id 로 받으면 그대로 반환', () => {
    for (const s of OFFICIAL_CHALLENGE_SLUGS) {
      expect(pickOfficialSlug({ id: s })).toBe(s);
    }
  });

  it('mock id prefix 매칭', () => {
    expect(pickOfficialSlug({ id: 'daily-vlog-001' })).toBe('daily-vlog');
    expect(pickOfficialSlug({ id: 'kpop-idol-002' })).toBe('kpop-dance');
    expect(pickOfficialSlug({ id: 'fitness-squat-003' })).toBe('squat-master');
  });

  it('genre alias 매칭 (id 없을 때)', () => {
    expect(pickOfficialSlug({ id: 'unknown-xyz', genre: 'kpop' })).toBe('kpop-dance');
    expect(pickOfficialSlug({ id: 'unknown-xyz', genre: 'daily' })).toBe('daily-vlog');
  });

  it('null/undefined → squat-master 폴백', () => {
    expect(pickOfficialSlug(null)).toBe('squat-master');
    expect(pickOfficialSlug(undefined)).toBe('squat-master');
    expect(pickOfficialSlug({})).toBe('squat-master');
  });

  it('explicit slug 가 id 보다 우선', () => {
    expect(pickOfficialSlug({ id: 'e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54', slug: 'news-anchor' }))
      .toBe('news-anchor');
  });
});
