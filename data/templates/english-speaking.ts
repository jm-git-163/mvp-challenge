/**
 * data/templates/english-speaking.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — 영어 스피킹 비주얼 강화.
 *
 * 팔레트: 아카데미 — 칠판 다크그린(#1E3A34) + 초크 화이트(#F5F0E1) + TOEFL 골드(#D4AF37).
 * v2: 14 → 23 레이어, 스크립트 8 → 18.
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
    src: '/bgm/diamond_tunes-no-copyright-intro-music-18457.mp3',
    volume: 0.5,
    beatsJson: '/bgm/diamond_tunes-no-copyright-intro-music-18457.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [CHALK_BG, '#0F2320', NAVY], rotatePeriodSec: 90 } },
    { id: 'bg_grid',       type: 'animated_grid',    zIndex: 2, opacity: 0.18, enabled: true, props: { color: CHALK_FG, perspective: false, scrollPerBarPx: 0 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 3, opacity: 0.18, enabled: true },
    { id: 'bg_dust',       type: 'particle_ambient', zIndex: 4, opacity: 0.4, enabled: true, props: { preset: 'glitter_down', count: 18, tint: GOLD } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.28, enabled: true, props: { borderColor: GOLD, borderWidth: 2, softShadow: true, glowBlur: 14 },
      reactive: { onBeat: { every: 4, property: 'glow', amount: 0.3, easing: 'easeOut', durationMs: 220 } } },

    // ── 비트 반응 (2) ──────────────────────────────────────────
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: GOLD, maxAlpha: 0.12 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.12, easing: 'standard', durationMs: 180 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 22, opacity: 0.18, enabled: true, props: { cx: 540, cy: 960, baseRadius: 440, color: GOLD },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.1, easing: 'easeOut', durationMs: 380 } }, activeRange: { startSec: 3, endSec: 17 } },

    // ── 배지 (1) ───────────────────────────────────────────────
    { id: 'toefl_badge',   type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: 'TOEFL 110+', bg: GOLD, color: NAVY, skewDeg: -4, position: { x: 120, y: 260 } }, activeRange: { startSec: 2, endSec: 18 } },

    // ── HUD (3) ────────────────────────────────────────────────
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', label: '정확도', suffix: '%', color: NAVY, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: 'Read aloud', color: CHALK_FG, position: 'top' }, activeRange: { startSec: 2, endSec: 4.5 } },

    // ── 자막 (1) ───────────────────────────────────────────────
    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: CHALK_FG, mutedColor: '#6A8077', position: 'bottom', y: 1550, highlightColor: GOLD, scaleActive: 1.06 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: GOLD, peakOpacity: 0.4 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '📚 ENGLISH', fontSize: 88, color: GOLD, strokeColor: NAVY, strokeWidth: 7, mode: 'drop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // ── 메인 단어 카드 (2) ─────────────────────────────────────
    { id: 'word_card_1',   type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: 'HELLO WORLD', fontSize: 72, color: CHALK_FG, strokeColor: GOLD, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 2500, staggerMs: 80 }, activeRange: { startSec: 2.5, endSec: 8 } },
    { id: 'word_card_2',   type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: 'SPEAK UP!', fontSize: 72, color: GOLD, strokeColor: CHALK_FG, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 9000, staggerMs: 80 }, activeRange: { startSec: 9, endSec: 15 } },

    // ── 미드 훅 (1) ────────────────────────────────────────────
    { id: 'mid_tag',       type: 'kinetic_text',     zIndex: 43, opacity: 1, enabled: true, props: { text: '✓ KEEP READING', fontSize: 48, color: CHALK_FG, strokeColor: NAVY, strokeWidth: 4, mode: 'drop', position: 'top-center', startMs: 11000, staggerMs: 50 }, activeRange: { startSec: 11, endSec: 12.5 } },

    // ── 아웃트로 (3) ───────────────────────────────────────────
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 74, opacity: 1, enabled: true, props: { color: GOLD, peakOpacity: 0.45 }, activeRange: { startSec: 17.5, endSec: 18 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'WELL DONE!', fontSize: 84, color: GOLD, strokeColor: NAVY, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 17500, staggerMs: 60 }, activeRange: { startSec: 17.5, endSec: 20 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.5, enabled: true, props: { x: 540, y: 700, color: GOLD, size: 280 }, activeRange: { startSec: 17.5, endSec: 20 } },

    // ── 해시태그 ───────────────────────────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#english', '#speaking', '#toefl', '#study', '#learn', '#motiq'], speedPxPerSec: 90, fontSize: 26, bgColor: 'rgba(11,24,40,0.7)', color: CHALK_FG, accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 17 } },
  ],

  hashtags: ['english', 'speaking', 'toefl', 'study', 'learn', 'motiq'],

  missionTimeline: [
    { id: 'read_en', startSec: 2, endSec: 17, mission: { kind: 'read_script', script: [
      'Hello, this is my English speaking challenge. Thank you for watching.',
      'Today I want to share something interesting with all of you. Listen carefully please.',
      'English is fun when you speak with confidence. Let us try together now.',
      'I believe practice makes perfect. Every day I get a little bit better.',
      'Never give up on your dreams. Keep moving forward every single day.',
      'Good morning everyone. I hope you are having a wonderful day today.',
      'Life is full of amazing moments. Let us enjoy every single one of them.',
      'Thank you so much for watching. Please subscribe and see you next time.',
      'My favorite hobby is reading books. They take me to magical new places.',
      'Travel opens your mind and your heart. Always say yes to adventure.',
      'Coffee in the morning makes everything better. What is your daily ritual?',
      'I am learning English step by step. Small progress is still real progress.',
      'Music has the power to change your mood. Find a song that lifts you up.',
      'The best lessons come from making mistakes. Do not be afraid to try.',
      'Surround yourself with people who believe in you. Energy is everything.',
      'Today I learned something new and useful. Knowledge is the best gift.',
      'Confidence is a skill, not a talent. Practice it just like a sport.',
      'Smile more, worry less. Tomorrow is always a fresh new chance.',
    ] }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.45 },
    { kind: 'film_grain', opacity: 0.18 },
    { kind: 'vignette', intensity: 0.22 },
    { kind: 'bokeh', strength: 0.25 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 700, props: { colors: [GOLD] } },
    { kind: 'lens_flare', durationMs: 500 },
  ],
  failEffects: [],
};
