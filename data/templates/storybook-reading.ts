/**
 * data/templates/storybook-reading.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 동화책 읽기 독립 템플릿.
 *
 * 팔레트: 파스텔 — 페이퍼 베이지(#F5E9D0) + 라일락(#D4A4EB) + 로즈(#FFB5C5).
 * BGM: pulsebox-448471 (뮤직박스 느낌 재즈).
 */
import type { Template } from '../../engine/templates/schema';

const PAPER  = '#F5E9D0';
const LILAC  = '#D4A4EB';
const ROSE   = '#FFB5C5';
const TEAL   = '#4A6670';
const GOLD   = '#E3B04B';

export const storybookReading: Template = {
  id: 'storybook-reading',
  title: '동화책 읽기',
  description: '요정 파티클·파스텔 종이.',
  thumbnail: '/templates/storybook-reading/thumb.png',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'warm_asmr',

  bgm: {
    src: '/bgm/pulsebox-a-no-copyright-jazz-background-448471.mp3',
    volume: 0.5,
    beatsJson: '/bgm/pulsebox-a-no-copyright-jazz-background-448471.beats.json',
    loop: true,
    duckingDb: -10,
  },

  cameraFraming: { kind: 'fullscreen' },

  // TEAM-TEMPLATE-v2 (2026-04-22): 더 포근하고 마법적인 분위기로 대폭 보강.
  //   +9 레이어 (요정 트레일, 꽃잎 낙하, 책 페이지 오버레이, 중간 하이라이트, 빛 번짐 등)
  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [PAPER, ROSE, LILAC], hueCyclePeriodSec: 120 } },
    { id: 'bg_paper',      type: 'noise_pattern',    zIndex: 2, opacity: 0.18, enabled: true },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 3, opacity: 0.45, enabled: true, props: { density: 60, twinklePeriodSec: 6, tint: GOLD } },
    { id: 'bg_fairy',      type: 'particle_ambient', zIndex: 4, opacity: 0.7, enabled: true, props: { preset: 'glitter_down', count: 50, tint: GOLD } },
    { id: 'bg_petals',     type: 'particle_ambient', zIndex: 5, opacity: 0.55, enabled: true, props: { preset: 'petals_drift', count: 22, tint: ROSE } },
    { id: 'bg_flowers',    type: 'floating_shapes',  zIndex: 6, opacity: 0.6, enabled: true, props: { shapes: ['star', 'heart', 'cloud'], yBand: [60, 380], tint: LILAC, sizeJitter: 0.3 }, reactive: { onBeat: { every: 8, property: 'scale', amount: 0.06, easing: 'easeOut', durationMs: 320 } } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.28, enabled: true, props: { borderColor: GOLD, borderWidth: 4, softShadow: true, innerGlowColor: LILAC } },
    { id: 'cam_trail',     type: 'particle_trail',   zIndex: 22, opacity: 0.35, enabled: true, props: { tint: GOLD, length: 18 }, reactive: { track: { landmark: 'forehead', offset: { x: 0, y: 0 }, rotateWith: 'none', scaleWith: 'none' } } },

    { id: 'pulse_glow',    type: 'pulse_circle',     zIndex: 23, opacity: 0.25, enabled: true, props: { cx: 540, cy: 960, baseRadius: 380, color: GOLD }, reactive: { onBeat: { every: 4, property: 'scale', amount: 0.12, easing: 'easeOut', durationMs: 420 } } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: TEAL, border: GOLD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: GOLD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '동화책을 읽어주세요', color: TEAL, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: TEAL, mutedColor: '#8AA3AA', position: 'bottom', y: 1500, highlightColor: ROSE, scaleActive: 1.1 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '✨ ONCE UPON A TIME ✨', fontSize: 72, color: LILAC, strokeColor: PAPER, strokeWidth: 7, mode: 'drop', position: 'top-center', startMs: 200, staggerMs: 70, tiltDeg: -2 }, activeRange: { startSec: 0, endSec: 2.5 } },
    { id: 'mid_highlight', type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: '✿ 페이지 2 ✿', fontSize: 58, color: ROSE, strokeColor: PAPER, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 9500, staggerMs: 60 }, activeRange: { startSec: 9.5, endSec: 12 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'THE END ✿', fontSize: 88, color: ROSE, strokeColor: TEAL, strokeWidth: 7, mode: 'drop', position: 'top-center', startMs: 17500, staggerMs: 80 }, activeRange: { startSec: 17.5, endSec: 20 } },

    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.5, enabled: true, props: { x: 540, y: 700, color: GOLD, size: 320 }, activeRange: { startSec: 17.5, endSec: 20 } },
    { id: 'outro_burst',   type: 'particle_burst',   zIndex: 77, opacity: 1, enabled: true, props: { colors: [LILAC, ROSE, GOLD], count: 50, durationMs: 1400 }, activeRange: { startSec: 17.7, endSec: 19.5 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.8, enabled: true, props: { texts: ['#storybook', '#reading', '#kids', '#fairy', '#pastel', '#motiq'], speedPxPerSec: 70, fontSize: 26, bgColor: 'rgba(74,102,112,0.55)', color: PAPER, accentColor: GOLD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 17 } },
  ],

  hashtags: ['storybook', 'reading', 'kids', 'fairy', 'pastel', 'motiq'],

  missionTimeline: [
    { id: 'read_story', startSec: 2, endSec: 17, mission: { kind: 'read_script', script: [
      '옛날 옛적에, 아름다운 숲속에 귀여운 토끼가 살고 있었습니다.',
      '깊은 바닷속에 착한 인어공주가 있었어요. 그녀는 노래를 무척 좋아했습니다.',
      '어느 날 작은 새가 하늘을 날고 있었어요. 날개가 반짝반짝 빛났습니다.',
      '산속 오두막에 친절한 할머니가 살았어요. 매일 아침 따뜻한 빵을 구웠답니다.',
      '작은 마을에 용감한 소년이 있었습니다. 그는 언제나 모험을 꿈꾸었어요.',
      '눈부신 들판에 노란 꽃이 피었어요. 나비들이 예쁘게 춤을 추었습니다.',
      '별이 빛나는 밤, 아기 곰이 잠들었습니다. 달님이 포근히 지켜주고 있었어요.',
      '마법의 숲에 신비로운 요정이 살았습니다. 요정은 착한 아이만 만나주었어요.',
    ] }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.65 },
    { kind: 'bokeh', strength: 0.45 },
    { kind: 'saturation', boost: 0.1 },
    { kind: 'vignette', intensity: 0.22 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 900, props: { colors: [LILAC, ROSE, GOLD] } },
  ],
  failEffects: [],
};
