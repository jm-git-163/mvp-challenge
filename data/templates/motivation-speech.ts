/**
 * data/templates/motivation-speech.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — 동기부여 연설 비주얼 강화.
 *
 * 팔레트: 강의실 조명 — 미드나잇(#0B1828) + 골드(#D4AF37) + 스포트라이트(#FFFAE5).
 * v2: 13 → 22 레이어. 미션은 loud_voice 이지만 무대 자막용 인용구가 필요하므로
 * caption 레이어를 prompt 풀과 결합 (실제 STT 매칭 없음, 시각적 워딩 다양화).
 */
import type { Template } from '../../engine/templates/schema';

const MIDNIGHT = '#0B1828';
const GOLD     = '#D4AF37';
const LIGHT    = '#FFFAE5';
const DEEP     = '#000000';

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
    src: '/bgm/anomy5-dark-electronic-464393.mp3',
    volume: 0.5,
    beatsJson: '/bgm/anomy5-dark-electronic-464393.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [MIDNIGHT, DEEP, '#08111F'], rotatePeriodSec: 120 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 2, opacity: 0.18, enabled: true },
    { id: 'bg_spotlight',  type: 'particle_ambient', zIndex: 3, opacity: 0.55, enabled: true, props: { preset: 'glitter_down', count: 28, tint: GOLD } },
    { id: 'bg_shapes',     type: 'floating_shapes',  zIndex: 4, opacity: 0.3, enabled: true, props: { shapes: ['star'], yBand: [60, 380], tint: GOLD, sizeJitter: 0.4 } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true, props: { scale: 0.90 } },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.3, enabled: true, props: { borderColor: GOLD, borderWidth: 2, softShadow: true, glowBlur: 20 },
      reactive: { onBeat: { every: 4, property: 'glow', amount: 0.4, easing: 'easeOut', durationMs: 240 } } },

    // ── 비트 반응 (2) ─────────────────────────────────────────
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 22, opacity: 0.25, enabled: true, props: { cx: 540, cy: 880, baseRadius: 460, color: GOLD },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.14, easing: 'easeOut', durationMs: 380 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: GOLD, maxAlpha: 0.16 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.16, easing: 'standard', durationMs: 200 } }, activeRange: { startSec: 3, endSec: 17 } },

    // ── HUD (3) ────────────────────────────────────────────────
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: MIDNIGHT, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '힘차게 외쳐요!', color: GOLD, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    // ── 자막 ───────────────────────────────────────────────────
    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: LIGHT, mutedColor: '#6A7786', position: 'bottom', y: 1500, highlightColor: GOLD, scaleActive: 1.08 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: GOLD, peakOpacity: 0.5 }, activeRange: { startSec: 0, endSec: 0.7 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '⚡ MOTIVATION', fontSize: 84, color: GOLD, strokeColor: MIDNIGHT, strokeWidth: 7, mode: 'drop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // ── 메인 명언 (2) ──────────────────────────────────────────
    { id: 'quote_1',       type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: '"YOU CAN DO IT"', fontSize: 60, color: GOLD, strokeColor: MIDNIGHT, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 2500, staggerMs: 80 }, activeRange: { startSec: 2.5, endSec: 9 } },
    { id: 'quote_2',       type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: '"BELIEVE"', fontSize: 72, color: LIGHT, strokeColor: GOLD, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 10000, staggerMs: 90 }, activeRange: { startSec: 10, endSec: 16 } },

    // ── 미드 훅 (2) ────────────────────────────────────────────
    { id: 'mid_tag',       type: 'kinetic_text',     zIndex: 43, opacity: 1, enabled: true, props: { text: '★ NO LIMITS ★', fontSize: 50, color: LIGHT, strokeColor: GOLD, strokeWidth: 4, mode: 'drop', position: 'top-center', startMs: 9200, staggerMs: 50 }, activeRange: { startSec: 9.2, endSec: 10 } },
    { id: 'mid_burst',     type: 'particle_burst',   zIndex: 44, opacity: 1, enabled: true, props: { colors: [GOLD, LIGHT], count: 35, durationMs: 700 }, activeRange: { startSec: 9.2, endSec: 10.2 } },

    // ── 아웃트로 (3) ───────────────────────────────────────────
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 74, opacity: 1, enabled: true, props: { color: GOLD, peakOpacity: 0.55 }, activeRange: { startSec: 17.3, endSec: 17.8 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★ RISE UP ★', fontSize: 84, color: GOLD, strokeColor: MIDNIGHT, strokeWidth: 6, mode: 'drop', position: 'top-center', startMs: 17500, staggerMs: 70 }, activeRange: { startSec: 17.5, endSec: 20 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.65, enabled: true, props: { x: 540, y: 720, color: GOLD, size: 360 }, activeRange: { startSec: 17.5, endSec: 20 } },

    // ── 해시태그 ───────────────────────────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#motivation', '#speech', '#inspire', '#believe', '#riseup', '#motiq'], speedPxPerSec: 80, fontSize: 26, bgColor: 'rgba(11,24,40,0.7)', color: LIGHT, accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 17 } },
  ],

  hashtags: ['motivation', 'speech', 'inspire', 'believe', 'riseup', 'motiq'],

  missionTimeline: [
    { id: 'speech_loud', startSec: 2, endSec: 17, mission: { kind: 'loud_voice', minDb: -22, durationMs: 4000 }, scoreWeight: 1.0, hudBinding: 'hud_prompt' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.75 },
    { kind: 'film_grain', opacity: 0.18 },
    { kind: 'vignette', intensity: 0.32 },
    { kind: 'saturation', boost: 0.1 },
  ],

  successEffects: [
    { kind: 'lens_flare', durationMs: 800 },
    { kind: 'particle_burst', durationMs: 900, props: { colors: [GOLD, LIGHT] } },
    { kind: 'confetti', durationMs: 1000 },
  ],
  failEffects: [],
};
