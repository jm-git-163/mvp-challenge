/**
 * data/templates/food-review.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 푸드 리뷰 독립 템플릿.
 *
 * 팔레트: 원목 테이블 — 우드 브라운(#8B5A2B) + 머스타드(#E3B04B) + 토마토(#FF6347).
 * BGM: diamond_tunes-18457 (따뜻한 키친 분위기).
 */
import type { Template } from '../../engine/templates/schema';

const WOOD    = '#8B5A2B';
const MUSTARD = '#E3B04B';
const TOMATO  = '#FF6347';
const CREAM   = '#FFF4E0';

export const foodReview: Template = {
  id: 'food-review',
  title: '푸드 리뷰',
  description: '접시·별점·맛있음 이모지·원목.',
  thumbnail: '/templates/food-review/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'warm_asmr',

  bgm: {
    src: '/bgm/anomy5-sad-chill-phonk-464392.mp3',
    volume: 0.55,
    beatsJson: '/bgm/anomy5-sad-chill-phonk-464392.beats.json',
    loop: true,
    duckingDb: -9,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [WOOD, '#4E3118', MUSTARD], rotatePeriodSec: 80 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 2, opacity: 0.18, enabled: true },
    { id: 'bg_emoji_top',  type: 'floating_shapes',  zIndex: 3, opacity: 0.7, enabled: true, props: { shapes: ['star', 'heart'], yBand: [80, 380], tint: MUSTARD, sizeJitter: 0.3 } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.22, enabled: true, props: { borderColor: MUSTARD, borderWidth: 3, softShadow: true } },

    { id: 'star_badge',    type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: '★★★★★', bg: MUSTARD, color: WOOD, skewDeg: -4, position: { x: 140, y: 280 } }, activeRange: { startSec: 2, endSec: 16 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: WOOD, border: MUSTARD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: MUSTARD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '맛 평가해주세요', color: MUSTARD, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: CREAM, mutedColor: '#B0967A', position: 'bottom', y: 1500 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '🍽️ FOOD REVIEW', fontSize: 72, color: MUSTARD, strokeColor: WOOD, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2 } },
    { id: 'cue_yum',       type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: 'YUM! 😋', fontSize: 80, color: TOMATO, strokeColor: CREAM, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 8000, staggerMs: 55 }, activeRange: { startSec: 8, endSec: 12 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★★★★★', fontSize: 92, color: MUSTARD, strokeColor: WOOD, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 80 }, activeRange: { startSec: 15.5, endSec: 18 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#food', '#review', '#yum', '#tasty', '#kitchen', '#motiq'], speedPxPerSec: 85, fontSize: 26, bgColor: 'rgba(78,49,24,0.65)', color: CREAM, accentColor: MUSTARD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['food', 'review', 'yum', 'tasty', 'kitchen', 'motiq'],

  missionTimeline: [
    { id: 'food_read', startSec: 2, endSec: 16, mission: { kind: 'read_script', script: '맛있어 보이네요. 한 번 먹어볼게요. 음, 정말 맛있어요!' }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.5 },
    { kind: 'saturation', boost: 0.2 },
    { kind: 'vignette', intensity: 0.25 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 700, props: { colors: [MUSTARD, TOMATO] } },
  ],
  failEffects: [],
};
