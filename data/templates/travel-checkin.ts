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

  layers: [
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1, enabled: true, props: { colors: [SKY, CREAM, CORAL], hueCyclePeriodSec: 60 } },
    { id: 'bg_clouds_top', type: 'floating_shapes',  zIndex: 2, opacity: 0.7, enabled: true, props: { shapes: ['cloud', 'cloud', 'star'], yBand: [80, 380], tint: CREAM } },
    { id: 'bg_clouds_bot', type: 'floating_shapes',  zIndex: 3, opacity: 0.65, enabled: true, props: { shapes: ['cloud', 'cloud'], yBand: [1500, 1800], tint: '#FFFFFF' } },

    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1, enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.22, enabled: true, props: { borderColor: CORAL, borderWidth: 3, softShadow: true } },

    { id: 'stamp_badge',   type: 'banner_badge',     zIndex: 32, opacity: 1, enabled: true, props: { text: '✈ PASSPORT', bg: CORAL, color: KHAKI, skewDeg: -8, position: { x: 120, y: 260 } }, activeRange: { startSec: 2, endSec: 16 } },

    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', color: KHAKI, border: CORAL } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: CORAL } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '여기 체크인!', color: KHAKI, position: 'top' }, activeRange: { startSec: 2, endSec: 5 } },

    { id: 'caption',       type: 'karaoke_caption',  zIndex: 50, opacity: 1, enabled: true, props: { color: KHAKI, mutedColor: '#9D8A76', position: 'bottom', y: 1500 } },

    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: '🌍 TRAVEL', fontSize: 84, color: CORAL, strokeColor: CREAM, strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2 } },
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'BON VOYAGE ✈', fontSize: 68, color: SKY, strokeColor: KHAKI, strokeWidth: 5, mode: 'pop', position: 'top-center', startMs: 15500, staggerMs: 50 }, activeRange: { startSec: 15.5, endSec: 18 } },

    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#travel', '#checkin', '#adventure', '#passport', '#explore', '#motiq'], speedPxPerSec: 95, fontSize: 26, bgColor: 'rgba(91,70,54,0.6)', color: CREAM, accentColor: CORAL, position: 'bottom' }, activeRange: { startSec: 2, endSec: 15.5 } },
  ],

  hashtags: ['travel', 'checkin', 'adventure', 'passport', 'explore', 'motiq'],

  missionTimeline: [
    { id: 'travel_read', startSec: 2, endSec: 16, mission: { kind: 'read_script', script: '안녕하세요, 오늘은 여행지에 도착했어요. 함께 구경해볼까요?' }, scoreWeight: 1.0, hudBinding: 'caption' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.5 },
    { kind: 'saturation', boost: 0.15 },
    { kind: 'vignette', intensity: 0.15 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 800, props: { colors: [CORAL, SKY] } },
  ],
  failEffects: [],
};
