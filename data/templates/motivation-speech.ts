/**
 * data/templates/motivation-speech.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 동기부여 연설 독립 템플릿.
 *
 * 팔레트: 강의실 조명 — 미드나잇(#0B1828) + 골드(#D4AF37) + 스포트라이트(#FFFAE5).
 * BGM: diamond_tunes-18457 (인스피레이셔널 인트로).
 */
import type { Template } from '../../engine/templates/schema';

const MIDNIGHT = '#0B1828';
const GOLD     = '#D4AF37';
const LIGHT    = '#FFFAE5';

export const motivationSpeech: Template = {
  id: 'motivation-speech',
  title: '동기부여 연설',
  description: '강의실·명언 카드·스포트라이트.',
  thumbnail: '/templates/motivation-speech/thumb.png',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'cinematic_news',

  bgm: {
    src: '/bgm/diamond_tunes-no-copyright-intro-music-18457.mp3',
    volume: 0.5,
    beatsJson: '/bgm/diamond_tunes-no-copyright-intro-music-18457.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [MIDNIGHT, '#000000'], rotatePeriodSec: 120 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 2, opacity: 0.15, enabled: true },
    { id: 'bg_spotlight',  type: 'particle_ambient', zIndex: 3, opacity: 0.5, enabled: true, props: { preset: 'glitter_down', count: 22 } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.25, enabled: true, props: { borderColor: GOLD, borderWidth: 2, softShadow: true, glowBlur: 18 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: MIDNIGHT, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '힘차게 외쳐요!', color: GOLD, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: LIGHT, mutedColor: '#6A7786', position: 'bottom', y: 1500 } },

    { id: 'quote_1',       type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: '"YOU CAN DO IT"', fontSize: 60, color: GOLD, strokeColor: MIDNIGHT, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 2500, staggerMs: 80 }, activeRange: { startSec: 2.5, endSec: 9 } },
    { id: 'quote_2',       type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: '"BELIEVE"', fontSize: 72, color: LIGHT, strokeColor: GOLD, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 10000, staggerMs: 90 }, activeRange: { startSec: 10, endSec: 16 } },

    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★ RISE UP ★', fontSize: 80, color: GOLD, strokeColor: MIDNIGHT, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 17500, staggerMs: 70 }, activeRange: { startSec: 17.5, endSec: 20 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#motivation', '#speech', '#inspire', '#believe', '#riseup', '#motiq'], speedPxPerSec: 80, fontSize: 26, bgColor: 'rgba(11,24,40,0.7)', color: LIGHT, accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 17 } },
  ],

  hashtags: ['motivation', 'speech', 'inspire', 'believe', 'riseup', 'motiq'],

  missionTimeline: [
    { id: 'speech_loud', startSec: 2, endSec: 17, mission: { kind: 'loud_voice', minDb: -22, durationMs: 4000 }, scoreWeight: 1.0, hudBinding: 'hud_prompt' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.7 },
    { kind: 'film_grain', opacity: 0.18 },
    { kind: 'vignette', intensity: 0.3 },
  ],

  successEffects: [
    { kind: 'lens_flare', durationMs: 800 },
    { kind: 'particle_burst', durationMs: 900, props: { colors: [GOLD] } },
  ],
  failEffects: [],
};
