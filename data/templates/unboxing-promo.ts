/**
 * data/templates/unboxing-promo.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 언박싱 프로모 독립 템플릿.
 *
 * 팔레트: 쇼핑 — 로즈 레드(#E63946) + 골드(#FFD700) + 화이트(#FFFFFF).
 * BGM: backgroundmusicforvideos-334863 (팝 커머셜).
 */
import type { Template } from '../../engine/templates/schema';

const RED   = '#E63946';
const GOLD  = '#FFD700';
const BLACK = '#0A0A0A';

export const unboxingPromo: Template = {
  id: 'unboxing-promo',
  title: '언박싱 프로모',
  description: '박스 오프닝·별·쇼핑 UI.',
  thumbnail: '/templates/unboxing-promo/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'pop_candy',

  bgm: {
    src: '/bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3',
    volume: 0.7,
    beatsJson: '/bgm/backgroundmusicforvideos-no-copyright-music-334863.beats.json',
    loop: true,
    duckingDb: -7,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [BLACK, RED, '#2A0A0A'], rotatePeriodSec: 30 } },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 2, opacity: 0.65, enabled: true, props: { count: 70, driftPxPerSec: 5 } },
    { id: 'bg_glitter',    type: 'particle_ambient', zIndex: 3, opacity: 0.55, enabled: true, props: { preset: 'glitter_down', count: 35 } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.25, enabled: true, props: { borderColor: GOLD, borderWidth: 3, glowBlur: 14 },
      reactive: { onBeat: { every: 2, property: 'glow', amount: 0.4, easing: 'overshoot', durationMs: 140 } } },

    { id: 'sale_badge',    type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: 'NEW!', bg: GOLD, color: RED, skewDeg: -6, position: { x: 140, y: 280 } }, activeRange: { startSec: 2, endSec: 16 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: BLACK, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '소개해주세요!', color: GOLD, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: GOLD, maxAlpha: 0.18 },
      reactive: { onBeat: { every: 4, property: 'opacity', amount: 0.18, easing: 'standard', durationMs: 150 } }, activeRange: { startSec: 3, endSec: 15 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '📦 UNBOXING', fontSize: 92, color: GOLD, strokeColor: RED, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2 } },
    { id: 'cue_wow',       type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: 'WOW! ⭐', fontSize: 80, color: GOLD, strokeColor: BLACK, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 8000, staggerMs: 55 }, activeRange: { startSec: 8, endSec: 12 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'BUY NOW ★', fontSize: 72, color: RED, strokeColor: GOLD, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 55 }, activeRange: { startSec: 15.5, endSec: 18 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.88, enabled: true, props: { texts: ['#unboxing', '#review', '#new', '#shop', '#haul', '#motiq'], speedPxPerSec: 110, fontSize: 28, bgColor: 'rgba(10,10,10,0.6)', color: GOLD, accentColor: RED, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['unboxing', 'review', 'new', 'shop', 'haul', 'motiq'],

  missionTimeline: [
    { id: 'unbox_loud', startSec: 2, endSec: 16, mission: { kind: 'loud_voice', minDb: -24, durationMs: 3000 }, scoreWeight: 1.0, hudBinding: 'hud_prompt' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.8 },
    { kind: 'saturation', boost: 0.2 },
    { kind: 'vignette', intensity: 0.2 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 900, props: { colors: [GOLD, RED] } },
    { kind: 'lens_flare', durationMs: 500 },
  ],
  failEffects: [],
};
