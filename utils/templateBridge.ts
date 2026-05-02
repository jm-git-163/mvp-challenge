/**
 * utils/templateBridge.ts
 *
 * 2026-05-02: Phase 5 production wiring.
 *
 * 두 종류의 Template 표현이 코드베이스에 공존한다:
 *   1) 레거시 `types/template.ts` Template — Supabase / sessionStore.activeTemplate /
 *      app/record 가 사용. duration_sec, name, theme_emoji, missions[] 만 가짐.
 *   2) 신형 `engine/templates/schema.ts` Template (LayeredTemplate) — Phase 5 layerEngine
 *      이 사용. layers[], duration, postProcess, bgm, missionTimeline 등 풀 스펙.
 *
 * 이 모듈은 (1) → (2) 매핑 룩업을 제공한다.
 *   - 레거시 Template.id 가 직접 매칭되면 그 layered 템플릿을 반환
 *   - 못 찾으면 genre 기반 폴백 (fitness → squat-master, kpop → kpop-dance, ...)
 *   - 끝까지 못 찾으면 null → 호출자(RecordingCamera)는 기존 단순 카메라 경로 fallback
 *
 * 이 단방향 룩업으로 layerEngine(=renderLayeredFrame) 을 prod /record 경로에 와이어링.
 */
import type { Template as LegacyTemplate } from '../types/template';

import { squatMaster }     from '../data/templates/squat-master';
import { kpopDance }       from '../data/templates/kpop-dance';
import { newsAnchor }      from '../data/templates/news-anchor';
import { emojiExplosion }  from '../data/templates/emoji-explosion';
import { neonArena }       from '../data/templates/neon-arena';
import { dailyVlog }       from '../data/templates/daily-vlog';
import { englishSpeaking } from '../data/templates/english-speaking';
import { foodReview }      from '../data/templates/food-review';
import { motivationSpeech } from '../data/templates/motivation-speech';
import { socialViral }     from '../data/templates/social-viral';
import { storybookReading } from '../data/templates/storybook-reading';
import { travelCheckin }   from '../data/templates/travel-checkin';
import { unboxingPromo }   from '../data/templates/unboxing-promo';

/** Loose layered template shape (engine/templates/schema.ts Template). */
export interface LayeredTemplate {
  id: string;
  duration: number;
  layers: Array<{ id: string; type: string; zIndex: number; opacity: number; enabled: boolean; props?: any; activeRange?: { startSec: number; endSec: number }; reactive?: any; blendMode?: string }>;
  postProcess?: any[];
  bgm?: any;
  sfx?: any;
  cameraFraming?: any;
  [k: string]: any;
}

/** id → layered 템플릿 룩업 테이블. 신형 추가 시 1줄 추가. */
const BY_ID: Record<string, LayeredTemplate> = {
  'squat-master':      squatMaster as unknown as LayeredTemplate,
  'kpop-dance':        kpopDance as unknown as LayeredTemplate,
  'news-anchor':       newsAnchor as unknown as LayeredTemplate,
  'emoji-explosion':   emojiExplosion as unknown as LayeredTemplate,
  'neon-arena':        neonArena as unknown as LayeredTemplate,
  'daily-vlog':        dailyVlog as unknown as LayeredTemplate,
  'english-speaking':  englishSpeaking as unknown as LayeredTemplate,
  'food-review':       foodReview as unknown as LayeredTemplate,
  'motivation-speech': motivationSpeech as unknown as LayeredTemplate,
  'social-viral':      socialViral as unknown as LayeredTemplate,
  'storybook-reading': storybookReading as unknown as LayeredTemplate,
  'travel-checkin':    travelCheckin as unknown as LayeredTemplate,
  'unboxing-promo':    unboxingPromo as unknown as LayeredTemplate,
};

/** genre → layered 템플릿 폴백. 레거시 id 가 매칭 안 될 때. */
const BY_GENRE: Partial<Record<LegacyTemplate['genre'], LayeredTemplate>> = {
  fitness:   squatMaster      as unknown as LayeredTemplate,
  kpop:      kpopDance        as unknown as LayeredTemplate,
  hiphop:    kpopDance        as unknown as LayeredTemplate,
  news:      newsAnchor       as unknown as LayeredTemplate,
  challenge: emojiExplosion   as unknown as LayeredTemplate,
  promotion: unboxingPromo    as unknown as LayeredTemplate,
  travel:    travelCheckin    as unknown as LayeredTemplate,
  daily:     dailyVlog        as unknown as LayeredTemplate,
  english:   englishSpeaking  as unknown as LayeredTemplate,
  kids:      storybookReading as unknown as LayeredTemplate,
};

/**
 * 레거시 템플릿을 받아 매칭되는 layered 템플릿을 찾는다.
 *
 * 매칭 우선순위:
 *   1) 레거시 id 직접 일치 (예: 'squat-master')
 *   2) genre 폴백 (예: fitness → squat-master)
 *   3) null — 호출자는 기존 단순 합성 경로로 fallback
 *
 * 또한 레거시 duration_sec 이 layered.duration 과 다르면 layered 의 duration 을
 * 레거시 값으로 덮어쓴 사본을 반환한다 (intro/outro activeRange 는 그대로 — 짧은
 * 챌린지에서 outro 가 잘릴 수 있으나 회귀 위험 없음).
 */
export function resolveLayeredTemplate(legacy: LegacyTemplate | null | undefined): LayeredTemplate | null {
  if (!legacy) return null;
  const direct = BY_ID[legacy.id];
  const fallback = direct ?? BY_GENRE[legacy.genre] ?? null;
  if (!fallback) return null;
  // 길이 동기화 — 레거시 duration_sec 우선 (사용자가 본 챌린지 길이와 일치).
  if (typeof legacy.duration_sec === 'number' && legacy.duration_sec > 0
      && Math.abs(fallback.duration - legacy.duration_sec) > 0.5) {
    return { ...fallback, duration: legacy.duration_sec };
  }
  return fallback;
}

/** 진단/테스트용: 등록된 layered 템플릿 id 목록. */
export function listLayeredTemplateIds(): string[] {
  return Object.keys(BY_ID).sort();
}
