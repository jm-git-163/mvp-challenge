/**
 * data/templates/neon-arena.ts
 *
 * Phase 5i Template 1: **사이버펑크 스쿼트 챌린지**.
 * docs/TEMPLATES.md §템플릿 1 그대로 선언.
 *
 * 에셋은 현재 플레이스홀더 경로. 사용자가 CLAUDE §8.1 에셋 교체 단계에서 갱신.
 */

import type { Template } from '../../engine/templates/schema';

export const neonArena: Template = {
  id: 'neon-arena',
  title: '네온 아레나',
  description: '사이버펑크 네온 아레나에서 스쿼트 챌린지. 격렬한 에너지.',
  thumbnail: '/templates/neon-arena/thumb.png',
  previewVideo: '/templates/neon-arena/preview.mp4',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'neon_cyberpunk',

  bgm: {
    // 플레이스홀더 synthwave 트랙 (scripts/generate-placeholder-bgm.js 로 생성).
    // Expo SDK 50+ public/ 디렉터리 → 빌드 시 dist/bgm/ 로 자동 복사.
    // WAV 포맷 선택: 런타임 데코딩 단순, Safari·Chrome·Firefox 전부 네이티브 지원.
    src: '/bgm/synthwave-128.wav',
    volume: 0.7,
    beatsJson: '/bgm/synthwave-128.beats.json',
    loop: true,
    duckingDb: -8,
  },

  cameraFraming: { kind: 'hexagon', centerX: 540, centerY: 960, size: 380 },

  layers: [
    // 배경 (zIndex 1~10)
    { id: 'bg_mesh',        type: 'gradient_mesh',    zIndex: 1,  opacity: 1,    enabled: true, props: { colors: ['#1A0B2E', '#000000', '#0B1F4D'], rotatePeriodSec: 60 } },
    { id: 'bg_grid',        type: 'animated_grid',    zIndex: 2,  opacity: 1,    enabled: true, props: { color: '#FF2D95', perspective: true, scrollPerBarPx: 64 } },
    { id: 'bg_stars',       type: 'star_field',       zIndex: 3,  opacity: 0.85, enabled: true, props: { count: 120, driftPxPerSec: 4 } },
    { id: 'bg_shapes',      type: 'floating_shapes',  zIndex: 4,  opacity: 0.9,  enabled: true, props: { shapes: ['cube', 'cube', 'cube', 'pyramid', 'pyramid', 'sphere'] } },
    { id: 'bg_noise',       type: 'noise_pattern',    zIndex: 5,  opacity: 0.08, enabled: true },

    // ── INTRO (0 ~ 2.8s) : 풀스크린 네온 타이틀 시퀀스 ──────────────
    { id: 'intro_flash',    type: 'beat_flash',       zIndex: 10, opacity: 1,    enabled: true, props: { color: '#FF2D95', peakOpacity: 0.6 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',    type: 'kinetic_text',     zIndex: 11, opacity: 1,    enabled: true, props: { text: 'FITNESS MODE', fontSize: 140, color: '#FF2D95', strokeColor: '#00E0FF', strokeWidth: 10, mode: 'pop', staggerMs: 70, position: 'center', startMs: 200 }, activeRange: { startSec: 0, endSec: 2.8 } },
    { id: 'intro_subtitle', type: 'kinetic_text',     zIndex: 12, opacity: 1,    enabled: true, props: { text: 'SQUAT × 10', fontSize: 72, color: '#00E0FF', strokeColor: '#000000', strokeWidth: 6, mode: 'drop', staggerMs: 50, position: 'bottom-center', startMs: 900 }, activeRange: { startSec: 0.4, endSec: 2.8 } },
    { id: 'intro_burst',    type: 'particle_burst',   zIndex: 13, opacity: 1,    enabled: true, props: { burstCount: 80, colors: ['#FF2D95', '#00E0FF', '#39FF7D'], triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1400, speedMin: 260, speedMax: 600, origin: 'center' }, activeRange: { startSec: 0, endSec: 0.9 } },
    { id: 'intro_ticker',   type: 'news_ticker',      zIndex: 14, opacity: 1,    enabled: true, props: { texts: ['READY', 'SET', 'CHALLENGE STARTS'], speedPxPerSec: 320, fontSize: 42, bgColor: '#FF2D95', color: '#FFFFFF', accentColor: '#00E0FF', position: 'top', labelText: 'LIVE', labelBg: '#00E0FF', labelColor: '#000000' }, activeRange: { startSec: 0.3, endSec: 2.8 } },

    // 카메라 (zIndex 20~25)
    { id: 'cam_feed',       type: 'camera_feed',      zIndex: 20, opacity: 1,    enabled: true },
    { id: 'cam_frame',      type: 'camera_frame',     zIndex: 21, opacity: 1,    enabled: true,
      props: { ringColor: '#FF2D95', ringWidth: 2, glowBlur: 12 },
      reactive: { onBeat: { every: 1, property: 'glow', amount: 0.5, easing: 'overshoot', durationMs: 120 } } },
    { id: 'cam_reflect',    type: 'camera_reflection',zIndex: 22, opacity: 0.4,  enabled: true },

    // AR (zIndex 30~35)
    { id: 'ar_visor',       type: 'face_sticker',     zIndex: 30, opacity: 1,    enabled: true,
      props: { asset: '/stickers/cyber-visor.svg' },
      reactive: { track: { landmark: 'left_eye', offset: { x: 0, y: -12 }, rotateWith: 'face_roll', scaleWith: 'face_size' } } },
    { id: 'ar_hand_l_spark',type: 'hand_emoji',       zIndex: 31, opacity: 1,    enabled: true,
      props: { particle: 'electric_spark' },
      reactive: { track: { landmark: 'left_hand', offset: { x: 0, y: 0 }, rotateWith: 'none', scaleWith: 'none' } } },
    { id: 'ar_hand_r_spark',type: 'hand_emoji',       zIndex: 32, opacity: 1,    enabled: true,
      props: { particle: 'electric_spark' },
      reactive: { track: { landmark: 'right_hand', offset: { x: 0, y: 0 }, rotateWith: 'none', scaleWith: 'none' } } },

    // 전경 (40~50)
    { id: 'fg_particles',   type: 'particle_ambient', zIndex: 40, opacity: 0.8,  enabled: true, props: { preset: 'electric_blue_rise', count: 60 } },
    { id: 'fg_ring',        type: 'orbiting_ring',    zIndex: 41, opacity: 0.7,  enabled: true, props: { color: '#00E0FF', radiusPx: 460, widthPx: 2, periodSec: 8 } },
    { id: 'fg_flash',       type: 'beat_flash',       zIndex: 42, opacity: 1,    enabled: true, props: { color: '#FF2D95', peakOpacity: 0.25 },
      reactive: { onOnset: { property: 'opacity', amount: 0.25, easing: 'standard', durationMs: 150 } } },
    { id: 'fg_visualizer',  type: 'audio_visualizer', zIndex: 43, opacity: 0.9,  enabled: true, props: { kind: 'bars', side: 'both', color: '#00E0FF' } },

    // HUD (60~70)
    { id: 'hud_counter',    type: 'counter_hud',      zIndex: 60, opacity: 1,    enabled: true, props: { target: 10, format: '{n} / 10', fontSize: 72, fontFamily: '"JetBrains Mono"' } },
    { id: 'hud_timer',      type: 'timer_ring',       zIndex: 61, opacity: 1,    enabled: true, props: { position: 'top-left', color: '#00E0FF' } },
    { id: 'hud_score',      type: 'score_hud',        zIndex: 62, opacity: 1,    enabled: true, props: { position: 'top-right', glass: true } },
    { id: 'hud_prompt',     type: 'mission_prompt',   zIndex: 63, opacity: 1,    enabled: true, props: { text: '스쿼트 10회', neonAccent: '#FF2D95' }, activeRange: { startSec: 2.8, endSec: 5 } },

    // ── 메인 구간 자막 타임라인 (cue texts) ─────────────────────────
    { id: 'cap_ready',      type: 'kinetic_text',     zIndex: 64, opacity: 1, enabled: true, props: { text: '준비', fontSize: 84, color: '#00E0FF', strokeColor: '#000000', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 2800, staggerMs: 60 }, activeRange: { startSec: 2.8, endSec: 4.2 } },
    { id: 'cap_start',      type: 'kinetic_text',     zIndex: 65, opacity: 1, enabled: true, props: { text: 'GO!', fontSize: 160, color: '#39FF7D', strokeColor: '#FF2D95', strokeWidth: 10, mode: 'pop', position: 'center', startMs: 4200, staggerMs: 40 }, activeRange: { startSec: 4.2, endSec: 5.4 } },
    { id: 'cap_push',       type: 'kinetic_text',     zIndex: 66, opacity: 1, enabled: true, props: { text: 'PUSH HARDER', fontSize: 72, color: '#FF2D95', strokeColor: '#000000', strokeWidth: 6, mode: 'drop', position: 'bottom-center', startMs: 7500, staggerMs: 50 }, activeRange: { startSec: 7.5, endSec: 9 } },
    { id: 'cap_half',       type: 'kinetic_text',     zIndex: 67, opacity: 1, enabled: true, props: { text: 'HALFWAY', fontSize: 72, color: '#00E0FF', strokeColor: '#000000', strokeWidth: 6, mode: 'spin', position: 'top-center', startMs: 10000, staggerMs: 60 }, activeRange: { startSec: 10, endSec: 11.5 } },
    { id: 'cap_final',      type: 'kinetic_text',     zIndex: 68, opacity: 1, enabled: true, props: { text: 'FINAL REPS', fontSize: 72, color: '#FF2D95', strokeColor: '#00E0FF', strokeWidth: 6, mode: 'drop', position: 'bottom-center', startMs: 15000, staggerMs: 50 }, activeRange: { startSec: 15, endSec: 16.5 } },

    // ── 하단 해시태그 스트립 (메인 구간 내내) ────────────────────
    { id: 'hashtag_strip',  type: 'news_ticker',      zIndex: 70, opacity: 0.92, enabled: true, props: { texts: ['#squat', '#fitness', '#cyberpunk', '#neon', '#challenge', '#workout', '#motiq'], separator: '   ', speedPxPerSec: 90, fontSize: 30, bgColor: 'rgba(0,0,0,0.55)', color: '#00E0FF', accentColor: '#FF2D95', position: 'bottom' }, activeRange: { startSec: 2.8, endSec: 17 } },

    // FIX-Z22: 메인 구간 내내 비트 플래시·렌즈플레어·추가 버스트로 시각 자극 강화
    { id: 'main_beat_flash', type: 'beat_flash',       zIndex: 71, opacity: 1, enabled: true, props: { color: '#FF2D95', maxAlpha: 0.35, curve: 'quad' }, reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.35, easing: 'standard', durationMs: 120 } }, activeRange: { startSec: 2.8, endSec: 17 } },
    { id: 'main_lens_flare', type: 'lens_flare',       zIndex: 72, opacity: 0.7, enabled: true, props: { color: '#00E0FF', x: 540, y: 400 }, activeRange: { startSec: 4, endSec: 17 } },
    { id: 'main_burst_mid',  type: 'particle_burst',   zIndex: 73, opacity: 1, enabled: true, props: { burstCount: 50, colors: ['#FF2D95', '#00E0FF'], triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 900, speedMin: 150, speedMax: 400, origin: 'center' }, activeRange: { startSec: 8, endSec: 9 } },
    { id: 'main_chromatic',  type: 'chromatic_pulse',  zIndex: 74, opacity: 1, enabled: true, props: { peakPx: 4 }, reactive: { onOnset: { property: 'opacity', amount: 0.5, easing: 'standard', durationMs: 180 } }, activeRange: { startSec: 2.8, endSec: 17 } },

    // ── OUTRO (17 ~ 20s) : 점수·별점·CTA ───────────────────────
    { id: 'outro_flash',    type: 'beat_flash',       zIndex: 75, opacity: 1, enabled: true, props: { color: '#00E0FF', peakOpacity: 0.55 }, activeRange: { startSec: 17, endSec: 17.5 } },
    { id: 'outro_title',    type: 'kinetic_text',     zIndex: 76, opacity: 1, enabled: true, props: { text: 'CHALLENGE COMPLETE', fontSize: 88, color: '#FF2D95', strokeColor: '#00E0FF', strokeWidth: 8, mode: 'pop', position: 'center', startMs: 17100, staggerMs: 55 }, activeRange: { startSec: 17, endSec: 20 } },
    { id: 'outro_score',    type: 'kinetic_text',     zIndex: 77, opacity: 1, enabled: true, props: { text: '★ ★ ★ ★ ★', fontSize: 110, color: '#FFD700', strokeColor: '#FF2D95', strokeWidth: 8, mode: 'drop', position: 'top-center', startMs: 17700, staggerMs: 140 }, activeRange: { startSec: 17.5, endSec: 20 } },
    { id: 'outro_cta',      type: 'kinetic_text',     zIndex: 78, opacity: 1, enabled: true, props: { text: 'TAP TO RETRY', fontSize: 52, color: '#00E0FF', strokeColor: '#000000', strokeWidth: 5, mode: 'drop', position: 'bottom-center', startMs: 18700, staggerMs: 40 }, activeRange: { startSec: 18.5, endSec: 20 } },
    { id: 'outro_burst',    type: 'particle_burst',   zIndex: 79, opacity: 1, enabled: true, props: { burstCount: 120, colors: ['#FF2D95', '#00E0FF', '#39FF7D', '#FFD700'], triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1800, speedMin: 300, speedMax: 700, origin: 'center' }, activeRange: { startSec: 17, endSec: 17.6 } },

    // 성공 이펙트 (기본 비활성, 미션 성공 시 활성)
    { id: 'fx_burst',       type: 'particle_burst',   zIndex: 80, opacity: 1,    enabled: false, props: { count: 50, colors: ['#FF2D95', '#00E0FF', '#39FF7D'] } },
    { id: 'fx_lens_flare',  type: 'lens_flare',       zIndex: 81, opacity: 1,    enabled: false },
    { id: 'fx_chromatic',   type: 'chromatic_pulse',  zIndex: 82, opacity: 1,    enabled: false, props: { peakPx: 8 } },
    { id: 'fx_perfect_text',type: 'kinetic_text',     zIndex: 83, opacity: 1,    enabled: false, props: { text: 'PERFECT!', fontSize: 120, color: '#FF2D95' } },
  ],

  hashtags: ['squat', 'fitness', 'cyberpunk', 'neon', 'challenge', 'workout', 'motiq'],

  missionTimeline: [
    {
      id: 'main_squat', startSec: 2, endSec: 20,
      mission: { kind: 'squat_count', target: 10 },
      scoreWeight: 1.0,
      hudBinding: 'hud_counter',
    },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 1.2 },
    { kind: 'chromatic', baseOffsetPx: 2, onOnsetPx: 8 },
    { kind: 'crt_scanlines', opacity: 0.15 },
    { kind: 'vignette', intensity: 0.3 },
  ],

  successEffects: [
    { kind: 'lens_flare', durationMs: 600 },
    { kind: 'particle_burst', durationMs: 800, props: { count: 120 } },
    { kind: 'kinetic_text', durationMs: 1200, props: { text: 'CHAMPION' } },
  ],
  failEffects: [
    { kind: 'chromatic_pulse', durationMs: 300 },
    { kind: 'lut_mono', durationMs: 500 },
  ],
};
