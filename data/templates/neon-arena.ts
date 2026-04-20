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
    src: '/bgm/synthwave-128.mp3',
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
    { id: 'hud_prompt',     type: 'mission_prompt',   zIndex: 63, opacity: 1,    enabled: true, props: { text: '스쿼트 10회', neonAccent: '#FF2D95' }, activeRange: { startSec: 0, endSec: 2 } },

    // 성공 이펙트 (기본 비활성, 미션 성공 시 활성)
    { id: 'fx_burst',       type: 'particle_burst',   zIndex: 80, opacity: 1,    enabled: false, props: { count: 50, colors: ['#FF2D95', '#00E0FF', '#39FF7D'] } },
    { id: 'fx_lens_flare',  type: 'lens_flare',       zIndex: 81, opacity: 1,    enabled: false },
    { id: 'fx_chromatic',   type: 'chromatic_pulse',  zIndex: 82, opacity: 1,    enabled: false, props: { peakPx: 8 } },
    { id: 'fx_perfect_text',type: 'kinetic_text',     zIndex: 83, opacity: 1,    enabled: false, props: { text: 'PERFECT!', fontSize: 120, color: '#FF2D95' } },
  ],

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
