/**
 * data/templates/food-review.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — 푸드 리뷰 비주얼 강화.
 *
 * 팔레트: 원목 테이블 — 우드 브라운(#8B5A2B) + 머스타드(#E3B04B) + 토마토(#FF6347).
 * v2: 13 → 22 레이어, 스크립트 7 → 18.
 */
import type { Template } from '../../engine/templates/schema';

const WOOD    = '#8B5A2B';
const MUSTARD = '#E3B04B';
const TOMATO  = '#FF6347';
const CREAM   = '#FFF4E0';

export const foodReview: Template = {
  id: 'food-review',
  title: '푸드 리뷰',
  description: '접시·별점·맛있음 이모지·원목.',
  thumbnail: '/templates/food-review/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'warm_asmr',

  bgm: {
    src: '/bgm/anomy5-sad-chill-phonk-464392.mp3',
    volume: 0.55,
    beatsJson: '/bgm/anomy5-sad-chill-phonk-464392.beats.json',
    loop: true,
    duckingDb: -9,
  },

  cameraFraming: { kind: 'fullscreen' },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [WOOD, '#4E3118', MUSTARD], rotatePeriodSec: 80 } },
    { id: 'bg_grain',      type: 'noise_pattern',    zIndex: 2, opacity: 0.2, enabled: true },
    { id: 'bg_emoji_top',  type: 'floating_shapes',  zIndex: 3, opacity: 0.65, enabled: true, props: { shapes: ['star', 'heart'], yBand: [80, 380], tint: MUSTARD, sizeJitter: 0.35 } },
    { id: 'bg_steam',      type: 'particle_ambient', zIndex: 4, opacity: 0.55, enabled: true, props: { preset: 'electric_blue_rise', count: 22, tint: CREAM } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true, props: { scale: 0.90 } },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.26, enabled: true, props: { borderColor: MUSTARD, borderWidth: 4, softShadow: true, glowBlur: 12 },
      reactive: { onBeat: { every: 4, property: 'glow', amount: 0.3, easing: 'easeOut', durationMs: 240 } } },

    // ── 비트 반응 (2) ─────────────────────────────────────────
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 22, opacity: 0.22, enabled: true, props: { cx: 540, cy: 960, baseRadius: 420, color: MUSTARD },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.1, easing: 'easeOut', durationMs: 380 } }, activeRange: { startSec: 3, endSec: 15 } },
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: MUSTARD, maxAlpha: 0.12 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.12, easing: 'standard', durationMs: 200 } }, activeRange: { startSec: 3, endSec: 15 } },

    // ── 배지·HUD (4) ───────────────────────────────────────────
    { id: 'star_badge',    type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: '★★★★★', bg: MUSTARD, color: WOOD, skewDeg: -4, position: { x: 140, y: 280 } }, activeRange: { startSec: 2, endSec: 16 } },
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: WOOD, border: MUSTARD } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: MUSTARD } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '맛 평가해주세요', color: MUSTARD, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    // ── 자막 ───────────────────────────────────────────────────
    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: CREAM, mutedColor: '#B0967A', position: 'bottom', y: 1500, highlightColor: TOMATO, scaleActive: 1.08 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: TOMATO, peakOpacity: 0.4 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '🍽️ FOOD REVIEW', fontSize: 72, color: MUSTARD, strokeColor: WOOD, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2 } },

    // ── 미드 훅 (2) ────────────────────────────────────────────
    { id: 'mid_tag',       type: 'kinetic_text',     zIndex: 41, opacity: 1, enabled: true, props: { text: '🍴 한 입 더', fontSize: 56, color: CREAM, strokeColor: WOOD, strokeWidth: 5, mode: 'pop', position: 'top-center', startMs: 6500, staggerMs: 50 }, activeRange: { startSec: 6.5, endSec: 8 } },
    { id: 'cue_yum',       type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: 'YUM! 😋', fontSize: 80, color: TOMATO, strokeColor: CREAM, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 8500, staggerMs: 55 }, activeRange: { startSec: 8.5, endSec: 12 } },

    // ── 미드 버스트 (1) ────────────────────────────────────────
    { id: 'mid_burst',     type: 'particle_burst',   zIndex: 55, opacity: 1, enabled: true, props: { colors: [MUSTARD, TOMATO], count: 35, durationMs: 800 }, activeRange: { startSec: 8.5, endSec: 9.5 } },

    // ── 아웃트로 (3) ───────────────────────────────────────────
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 74, opacity: 1, enabled: true, props: { color: MUSTARD, peakOpacity: 0.4 }, activeRange: { startSec: 15.5, endSec: 16 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★★★★★', fontSize: 92, color: MUSTARD, strokeColor: WOOD, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 80 }, activeRange: { startSec: 15.5, endSec: 18 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.5, enabled: true, props: { x: 540, y: 720, color: MUSTARD, size: 280 }, activeRange: { startSec: 15.5, endSec: 18 } },

    // ── 해시태그 ───────────────────────────────────────────────
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#food', '#review', '#yum', '#tasty', '#kitchen', '#motiq'], speedPxPerSec: 85, fontSize: 26, bgColor: 'rgba(78,49,24,0.65)', color: CREAM, accentColor: MUSTARD, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['food', 'review', 'yum', 'tasty', 'kitchen', 'motiq'],

  missionTimeline: [
    { id: 'food_read', startSec: 2, endSec: 16, mission: { kind: 'read_script', script: [
      '맛있어 보이네요. 한 번 먹어볼게요. 음, 정말 맛있어요!',
      '향이 정말 좋네요. 한 입 먹어보겠습니다. 아, 환상적인 맛이에요!',
      '색깔이 정말 예뻐요. 맛도 기대되네요. 와, 진짜 맛있습니다!',
      '바삭한 식감이 일품이에요. 양념도 완벽해요. 적극 추천합니다!',
      '이 집 대박이네요. 꼭 드셔보세요. 후회 안 하실 거예요.',
      '달콤하고 부드러워요. 입안에서 살살 녹아내립니다. 최고예요!',
      '담백하고 깔끔한 맛이에요. 건강하게 잘 먹겠습니다. 감사합니다.',
      '비주얼부터 압도적이에요. 사진보다 실물이 훨씬 좋네요. 인생 메뉴 등극!',
      '겉은 바삭, 속은 촉촉. 황금 비율이 뭔지 알겠어요. 진짜 맛집 인증.',
      '소스가 진짜 미쳤어요. 이거 하나로 다 살리네요. 레시피 궁금해요.',
      '한 그릇 뚝딱입니다. 이건 무조건 재방문이에요. 완전 강추합니다.',
      '국물이 시원하고 깊어요. 속이 확 풀리네요. 해장으로도 최고일 듯.',
      '풍미가 깊고 균형이 잡혀있어요. 디테일까지 놓치지 않은 한 그릇이네요.',
      '향신료 밸런스가 완벽해요. 입안이 화려해지는 느낌이에요. 박수.',
      '단짠단짠 끝판왕입니다. 자꾸 손이 가요. 위험한 맛이에요 진짜.',
      '쫄깃한 식감 살아있어요. 면발 정말 잘 뽑았네요. 인정합니다.',
      '겉바속촉의 정석이에요. 식어도 맛있을 것 같아요. 포장도 가능하대요.',
      '오늘의 발견입니다. 동네 사람들 다 알고 있는 거 같아요. 줄 설 만해요.',
    ] }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.55 },
    { kind: 'saturation', boost: 0.22 },
    { kind: 'vignette', intensity: 0.25 },
    { kind: 'bokeh', strength: 0.3 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 700, props: { colors: [MUSTARD, TOMATO] } },
    { kind: 'lens_flare', durationMs: 500 },
  ],
  failEffects: [],

  // CAMERA-SWAP (2026-04-23): 푸드 리뷰 전용 권장 카메라 시나리오.
  //   1) 0~5s   전면 — 리뷰어 표정·등장 인사
  //   2) 5~12s  후면 — 음식 클로즈업
  //   3) 12s~   전면 — 먹방 리액션·마무리
  // 자동 전환은 아님. 런타임이 다음 세그먼트 시작 5초 전 상단 토스트 표시.
  cameraPlan: {
    segments: [
      { atMs: 0,     facing: 'front', label: '리뷰어 등장' },
      { atMs: 5000,  facing: 'back',  label: '음식 클로즈업' },
      { atMs: 12000, facing: 'front', label: '먹방 리액션' },
    ],
  },
};
