/**
 * services/challengeTemplateMap.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — **11개 챌린지 → 11개 템플릿 1:1 매핑**.
 *
 * 사용자 피드백 #4: "챌린지 개수는 10개 정도인데 템플릿은 왜 3종류인지.
 * 템플릿 종류와 bgm종류는 챌린지 개수와 같아야. 현재 3개로 잡혀있으면 수정해서 10가지로"
 *
 * 이전엔 3개 레퍼런스 템플릿(neon-arena/news-anchor/emoji-explosion)을 10개 챌린지에
 * many-to-one 매핑 → 사용자는 "왜 다 똑같아 보이나" 느낌. 본 커밋부터는:
 *
 *   - `kpop-dance`   → data/templates/kpop-dance.ts         (핫핑크 + 시안, full-frame)
 *   - `squat-master` → data/templates/squat-master.ts       (인디고 + 옐로우, portrait_split)
 *   - `news-anchor`  → data/templates/news-anchor.ts        (네이비 + 골드)
 *   - `english-speaking`  → data/templates/english-speaking.ts  (칠판 + 골드)
 *   - `storybook-reading` → data/templates/storybook-reading.ts (파스텔 + 라일락)
 *   - `travel-checkin`    → data/templates/travel-checkin.ts    (스카이 + 코랄)
 *   - `unboxing-promo`    → data/templates/unboxing-promo.ts    (블랙 + 골드 + 레드)
 *   - `food-review`       → data/templates/food-review.ts       (우드 + 머스타드)
 *   - `motivation-speech` → data/templates/motivation-speech.ts (미드나잇 + 골드)
 *   - `social-viral`      → data/templates/social-viral.ts      (블랙 + 시안 + 핑크)
 *   - `daily-vlog`        → data/templates/daily-vlog.ts        (크림 + 블루 + 머스타드)
 *
 * 각 템플릿은 고유 BGM 파일(public/bgm/) 을 직접 참조. resolveGenreBgmFile 은
 * legacy VideoTemplate.genre 전용 폴백으로만 유지.
 *
 * 기존 3개 레퍼런스 (neon-arena / emoji-explosion) 는 legacy alias 로 유지하지만
 * 챌린지 slug 매칭은 신규 11개로만 향한다.
 */
import type { Template } from '../engine/templates/schema';

// 11개 신규 템플릿
import { squatMaster }      from '../data/templates/squat-master';
import { kpopDance }        from '../data/templates/kpop-dance';
import { dailyVlog }        from '../data/templates/daily-vlog';
import { englishSpeaking }  from '../data/templates/english-speaking';
import { storybookReading } from '../data/templates/storybook-reading';
import { travelCheckin }    from '../data/templates/travel-checkin';
import { unboxingPromo }    from '../data/templates/unboxing-promo';
import { foodReview }       from '../data/templates/food-review';
import { motivationSpeech } from '../data/templates/motivation-speech';
import { socialViral }      from '../data/templates/social-viral';
import { newsAnchor }       from '../data/templates/news-anchor';

// Legacy 3 (테스트 호환)
import { neonArena }        from '../data/templates/neon-arena';
import { emojiExplosion }   from '../data/templates/emoji-explosion';

/** 11개 슬러그 → 11개 독립 템플릿 레지스트리. */
export const LAYERED_TEMPLATES: Record<string, Template> = {
  'squat-master':      squatMaster,
  'kpop-dance':        kpopDance,
  'news-anchor':       newsAnchor,
  'english-speaking':  englishSpeaking,
  'storybook-reading': storybookReading,
  'travel-checkin':    travelCheckin,
  'unboxing-promo':    unboxingPromo,
  'food-review':       foodReview,
  'motivation-speech': motivationSpeech,
  'social-viral':      socialViral,
  'daily-vlog':        dailyVlog,
  // legacy alias — 기존 코드 호환. 신규 챌린지 slug 매칭에는 사용되지 않음.
  'neon-arena':        neonArena,
  'emoji-explosion':   emojiExplosion,
};

/**
 * 챌린지 slug / 장르 키워드 → layered Template.
 * 매칭 실패 시 `null` (호출자가 legacy 경로로 폴백).
 */
/**
 * FIX-TEXT-CLUTTER (2026-04-23): 사용자 피드백 "템플릿에 텍스트가 마구 겹치고
 *   챌린지 자막과 무관한 문구가 뜬다". 문제 레이어 타입(news_ticker, kinetic_text,
 *   hashtag_strip — 하드코딩 해시태그 다수 포함)을 런타임에서 전부 제거해
 *   일반 텍스트(mission_prompt, karaoke_caption) 만 남긴다.
 */
