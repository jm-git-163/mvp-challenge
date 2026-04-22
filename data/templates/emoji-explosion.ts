/**
 * data/templates/emoji-explosion.ts
 *
 * Phase 5i Template 3: **팝 코믹 표정+제스처**.
 * docs/TEMPLATES.md §템플릿 3.
 */

import type { Template } from '../../engine/templates/schema';

export const emojiExplosion: Template = {
  id: 'emoji-explosion',
  title: '이모지 폭발',
  description: '캔디 컬러 팝. 미소 → 피스 → 손들기 3씬.',
  thumbnail: '/templates/emoji-explosion/thumb.png',
  previewVideo: '/templates/emoji-explosion/preview.mp4',
  duration: 18.5,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'pop_candy',

  bgm: {
    // FIX-Z8 (2026-04-22): kpop-upbeat-124.mp3 에셋 부재. 실존 업비트 트랙으로 재매핑.
    src: '/bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3',
    volume: 0.75,
    beatsJson: '/bgm/backgroundmusicforvideos-no-copyright-music-334863.beats.json',
    loop: true,
    duckingDb: -6,
  },

  cameraFraming: { kind: 'heart', centerX: 540, centerY: 960, size: 420 },

  layers: [
    // 배경 (1~10)
    { id: 'bg_mesh',     type: 'gradient_mesh',    zIndex: 1, opacity: 1,    enabled: true, props: { colors: ['#FFB6C1', '#B5E3D8', '#D8BFD8'], hueCyclePeriodSec: 30 } },
    { id: 'bg_clouds',   type: 'floating_shapes',  zIndex: 2, opacity: 0.8,  enabled: true, props: { shapes: ['cloud', 'star', 'heart', 'cloud', 'star', 'heart', 'cloud', 'star'] } },
    { id: 'bg_glitter',  type: 'particle_ambient', zIndex: 3, opacity: 0.9,  enabled: true, props: { preset: 'glitter_down', count: 40 } },

    // 카메라 (20~30)
    { id: 'cam_feed',    type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',   type: 'camera_frame',     zIndex: 21, opacity: 1, enabled: true, props: { borderColor: '#FF2D95', borderWidth: 3, glowBlur: 18 },
      reactive: { onBeat: { every: 1, property: 'scale', amount: 0.05, easing: 'bounce', durationMs: 180 } } },
    { id: 'orbit_emoji_1', type: 'floating_shapes',zIndex: 22, opacity: 1, enabled: true, props: { emoji: '💖', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 0 } } },
    { id: 'orbit_emoji_2', type: 'floating_shapes',zIndex: 23, opacity: 1, enabled: true, props: { emoji: '✨', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 60 } } },
    { id: 'orbit_emoji_3', type: 'floating_shapes',zIndex: 24, opacity: 1, enabled: true, props: { emoji: '⭐️', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 120 } } },
    { id: 'orbit_emoji_4', type: 'floating_shapes',zIndex: 25, opacity: 1, enabled: true, props: { emoji: '🎉', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 180 } } },
    { id: 'orbit_emoji_5', type: 'floating_shapes',zIndex: 26, opacity: 1, enabled: true, props: { emoji: '🌈', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 240 } } },
    { id: 'orbit_emoji_6', type: 'floating_shapes',zIndex: 27, opacity: 1, enabled: true, props: { emoji: '🦄', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 300 } } },

    // AR (35~45)
    { id: 'cheek_l',     type: 'face_sticker',     zIndex: 35, opacity: 1, enabled: true, props: { asset: '💖', sizePx: 60 },
      reactive: { track: { landmark: 'left_cheek', offset: { x: 0, y: 0 }, rotateWith: 'face_yaw', scaleWith: 'face_size' } } },
    { id: 'cheek_r',     type: 'face_sticker',     zIndex: 36, opacity: 1, enabled: true, props: { asset: '💖', sizePx: 60 },
      reactive: { track: { landmark: 'right_cheek', offset: { x: 0, y: 0 }, rotateWith: 'face_yaw', scaleWith: 'face_size' } } },
    { id: 'forehead_star',type: 'face_sticker',    zIndex: 37, opacity: 1, enabled: true, props: { asset: '⭐️', sizePx: 72 },
      reactive: { track: { landmark: 'forehead', offset: { x: 0, y: -20 }, rotateWith: 'face_roll', scaleWith: 'face_size' } } },
    { id: 'rabbit_ears', type: 'face_mask',        zIndex: 38, opacity: 1, enabled: true, props: { asset: '/stickers/rabbit-ears.svg', scaleWithFaceSize: true } },
    { id: 'hand_emoji',  type: 'hand_emoji',       zIndex: 39, opacity: 1, enabled: true, props: { dynamicEmojiBy: 'gesture' } },

    // 미드 전경 (50~60)
    { id: 'fg_hearts',   type: 'particle_ambient', zIndex: 50, opacity: 0.9, enabled: true, props: { preset: 'small_hearts_up', count: 20 } },
    { id: 'beat_luv',    type: 'beat_text',        zIndex: 51, opacity: 1, enabled: true, props: { text: 'LUV', color: '#FF2D95', fontSize: 120, position: 'top-right' } },
    { id: 'kinetic_cta', type: 'kinetic_text',     zIndex: 52, opacity: 1, enabled: true, props: { text: 'MAKE EM SMILE!', style: 'wavy', color: '#39FF7D' } },

    // HUD (65~75)
    { id: 'hud_prompt',  type: 'mission_prompt',   zIndex: 65, opacity: 1, enabled: true, props: { text: '웃어보세요!', color: '#FF2D95' }, activeRange: { startSec: 2, endSec: 7 } },
    { id: 'hud_prompt2', type: 'mission_prompt',   zIndex: 66, opacity: 1, enabled: true, props: { text: '✌️ 만들어주세요!', color: '#39FF7D' }, activeRange: { startSec: 7, endSec: 12 } },
    { id: 'hud_prompt3', type: 'mission_prompt',   zIndex: 67, opacity: 1, enabled: true, props: { text: '손 들어!', color: '#FF8A3D' }, activeRange: { startSec: 12, endSec: 17 } },
    { id: 'hud_score',   type: 'score_hud',        zIndex: 68, opacity: 1, enabled: true, props: { position: 'top-right', bigNumber: true } },
    { id: 'hud_timer',   type: 'timer_ring',       zIndex: 69, opacity: 1, enabled: true, props: { position: 'top-left' } },

    // 반응형 (70~80)
    { id: 'voice_bubble',type: 'voice_bubble',     zIndex: 70, opacity: 1, enabled: true },
    { id: 'audio_radial',type: 'audio_visualizer', zIndex: 71, opacity: 1, enabled: true, props: { kind: 'radial', onOnsetOnly: true } },

    // 미션별 전용 (85~90)
    { id: 'sc1_burst',   type: 'particle_burst',   zIndex: 85, opacity: 1, enabled: false, props: { count: 60, emojis: ['💕', '😘', '💗'] } },
    { id: 'sc1_text',    type: 'kinetic_text',     zIndex: 86, opacity: 1, enabled: false, props: { text: 'AWW 💕' } },
    { id: 'sc2_burst',   type: 'particle_burst',   zIndex: 87, opacity: 1, enabled: false, props: { count: 40, emojis: ['✌️'] } },
    { id: 'sc2_text',    type: 'kinetic_text',     zIndex: 88, opacity: 1, enabled: false, props: { text: 'PEACE OUT ✌️' } },
    { id: 'sc3_flare',   type: 'lens_flare',       zIndex: 89, opacity: 1, enabled: false },
    { id: 'sc3_confetti',type: 'particle_burst',   zIndex: 90, opacity: 1, enabled: false, props: { count: 80, colors: ['#FF2D95', '#00E0FF', '#39FF7D', '#FF8A3D'] } },

    // 글로벌 성공 (95)
    { id: 'global_confetti', type: 'confetti',     zIndex: 95, opacity: 1, enabled: false },
  ],

  missionTimeline: [
    { id: 'sc1_smile',    startSec: 2,  endSec: 7,  mission: { kind: 'smile', intensity: 0.6, durationMs: 2000 }, scoreWeight: 0.34, hudBinding: 'hud_prompt' },
    { id: 'sc2_gesture',  startSec: 7,  endSec: 12, mission: { kind: 'gesture', gesture: 'peace' },               scoreWeight: 0.33, hudBinding: 'hud_prompt2' },
    { id: 'sc3_pose',     startSec: 12, endSec: 17, mission: { kind: 'pose_hold', pose: 'hands_up', holdMs: 2000 }, scoreWeight: 0.33, hudBinding: 'hud_prompt3' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.8 },
    { kind: 'saturation', boost: 0.2 },
    { kind: 'bokeh', strength: 0.3 },
  ],

  successEffects: [
    { kind: 'confetti', durationMs: 2000 },
  ],
  failEffects: [
    { kind: 'kinetic_text', durationMs: 800, props: { text: 'AGAIN?' } },
  ],
};
