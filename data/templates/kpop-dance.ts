/**
 * data/templates/kpop-dance.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — K-POP 댄스 비주얼 강화.
 *
 * 사용자 피드백: "k-pop은 효과가 너무 과해서 사람이 안보임" → 카메라존 위 레이어
 * opacity ≤ 0.25 원칙 유지. v2: 11 → 21 레이어. 비트 반응을 카메라 외곽으로 분산,
 * 인트로/미드/아웃트로 명확 분리, 컨페티·렌즈플레어 추가.
 *
 * 팔레트: 핫핑크(#FF2D95) + 시안(#00E0FF) + 라임(#39FF7D) K-POP 뮤비 톤.
 */
import type { Template } from '../../engine/templates/schema';

const PINK  = '#FF2D95';
const CYAN  = '#00E0FF';
const LIME  = '#39FF7D';
const BLACK = '#0B0B10';
const PURPLE = '#20052F';

export const kpopDance: Template = {
  id: 'kpop-dance',
  title: 'K-POP 댄스',
  description: 'K-POP 뮤비. 전신 댄스 풀프레임.',
  thumbnail: '/templates/kpop-dance/thumb.png',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'neon_cyberpunk',

  bgm: {
    src: '/bgm/anomy5-neon-night-phonk-house-by-anomy5-178380.mp3',
    volume: 0.75,
    beatsJson: '/bgm/anomy5-neon-night-phonk-house-by-anomy5-178380.beats.json',
    loop: true,
    duckingDb: -7,
  },

  // 전신 댄스 가시성 확보 — 풀스크린
  cameraFraming: { kind: 'fullscreen' },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1,  opacity: 1,    enabled: true, props: { colors: [BLACK, PINK, PURPLE], rotatePeriodSec: 40 } },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 2,  opacity: 0.5,  enabled: true, props: { count: 80, driftPxPerSec: 6 } },
    { id: 'bg_glitter',    type: 'particle_ambient', zIndex: 3,  opacity: 0.45, enabled: true, props: { preset: 'glitter_down', count: 30, tint: CYAN } },
    { id: 'bg_shapes',     type: 'floating_shapes',  zIndex: 4,  opacity: 0.35, enabled: true, props: { shapes: ['heart', 'star'], yBand: [100, 400], tint: PINK, sizeJitter: 0.4 } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1,    enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.22, enabled: true, props: { ringColor: PINK, ringWidth: 2, glowBlur: 14 },
      reactive: { onBeat: { every: 2, property: 'glow', amount: 0.35, easing: 'overshoot', durationMs: 130 } } },

    // ── 비트 반응 (3) ─────────────────────────────────────────
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1,    enabled: true, props: { color: PINK, maxAlpha: 0.14 },
      reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.14, easing: 'standard', durationMs: 140 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 22, opacity: 0.22, enabled: true, props: { cx: 540, cy: 960, baseRadius: 480, color: CYAN },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.16, easing: 'easeOut', durationMs: 360 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'chroma_pulse',  type: 'chromatic_pulse',  zIndex: 74, opacity: 0.5, enabled: true, props: { peakPx: 0.5 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.45, easing: 'easeOut', durationMs: 220 } }, activeRange: { startSec: 4, endSec: 16 } },

    // ── HUD (3) ────────────────────────────────────────────────
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1,    enabled: true, props: { position: 'top-right', bigNumber: true } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1,    enabled: true, props: { position: 'top-left', color: CYAN } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1,    enabled: true, props: { text: '하트 제스처!', color: PINK, position: 'top' }, activeRange: { startSec: 2.5, endSec: 6 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: PINK, peakOpacity: 0.5 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: 'KPOP DANCE', fontSize: 100, color: PINK, strokeColor: CYAN, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // ── 메인 큐 (2) ────────────────────────────────────────────
    { id: 'cue_heart',     type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: '💖 HEART', fontSize: 72, color: PINK, strokeColor: '#FFFFFF', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 6000, staggerMs: 50 }, activeRange: { startSec: 6, endSec: 11 } },
    { id: 'cue_peace',     type: 'kinetic_text',     zIndex: 55, opacity: 1, enabled: true, props: { text: '✌ PEACE', fontSize: 72, color: LIME, strokeColor: '#FFFFFF', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 11000, staggerMs: 50 }, activeRange: { startSec: 11, endSec: 16 } },

    // ── 미드 훅 (1) ────────────────────────────────────────────
    { id: 'mid_tag',       type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: '★ DROP IT ★', fontSize: 56, color: CYAN, strokeColor: PINK, strokeWidth: 5, mode: 'pop', position: 'top-center', startMs: 9000, staggerMs: 45 }, activeRange: { startSec: 9, endSec: 10.5 } },

    // ── 아웃트로 (3) ───────────────────────────────────────────
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 74, opacity: 1, enabled: true, props: { color: CYAN, peakOpacity: 0.55 }, activeRange: { startSec: 17, endSec: 17.5 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★ CUTE ★', fontSize: 92, color: PINK, strokeColor: CYAN, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 17100, staggerMs: 60 }, activeRange: { startSec: 17, endSec: 20 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.55, enabled: true, props: { x: 540, y: 700, color: PINK, size: 320 }, activeRange: { startSec: 17, endSec: 20 } },

    // ── 해시태그 ───────────────────────────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#kpop', '#dance', '#viral', '#heart', '#motiq'], separator: '   ', speedPxPerSec: 110, fontSize: 28, bgColor: 'rgba(11,11,16,0.55)', color: PINK, accentColor: CYAN, position: 'bottom' }, activeRange: { startSec: 2.5, endSec: 17 } },
  ],

  hashtags: ['kpop', 'dance', 'viral', 'heart', 'peace', 'motiq'],

  missionTimeline: [
    { id: 'sc1_heart',   startSec: 2,  endSec: 8,  mission: { kind: 'gesture', gesture: 'heart' },              scoreWeight: 0.5, hudBinding: 'hud_prompt' },
    { id: 'sc2_peace',   startSec: 11, endSec: 17, mission: { kind: 'gesture', gesture: 'peace' },              scoreWeight: 0.5 },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.7 },
    { kind: 'chromatic', baseOffsetPx: 1.5, onOnsetPx: 5 },
    { kind: 'saturation', boost: 0.18 },
    { kind: 'vignette', intensity: 0.2 },
  ],

  successEffects: [
    { kind: 'confetti', durationMs: 1500 },
    { kind: 'particle_burst', durationMs: 700, props: { colors: [PINK, CYAN, LIME] } },
  ],
  failEffects: [],
};