function stripClutterLayers(t: Template): Template {
  const layers = (t as any).layers;
  if (!Array.isArray(layers)) return t;
  // FIX-SUBTITLE-DUP v2 (2026-04-23): karaoke_caption 은 스크립트 동기 하단 자막 —
  //   voice_read 미션 템플릿에서 상단 텔레프롬프터와 내용이 달라 혼선. 전역 제거.
  // FIX-SUBTITLE-DUP v3 (2026-04-23): subtitle_track/lower_third 등 하단 텍스트 레이어
  //   일체 제거. 유저 요구: "voice_read 미션 중 하단 자막 전부 없애라".
  // FIX-COUNTER-TEXT (2026-04-23): 사용자 피드백 "0/10, 1/10 같은 N/M 카운터 텍스트가
  //   화면에 박혀서 보기 나쁘다". counter_hud(= '{n}/10' 류 템플릿 텍스트 레이어)
  //   전역 제거. 스쿼트 실제 카운트는 별도 SquatHUD React 컴포넌트가 표시.
  const KILL_TYPES = new Set([
    'news_ticker', 'kinetic_text', 'karaoke_caption',
    'subtitle_track', 'lower_third', 'hashtag_strip', 'ticker',
    'counter_hud',
  ]);
  const KILL_IDS = new Set(['hashtag_strip', 'bottom_ticker', 'subtitle_timeline']);
  // FIX-EFFECT-INTENSITY (2026-04-23): 사용자 피드백 "효과가 너무 심해 피사체가 안 보임".
  //   배경·파티클·그레인·비트플래시·크로매틱 등 피사체 가독성을 해치는 오버레이 레이어의
  //   opacity 를 강제 캡 → 카메라 피드가 선명히 드러나도록.
  // FIX-EFFECT-INTENSITY-v2 (2026-04-23): 스쿼트 등에서 여전히 과함 → ~40% 추가 tighten.
  const OPACITY_CAPS: Record<string, number> = {
    particle_ambient: 0.18,
    particle_burst:   0.22,
    beat_flash:       0.14,
    chromatic_pulse:  0.12,
    lens_flare:       0.18,
    noise_pattern:    0.04,
    animated_grid:    0.14,
    gradient_mesh:    0.45,
    image_bg:         0.55,
    scanlines:        0.10,
    vignette:         0.28,
    pulse_circle:     0.16,
  };
  const cleaned = layers
    .filter((L: any) => !(L && (KILL_TYPES.has(L.type) || KILL_IDS.has(L.id))))
    .map((L: any) => {
      if (!L || typeof L !== 'object') return L;
      const cap = OPACITY_CAPS[L.type];
      if (typeof cap === 'number' && typeof L.opacity === 'number' && L.opacity > cap) {
        return { ...L, opacity: cap };
      }
      return L;
    });
  return { ...(t as any), layers: cleaned } as Template;
}

export function resolveLayeredTemplate(key: string | null | undefined): Template | null {
  if (!key) return null;
  const k = key.toLowerCase().trim();

  // 1) 직접 id / slug 매칭
  if (LAYERED_TEMPLATES[k]) return stripClutterLayers(LAYERED_TEMPLATES[k]);

  // 2) 장르·별칭
  const aliases: Record<string, string> = {
    'kpop':         'kpop-dance',
    'dance':        'kpop-dance',
    'squat':        'squat-master',
    'fitness':      'squat-master',
    'news':         'news-anchor',
    'english':      'english-speaking',
    'storybook':    'storybook-reading',
    'kids':         'storybook-reading',
    'travel':       'travel-checkin',
    'unboxing':     'unboxing-promo',
    'promotion':    'unboxing-promo',
    'food':         'food-review',
    'motivation':   'motivation-speech',
    'speech':       'motivation-speech',
    'viral':        'social-viral',
    'social':       'social-viral',
    'hiphop':       'social-viral',
    'challenge':    'kpop-dance',
    'daily':        'daily-vlog',
    'vlog':         'daily-vlog',
  };
  const aliased = aliases[k];
  if (aliased && LAYERED_TEMPLATES[aliased]) return stripClutterLayers(LAYERED_TEMPLATES[aliased]);

  return null;
}

/**
 * 진단용: 11개 공식 챌린지 slug (10 챌린지 + squat-master).
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
  'squat-master',
] as const;
export type ChallengeSlug = (typeof OFFICIAL_CHALLENGE_SLUGS)[number];
