/**
 * data/templates/english-speaking.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 영어 스피킹 독립 템플릿.
 *
 * 팔레트: 아카데미 — 칠판 다크그린(#1E3A34) + 초크 화이트(#F5F0E1) + TOEFL 골드(#D4AF37).
 * BGM: atlasaudio-jazz (라이트 재즈, 도서관 분위기).
 */
import type { Template } from '../../engine/templates/schema';

const CHALK_BG = '#1E3A34';
const CHALK_FG = '#F5F0E1';
const GOLD     = '#D4AF37';
const NAVY     = '#0B1828';

export const englishSpeaking: Template = {
  id: 'english-speaking',
  title: '영어 스피킹',
  description: '칠판·영단어 카드·TOEFL 배지.',
  thumbnail: '/templates/english-speaking/thumb.png',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'cinematic_news',

  bgm: {
    src: '/bgm/atlasaudio-jazz-490623.mp3',
    volume: 0.5,
    beatsJson: '/bgm/atlasaudio-jazz-490623.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [CHALK_BG, '#0F2320'] } },
    { id: 'bg_grid',       type: 'animated_grid',    zIndex: 2, opacity: 0.15, enabled: true, props: { color: CHALK_FG, perspective: false, scrollPerBarPx: 0 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 3, opacity: 0.18, enabled: true },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.25, enabled: true, props: { borderColor: GOLD, borderWidth: 2, softShadow: true } },

    { id: 'toefl_badge',   type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: 'TOEFL 110+', bg: GOLD, color: NAVY, skewDeg: -4, position: { x: 120, y: 260 } }, activeRange: { startSec: 2, endSec: 18 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', label: '정확도', suffix: '%', color: NAVY, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: 'Read aloud', color: CHALK_FG, position: 'top' }, activeRange: { startSec: 2, endSec: 4.5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: CHALK_FG, mutedColor: '#6A8077', position: 'bottom', y: 1550 } },

    { id: 'word_card_1',   type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: 'HELLO WORLD', fontSize: 72, color: CHALK_FG, strokeColor: GOLD, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 2500, staggerMs: 80 }, activeRange: { startSec: 2.5, endSec: 8 } },
    { id: 'word_card_2',   type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: 'SPEAK UP!', fontSize: 72, color: GOLD, strokeColor: CHALK_FG, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 9000, staggerMs: 80 }, activeRange: { startSec: 9, endSec: 15 } },

    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'WELL DONE!', fontSize: 84, color: GOLD, strokeColor: NAVY, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 17500, staggerMs: 60 }, activeRange: { startSec: 17.5, endSec: 20 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#english', '#speaking', '#toefl', '#study', '#learn', '#motiq'], speedPxPerSec: 90, fontSize: 26, bgColor: 'rgba(11,24,40,0.7)', color: CHALK_FG, accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 17 } },
  ],

  hashtags: ['english', 'speaking', 'toefl', 'study', 'learn', 'motiq'],

  missionTimeline: [
    { id: 'read_en', startSec: 2, endSec: 17, mission: { kind: 'read_script', script: 'Hello, this is my English speaking challenge. Thank you for watching.' }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.3 },
    { kind: 'film_grain', opacity: 0.18 },
    { kind: 'vignette', intensity: 0.2 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 700, props: { colors: [GOLD] } },
  ],
  failEffects: [],
};
