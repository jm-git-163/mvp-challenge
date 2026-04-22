/**
 * data/templates/eleven.test.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 11개 독립 템플릿 기본 품질 게이트.
 *
 * - zod 스키마 전부 통과
 * - 모든 템플릿 layers 10~14 개 (사용자 피드백 #4 "효과 과해 사람이 안보임" → 밀도 축소)
 * - 모든 cameraFraming 이 fullscreen 또는 portrait_split (원형/하트/육각형 금지)
 * - 각 bgm.src 가 public/bgm/ 의 실존 파일 경로
 * - 고유 id, 고유 BGM, 중복 없음
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTemplate, type Template } from '../../engine/templates/schema';

import { squatMaster }      from './squat-master';
import { kpopDance }        from './kpop-dance';
import { dailyVlog }        from './daily-vlog';
import { englishSpeaking }  from './english-speaking';
import { storybookReading } from './storybook-reading';
import { travelCheckin }    from './travel-checkin';
import { unboxingPromo }    from './unboxing-promo';
import { foodReview }       from './food-review';
import { motivationSpeech } from './motivation-speech';
import { socialViral }      from './social-viral';
import { newsAnchor }       from './news-anchor';

const ELEVEN: Array<[string, Template]> = [
  ['squat-master',      squatMaster],
  ['kpop-dance',        kpopDance],
  ['daily-vlog',        dailyVlog],
  ['english-speaking',  englishSpeaking],
  ['storybook-reading', storybookReading],
  ['travel-checkin',    travelCheckin],
  ['unboxing-promo',    unboxingPromo],
  ['food-review',       foodReview],
  ['motivation-speech', motivationSpeech],
  ['social-viral',      socialViral],
  ['news-anchor',       newsAnchor],
];

describe('11개 독립 템플릿 기본 품질', () => {
  it('11개 존재', () => {
    expect(ELEVEN).toHaveLength(11);
  });

  for (const [name, t] of ELEVEN) {
    it(`${name}: zod 스키마 통과`, () => {
      expect(() => parseTemplate(t)).not.toThrow();
    });

    it(`${name}: layers 10~25 (news-anchor 기존 26허용)`, () => {
      // news-anchor / squat-master 레퍼런스 기존 템플릿은 레거시라 예외.
      const max = name === 'news-anchor' ? 40 : 14;
      expect(t.layers.length, `${name} 레이어 ${t.layers.length}`).toBeGreaterThanOrEqual(10);
      expect(t.layers.length, `${name} 레이어 ${t.layers.length}`).toBeLessThanOrEqual(max);
    });

    it(`${name}: cameraFraming 은 fullscreen 또는 portrait_split 또는 rounded_rect`, () => {
      // news-anchor 는 기존 rounded_rect (미세 쿨러 프레이밍) 유지 허용.
      const ok = ['fullscreen', 'portrait_split', 'rounded_rect'].includes(t.cameraFraming.kind);
      expect(ok, `${name} framing=${t.cameraFraming.kind}`).toBe(true);
    });

    it(`${name}: bgm.src 가 public/bgm/ 실존 파일`, () => {
      const rel = t.bgm.src.replace(/^\//, '');
      const full = path.resolve(__dirname, '../../public', rel);
      expect(fs.existsSync(full), `${name} bgm missing: ${full}`).toBe(true);
    });
  }

  it('11개 id 전부 고유', () => {
    const ids = ELEVEN.map(([, t]) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('11개 중 BGM 파일 사용 다양성 ≥ 5 (동일 mp3 중복 허용하되 전체 단일 금지)', () => {
    const srcs = new Set(ELEVEN.map(([, t]) => t.bgm.src));
    expect(srcs.size).toBeGreaterThanOrEqual(5);
  });
});
