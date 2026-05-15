/**
 * data/templates/emoji-explosion.ts
 *
 * Phase 5i Template 3: **팝 코믹 표정+제스처**.
 * docs/TEMPLATES.md §템플릿 3.
 *
 * TEAM-TEMPLATE (2026-04-22) — 팔레트 재설계 + 차별화:
 *  - 핫핑크 `#FF2D95` 를 neon-arena 전용으로 예약, 본 템플릿은 소프트핑크 `#FF6FB5`
 *    + 라벤더 `#C8A2FF` 조합으로 톤다운 (docs/research/03 §4.1).
 *  - kinetic_text mode 는 'pop' (bounce) 위주로 통일 → news-anchor drop 과 구분.
 *  - orbit_emoji_* 6개를 상·하 밴드(centerY 400/1500)로 분할, 반경 200으로 축소해
 *    얼굴존(y 540~1200) 침범 완전 회피 (docs/research/03 §2.5).
 *  - hud_prompt* 은 명시적 `position:'bottom'` 로 고정.
 */

import type { Template } from '../../engine/templates/schema';

// 팔레트 토큰 (템플릿 내 일관성 유지)
const SOFT_PINK = '#FF6FB5';
const LAVENDER  = '#C8A2FF';
const MINT      = '#39FF7D';
const GOLD      = '#FFD700';
const ORANGE    = '#FF8A3D';

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
    // 배경 (1~10) — 소프트핑크 + 라벤더 + 민트 팔레트로 변경
    { id: 'bg_mesh',     type: 'gradient_mesh',    zIndex: 1, opacity: 1,    enabled: true, props: { colors: ['#FFD3E3', SOFT_PINK, LAVENDER], hueCyclePeriodSec: 30 } },
    { id: 'bg_stars',    type: 'star_field',       zIndex: 2, opacity: 0.7,  enabled: true, props: { count: 80, driftPxPerSec: 6 } },
    // 상단 밴드: 하트+별 (소프트핑크 계열 emoji)
    { id: 'bg_clouds_top', type: 'floating_shapes',zIndex: 3, opacity: 0.8,  enabled: true, props: { shapes: ['heart', 'star', 'cloud', 'heart', 'star'], yBand: [60, 420], tint: SOFT_PINK, sizeJitter: 0.4 } },
    // 하단 밴드: 라벤더 톤으로 차별
    { id: 'bg_clouds_bot', type: 'floating_shapes',zIndex: 4, opacity: 0.8,  enabled: true, props: { shapes: ['heart', 'star', 'cloud', 'star'], yBand: [1460, 1800], tint: LAVENDER, sizeJitter: 0.3 } },
    { id: 'bg_cheer',    type: 'particle_ambient', zIndex: 5, opacity: 0.8,  enabled: true, props: { preset: 'small_hearts_up', count: 28 } },
    { id: 'bg_glitter',  type: 'particle_ambient', zIndex: 6, opacity: 0.85, enabled: true, props: { preset: 'glitter_down', count: 40 } },

    // 카메라 (20~30)
    { id: 'cam_feed',    type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',   type: 'camera_frame',     zIndex: 21, opacity: 1, enabled: true, props: { borderColor: SOFT_PINK, borderWidth: 3, glowBlur: 18 },
      reactive: { onBeat: { every: 1, property: 'scale', amount: 0.05, easing: 'bounce', durationMs: 180 } } },
    // Orbit emoji 6종 — 얼굴존(y 540~1200) 회피: 상단(centerY=400) 3개 + 하단(centerY=1500) 3개, 반경 축소 260→200
    { id: 'orbit_emoji_1', type: 'floating_shapes',zIndex: 22, opacity: 1, enabled: true, props: { emoji: '💖', orbit: { radiusPx: 200, periodSec: 6, phaseDeg:   0, centerY: 400  } } },
    { id: 'orbit_emoji_2', type: 'floating_shapes',zIndex: 23, opacity: 1, enabled: true, props: { emoji: '✨', orbit: { radiusPx: 200, periodSec: 6, phaseDeg: 120, centerY: 400  } } },
    { id: 'orbit_emoji_3', type: 'floating_shapes',zIndex: 24, opacity: 1, enabled: true, props: { emoji: '⭐️', orbit: { radiusPx: 200, periodSec: 6, phaseDeg: 240, centerY: 400  } } },
    { id: 'orbit_emoji_4', type: 'floating_shapes',zIndex: 25, opacity: 1, enabled: true, props: { emoji: '🎉', orbit: { radiusPx: 200, periodSec: 7, phaseDeg:  60, centerY: 1500 } } },
    { id: 'orbit_emoji_5', type: 'floating_shapes',zIndex: 26, opacity: 1, enabled: true, props: { emoji: '🌈', orbit: { radiusPx: 200, periodSec: 7, phaseDeg: 180, centerY: 1500 } } },
    { id: 'orbit_emoji_6', type: 'floating_shapes',zIndex: 27, opacity: 1, enabled: true, props: { emoji: '🦄', orbit: { radiusPx: 200, periodSec: 7, phaseDeg: 300, centerY: 1500 } } },

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
    { id: 'beat_luv',    type: 'beat_text',        zIndex: 51, opacity: 1, enabled: true, props: { text: 'LUV', color: SOFT_PINK, fontSize: 120, position: 'top-right' } },
    { id: 'kinetic_cta', type: 'kinetic_text',     zIndex: 52, opacity: 1, enabled: true, props: { text: 'MAKE EM SMILE!', style: 'bounce', color: MINT, fontSize: 60, position: 'bottom-center', mode: 'pop', staggerMs: 45 } },

    // HUD (65~75) — 모두 명시적 bottom 으로 고정 (default top 이지만 pop_candy 는 하단 버블 컨셉)
    { id: 'hud_prompt',  type: 'mission_prompt',   zIndex: 65, opacity: 1, enabled: true, props: { text: '웃어보세요!',       color: SOFT_PINK, position: 'bottom' }, activeRange: { startSec: 2,  endSec: 7  } },
    { id: 'hud_prompt2', type: 'mission_prompt',   zIndex: 66, opacity: 1, enabled: true, props: { text: '✌️ 만들어주세요!', color: MINT,      position: 'bottom' }, activeRange: { startSec: 7,  endSec: 12 } },
    { id: 'hud_prompt3', type: 'mission_prompt',   zIndex: 67, opacity: 1, enabled: true, props: { text: '손 들어!',          color: ORANGE,    position: 'bottom' }, activeRange: { startSec: 12, endSec: 17 } },
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
    { id: 'sc3_confetti',type: 'particle_burst',   zIndex: 90, opacity: 1, enabled: false, props: { count: 80, colors: [SOFT_PINK, LAVENDER, MINT, ORANGE] } },

    // 글로벌 성공 (95)
    { id: 'global_confetti', type: 'confetti',     zIndex: 95, opacity: 1, enabled: false },

    // ── INTRO (0 ~ 2.5s) : 스티커 임프린트 시퀀스 (emoji 고유 mode='pop' bouncy) ─────────
    { id: 'intro_flash',   type: 'beat_flash',    zIndex: 28, opacity: 1, enabled: true, props: { color: SOFT_PINK, peakOpacity: 0.45, curve: 'bounce' }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',  zIndex: 29, opacity: 1, enabled: true, props: { text: '⭐ KPOP CHALLENGE', fontSize: 90, color: '#FFFFFF', strokeColor: SOFT_PINK, strokeWidth: 10, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 70 }, activeRange: { startSec: 0, endSec: 2.5 } },
    { id: 'intro_sub',     type: 'kinetic_text',  zIndex: 30, opacity: 1, enabled: true, props: { text: '💖 SMILE · ✌ PEACE · 🙌 JUMP', fontSize: 52, color: MINT, strokeColor: LAVENDER, strokeWidth: 6, mode: 'pop', position: 'bottom-center', startMs: 900, staggerMs: 65 }, activeRange: { startSec: 0.4, endSec: 2.5 } },
    { id: 'intro_burst',   type: 'particle_burst',zIndex: 31, opacity: 1, enabled: true, props: { burstCount: 100, colors: [SOFT_PINK, GOLD, MINT, LAVENDER, ORANGE], triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1600, speedMin: 300, speedMax: 700, shape: 'star', origin: 'center' }, activeRange: { startSec: 0, endSec: 0.9 } },

    // ── 캡션/제스처 큐 타임라인 (모두 mode='pop' 으로 통일 → emoji 고유 bounce 인상) ────
    { id: 'cue_smile',     type: 'kinetic_text',  zIndex: 54, opacity: 1, enabled: true, props: { text: 'SMILE! 😊', fontSize: 88, color: SOFT_PINK, strokeColor: '#FFFFFF', strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 2500, staggerMs: 55 }, activeRange: { startSec: 2.5, endSec: 4.5 } },
    { id: 'cue_heart',     type: 'kinetic_text',  zIndex: 55, opacity: 1, enabled: true, props: { text: 'HEART! 💖', fontSize: 88, color: SOFT_PINK, strokeColor: LAVENDER,  strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 5500, staggerMs: 55 }, activeRange: { startSec: 5.5, endSec: 7 } },
    { id: 'cue_peace',     type: 'kinetic_text',  zIndex: 56, opacity: 1, enabled: true, props: { text: 'PEACE! ✌',  fontSize: 88, color: MINT,       strokeColor: '#FFFFFF', strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 8000, staggerMs: 55 }, activeRange: { startSec: 8, endSec: 10 } },
    { id: 'cue_jump',      type: 'kinetic_text',  zIndex: 57, opacity: 1, enabled: true, props: { text: 'JUMP! 🙌',  fontSize: 88, color: ORANGE,     strokeColor: '#FFFFFF', strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 12500, staggerMs: 55 }, activeRange: { startSec: 12.5, endSec: 14.5 } },

    // ── 하단 해시태그 스트립 — 소프트핑크 bg + 골드 accent 로 news-anchor(네이비 bg) 와 차별
    { id: 'hashtag_strip', type: 'news_ticker',   zIndex: 72, opacity: 0.92, enabled: true, props: { texts: ['#kpop', '#love', '#star', '#cute', '#smile', '#challenge', '#motiq'], separator: '  ', speedPxPerSec: 110, fontSize: 30, bgColor: 'rgba(255,111,181,0.55)', color: '#FFFFFF', accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2.5, endSec: 16.5 } },

    // FIX-Z22 + 팔레트 재조정
    { id: 'burst_scene1',  type: 'particle_burst', zIndex: 84, opacity: 1, enabled: true, props: { burstCount: 60, colors: [SOFT_PINK, GOLD],     triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1200, speedMin: 200, speedMax: 500, shape: 'star', origin: 'center' }, activeRange: { startSec: 3.5, endSec: 4.2  } },
    { id: 'burst_scene2',  type: 'particle_burst', zIndex: 85, opacity: 1, enabled: true, props: { burstCount: 60, colors: [MINT, LAVENDER],      triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1200, speedMin: 200, speedMax: 500, shape: 'star', origin: 'center' }, activeRange: { startSec: 9,   endSec: 9.7  } },
    { id: 'burst_scene3',  type: 'particle_burst', zIndex: 86, opacity: 1, enabled: true, props: { burstCount: 70, colors: [ORANGE, SOFT_PINK],   triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 1400, speedMin: 250, speedMax: 550, shape: 'star', origin: 'center' }, activeRange: { startSec: 13.5, endSec: 14.3 } },
    // emoji 고유 beat_flash: 느린(every 4) + 낮은 alpha + bounce curve → neon-arena 의 빠른 마젠타 펄스와 차별
    { id: 'pink_flash',    type: 'beat_flash',     zIndex: 73, opacity: 1, enabled: true, props: { color: SOFT_PINK, maxAlpha: 0.22, curve: 'bounce' }, reactive: { onBeat: { every: 4, property: 'opacity', amount: 0.22, easing: 'bounce', durationMs: 220 } }, activeRange: { startSec: 2.5, endSec: 16.5 } },
    { id: 'main_lens_flare', type: 'lens_flare',   zIndex: 79, opacity: 0.55, enabled: true, props: { color: GOLD, x: 540, y: 500 }, activeRange: { startSec: 5, endSec: 16 } },

    // ── OUTRO (16 ~ 18.5s) : 폴라로이드 스냅 느낌 (pop bounce + gold confetti) ──
    { id: 'outro_flash',   type: 'beat_flash',    zIndex: 74, opacity: 1, enabled: true, props: { color: GOLD,      peakOpacity: 0.6 }, activeRange: { startSec: 16, endSec: 16.5 } },
    { id: 'outro_title',   type: 'kinetic_text',  zIndex: 75, opacity: 1, enabled: true, props: { text: 'SO CUTE! 💖', fontSize: 92, color: SOFT_PINK, strokeColor: '#FFFFFF', strokeWidth: 10, mode: 'pop', position: 'top-center', startMs: 16100, staggerMs: 70 }, activeRange: { startSec: 16, endSec: 18.5 } },
    { id: 'outro_score',   type: 'kinetic_text',  zIndex: 76, opacity: 1, enabled: true, props: { text: '★ ★ ★ ★ ★',   fontSize: 100, color: GOLD,     strokeColor: SOFT_PINK, strokeWidth: 8,  mode: 'pop', position: 'top-center', startMs: 16700, staggerMs: 140 }, activeRange: { startSec: 16.5, endSec: 18.5 } },
    { id: 'outro_cta',     type: 'kinetic_text',  zIndex: 77, opacity: 1, enabled: true, props: { text: 'TAP TO RETRY',  fontSize: 48,  color: MINT,     strokeColor: LAVENDER,  strokeWidth: 5,  mode: 'pop', position: 'bottom-center', startMs: 17500, staggerMs: 50 }, activeRange: { startSec: 17.5, endSec: 18.5 } },
    { id: 'outro_burst',   type: 'particle_burst',zIndex: 78, opacity: 1, enabled: true, props: { burstCount: 140, colors: [SOFT_PINK, GOLD, MINT, LAVENDER, ORANGE], triggerOn: 'beat', beatThreshold: 0.01, lifeMs: 2000, speedMin: 280, speedMax: 650, shape: 'star', origin: 'center' }, activeRange: { startSec: 16, endSec: 16.8 } },
  ],

  hashtags: ['kpop', 'love', 'star', 'cute', 'smile', 'challenge', 'motiq'],

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
