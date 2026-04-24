/**
 * data/templates/travel-checkin.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 여행 체크인 독립 템플릿.
 *
 * 팔레트: 여권/지도 — 카키 브라운(#5B4636) + 스카이 블루(#7CC6FE) + 코랄(#FF9A76).
 * BGM: backgroundmusicforvideos-334863 (1) (밝은 어쿠스틱).
 */
import type { Template } from '../../engine/templates/schema';

const SKY   = '#7CC6FE';
const CORAL = '#FF9A76';
const KHAKI = '#5B4636';
const CREAM = '#FFF4E0';

export const travelCheckin: Template = {
  id: 'travel-checkin',
  title: '여행 체크인',
  description: '여권 스탬프·비행기·지도.',
  thumbnail: '/templates/travel-checkin/thumb.png',
  duration: 18,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'pop_candy',

  bgm: {
    src: '/bgm/alexzavesa-dance-playful-night-510786.mp3',
    volume: 0.6,
    beatsJson: '/bgm/alexzavesa-dance-playful-night-510786.beats.json',
    loop: true,
    duckingDb: -8,
  },

  cameraFraming: { kind: 'fullscreen' },

  // TEAM-TEMPLATE-v2 (2026-04-22): STT 평가 포기 결정 → 시각 감각 전면 강화.
  //   +8 레이어 (비트 반응 glow·chromatic pulse·confetti·lens flare·궤도 링·티켓 카드·아이콘 orbit·세컨더리 kinetic text)
  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [SKY, CREAM, CORAL], hueCyclePeriodSec: 60 } },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 2, opacity: 0.5, enabled: true, props: { density: 40, twinklePeriodSec: 4, tint: CREAM } },
    { id: 'bg_clouds_top', type: 'floating_shapes',  zIndex: 3, opacity: 0.7, enabled: true, props: { shapes: ['cloud', 'cloud', 'star'], yBand: [80, 380], tint: CREAM }, reactive: { onBeat: { every: 4, property: 'translate', amount: 14, easing: 'easeOut', durationMs: 260 } } },
    { id: 'bg_clouds_bot', type: 'floating_shapes',  zIndex: 4, opacity: 0.65, enabled: true, props: { shapes: ['cloud', 'cloud'], yBand: [1500, 1800], tint: '#FFFFFF' } },
    { id: 'orbit_ring',    type: 'orbiting_ring',    zIndex: 5, opacity: 0.35, enabled: true, props: { cx: 540, cy: 960, radius: 420, thickness: 3, color: CORAL, dashed: true, rotateSpeedDegPerSec: 18 } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true, props: { scale: 0.90 } },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.22, enabled: true, props: { borderColor: CORAL, borderWidth: 3, softShadow: true } },

    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 25, opacity: 0.25, enabled: true, props: { color: SKY, fadeMs: 180 }, reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.35, easing: 'easeOut', durationMs: 180 } } },

    { id: 'stamp_badge',   type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: '✈ PASSPORT', bg: CORAL, color: KHAKI, skewDeg: -8, position: { x: 120, y: 260 } }, activeRange: { startSec: 2, endSec: 16 }, reactive: { onBeat: { every: 4, property: 'scale', amount: 0.08, easing: 'overshoot', durationMs: 240 } } },
    { id: 'ticket_card',   type: 'banner_badge',     zIndex: 33, opacity: 0.92, enabled: true, props: { text: 'SEAT 7A  ·  GATE 23', bg: CREAM, color: KHAKI, skewDeg: 0, position: { x: 540, y: 360 }, border: CORAL }, activeRange: { startSec: 3, endSec: 14 } },

    { id: 'icon_orbit',    type: 'floating_shapes',  zIndex: 34, opacity: 0.85, enabled: true, props: { shapes: ['✈', '🧳', '📷', '🗺'], yBand: [500, 900], tint: KHAKI, sizeJitter: 0.4, driftDegPerSec: 22 }, activeRange: { startSec: 2, endSec: 16 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: KHAKI, border: CORAL } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: CORAL } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '여기 체크인!', color: KHAKI, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: KHAKI, mutedColor: '#9D8A76', position: 'bottom', y: 1500, highlightColor: CORAL, scaleActive: 1.12 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '🌍 TRAVEL', fontSize: 92, color: CORAL, strokeColor: CREAM, strokeWidth: 7, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 60, tiltDeg: -3 }, activeRange: { startSec: 0, endSec: 2 } },
    { id: 'mid_cue',       type: 'kinetic_text',     zIndex: 42, opacity: 1, enabled: true, props: { text: 'ARRIVED ✨', fontSize: 68, color: SKY, strokeColor: KHAKI, strokeWidth: 5, mode: 'drop', position: 'top-center', startMs: 8500, staggerMs: 55 }, activeRange: { startSec: 8.5, endSec: 11 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'BON VOYAGE ✈', fontSize: 76, color: SKY, strokeColor: KHAKI, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 50 }, activeRange: { startSec: 15.5, endSec: 18 } },

    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.6, enabled: true, props: { x: 800, y: 320, color: CREAM, size: 280 }, activeRange: { startSec: 15.5, endSec: 18 } },
    { id: 'outro_confetti',type: 'confetti',         zIndex: 77, opacity: 1, enabled: true, props: { colors: [CORAL, SKY, CREAM], count: 60, gravity: 380 }, activeRange: { startSec: 15.8, endSec: 18 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#travel', '#checkin', '#adventure', '#passport', '#explore', '#motiq'], speedPxPerSec: 95, fontSize: 26, bgColor: 'rgba(91,70,54,0.6)', color: CREAM, accentColor: CORAL, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['travel', 'checkin', 'adventure', 'passport', 'explore', 'motiq'],

  missionTimeline: [
    { id: 'travel_read', startSec: 2, endSec: 16, mission: { kind: 'read_script', script: [
      '안녕하세요, 오늘은 여행지에 도착했어요. 함께 구경해볼까요?',
      '여러분 반갑습니다. 드디어 이곳에 도착했네요. 풍경이 정말 멋집니다.',
      '비행기에서 내리자마자 설레는 마음이에요. 첫 스팟 공개합니다.',
      '이 도시의 첫인상은 정말 놀라워요. 거리가 아름답고 무척 활기찹니다.',
      '오늘의 목적지는 정말 인기 명소예요. 기대하셔도 좋습니다.',
      '아침 공기가 상쾌하네요. 여행의 첫날이 시작됐습니다. 출발합시다.',
      '현지 음식도 기대되고 풍경도 기대돼요. 구독자 여러분과 함께합니다.',
      '드디어 떠나왔습니다. 오늘 하루 알차게 보낼 예정이에요. 따라오세요.',
    ] }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.6 },
    { kind: 'saturation', boost: 0.22 },
    { kind: 'chromatic', baseOffsetPx: 1, onOnsetPx: 6 },
    { kind: 'vignette', intensity: 0.18 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 800, props: { colors: [CORAL, SKY] } },
  ],
  failEffects: [],
};
