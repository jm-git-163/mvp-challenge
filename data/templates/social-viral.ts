/**
 * data/templates/social-viral.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — 소셜 바이럴 비주얼 강화.
 *
 * 팔레트: TikTok 세로 UI — 블랙(#000000) + 시안(#00F2EA) + 핑크(#FF0050).
 * v2: 11 → 22 레이어. pose_hold 미션이라 read_script 풀은 없음.
 */
import type { Template } from '../../engine/templates/schema';

const BLACK = '#000000';
const CYAN  = '#00F2EA';
const PINK  = '#FF0050';
const WHITE = '#FFFFFF';
const PURPLE = '#1A0B2E';

export const socialViral: Template = {
  id: 'social-viral',
  title: '소셜 바이럴',
  description: 'TikTok 세로 UI·팔로우·좋아요.',
  thumbnail: '/templates/social-viral/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'neon_cyberpunk',

  bgm: {
    src: '/bgm/anomy5-phonk-phonk-music-467523.mp3',
    volume: 0.7,
    beatsJson: '/bgm/anomy5-phonk-phonk-music-467523.beats.json',
    loop: true,
    duckingDb: -8,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [BLACK, PURPLE, PINK], rotatePeriodSec: 35 } },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 2, opacity: 0.6, enabled: true, props: { count: 100, driftPxPerSec: 8 } },
    { id: 'bg_glitter',    type: 'particle_ambient', zIndex: 3, opacity: 0.5, enabled: true, props: { preset: 'electric_blue_rise', count: 32, tint: CYAN } },
    { id: 'bg_shapes',     type: 'floating_shapes',  zIndex: 4, opacity: 0.4, enabled: true, props: { shapes: ['heart', 'star'], yBand: [80, 380], tint: PINK, sizeJitter: 0.5 } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.25, enabled: true, props: { borderColor: PINK, borderWidth: 2, glowBlur: 16 },
      reactive: { onBeat: { every: 2, property: 'glow', amount: 0.4, easing: 'overshoot', durationMs: 130 } } },

    // ── 비트 반응 (3) ─────────────────────────────────────────
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: PINK, maxAlpha: 0.22 },
      reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.22, easing: 'standard', durationMs: 130 } }, activeRange: { startSec: 3, endSec: 15 } },
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 22, opacity: 0.22, enabled: true, props: { cx: 540, cy: 960, baseRadius: 480, color: CYAN },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.18, easing: 'easeOut', durationMs: 360 } }, activeRange: { startSec: 3, endSec: 15 } },
    { id: 'chroma_pulse',  type: 'chromatic_pulse',  zIndex: 74, opacity: 0.55, enabled: true, props: { peakPx: 0.6 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.5, easing: 'easeOut', durationMs: 220 } }, activeRange: { startSec: 4, endSec: 14 } },

    // ── 배지·HUD (4) ───────────────────────────────────────────
    { id: 'follow_badge',  type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: '+ FOLLOW', bg: PINK, color: WHITE, position: { x: 140, y: 280 } }, activeRange: { startSec: 2, endSec: 16 } },
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: BLACK, border: CYAN } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: CYAN } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '포즈 홀드!', color: CYAN, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: CYAN, peakOpacity: 0.55 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '▶ VIRAL', fontSize: 100, color: CYAN, strokeColor: PINK, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 50 }, activeRange: { startSec: 0, endSec: 2 } },

    // ── 미드 훅 (2) ────────────────────────────────────────────
    { id: 'mid_tag',       type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: '🔥 TRENDING', fontSize: 56, color: WHITE, strokeColor: PINK, strokeWidth: 5, mode: 'pop', position: 'top-center', startMs: 5500, staggerMs: 50 }, activeRange: { startSec: 5.5, endSec: 7 } },
    { id: 'cue_like',      type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: '♥ LIKE!', fontSize: 72, color: PINK, strokeColor: WHITE, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 7500, staggerMs: 50 }, activeRange: { startSec: 7.5, endSec: 12 } },

    // ── 미드 버스트 (1) ────────────────────────────────────────
    { id: 'mid_burst',     type: 'particle_burst',   zIndex: 55, opacity: 1, enabled: true, props: { colors: [PINK, CYAN, WHITE], count: 50, durationMs: 900 }, activeRange: { startSec: 7.3, endSec: 8.4 } },

    // ── 아웃트로 (3) ───────────────────────────────────────────
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 75, opacity: 1, enabled: true, props: { color: PINK, peakOpacity: 0.55 }, activeRange: { startSec: 15.3, endSec: 15.8 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 76, opacity: 1, enabled: true, props: { text: 'GOING VIRAL ⚡', fontSize: 72, color: CYAN, strokeColor: PINK, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 55 }, activeRange: { startSec: 15.5, endSec: 18 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 77, opacity: 0.6, enabled: true, props: { x: 540, y: 700, color: CYAN, size: 320 }, activeRange: { startSec: 15.5, endSec: 18 } },

    // ── 해시태그 ───────────────────────────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.88, enabled: true, props: { texts: ['#viral', '#fyp', '#tiktok', '#trend', '#follow', '#motiq'], speedPxPerSec: 130, fontSize: 28, bgColor: 'rgba(0,0,0,0.7)', color: CYAN, accentColor: PINK, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['viral', 'fyp', 'tiktok', 'trend', 'follow', 'motiq'],

  missionTimeline: [
    { id: 'viral_pose', startSec: 2, endSec: 16, mission: { kind: 'pose_hold', pose: 'hands_up', holdMs: 2500 }, scoreWeight: 1.0, hudBinding: 'hud_prompt' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.85 },
    { kind: 'chromatic', baseOffsetPx: 2, onOnsetPx: 6 },
    { kind: 'saturation', boost: 0.2 },
    { kind: 'vignette', intensity: 0.25 },
  ],

  successEffects: [
    { kind: 'confetti', durationMs: 1500 },
    { kind: 'particle_burst', durationMs: 800, props: { colors: [CYAN, PINK, WHITE] } },
    { kind: 'lens_flare', durationMs: 500 },
  ],
  failEffects: [],
};
