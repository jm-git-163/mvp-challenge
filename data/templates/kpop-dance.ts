/**
 * data/templates/kpop-dance.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — K-POP 댄스 독립 템플릿.
 *
 * 사용자 피드백: "k-pop은 bgm이 완전 html수준 이상한게 나오고 화면 효과가 너무 과해서
 * 사람이 안보이고" → 레이어 밀도 neon-arena 26개 → 11개로 축소, full-frame 프레이밍.
 * 카메라 영역 위 모든 레이어 opacity ≤ 0.25.
 *
 * 팔레트: 핫핑크(#FF2D95) + 시안(#00E0FF) + 라임(#39FF7D) K-POP 뮤비 톤.
 * BGM: backgroundmusicforvideos-334863 (업비트 팝, 실제 파일).
 */
import type { Template } from '../../engine/templates/schema';

const PINK  = '#FF2D95';
const CYAN  = '#00E0FF';
const LIME  = '#39FF7D';
const BLACK = '#0B0B10';

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
    // 배경 (2) — 카메라 뒤에 깔림
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1,  opacity: 1,    enabled: true, props: { colors: [BLACK, PINK, '#20052F'], rotatePeriodSec: 40 } },
    { id: 'bg_stars',      type: 'star_field',       zIndex: 2,  opacity: 0.5,  enabled: true, props: { count: 80, driftPxPerSec: 6 } },

    // 카메라 (1)
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1,    enabled: true },

    // HUD (3) — opacity 0.9 이상이지만 상·하단 엣지 배치
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1,    enabled: true, props: { position: 'top-right', bigNumber: true } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1,    enabled: true, props: { position: 'top-left', color: CYAN } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1,    enabled: true, props: { text: '하트 제스처!', color: PINK, position: 'top' }, activeRange: { startSec: 2.5, endSec: 6 } },

    // 비트 반응 (1) — 저강도
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1,    enabled: true, props: { color: PINK, maxAlpha: 0.12 },
      reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.12, easing: 'standard', durationMs: 140 } }, activeRange: { startSec: 3, endSec: 17 } },

    // 인트로 (1)
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: 'KPOP DANCE', fontSize: 100, color: PINK, strokeColor: CYAN, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 55 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // 메인 캡션 (2) — 상·하단만, 얼굴존 회피
    { id: 'cue_heart',     type: 'kinetic_text',     zIndex: 54, opacity: 1, enabled: true, props: { text: '💖 HEART', fontSize: 72, color: PINK, strokeColor: '#FFFFFF', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 6000, staggerMs: 50 }, activeRange: { startSec: 6, endSec: 11 } },
    { id: 'cue_peace',     type: 'kinetic_text',     zIndex: 55, opacity: 1, enabled: true, props: { text: '✌ PEACE', fontSize: 72, color: LIME, strokeColor: '#FFFFFF', strokeWidth: 6, mode: 'pop', position: 'top-center', startMs: 11000, staggerMs: 50 }, activeRange: { startSec: 11, endSec: 16 } },

    // 아웃트로 (1)
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: '★ CUTE ★', fontSize: 92, color: PINK, strokeColor: CYAN, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 17100, staggerMs: 60 }, activeRange: { startSec: 17, endSec: 20 } },

    // 해시태그 (1)
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.85, enabled: true, props: { texts: ['#kpop', '#dance', '#viral', '#heart', '#motiq'], separator: '   ', speedPxPerSec: 110, fontSize: 28, bgColor: 'rgba(11,11,16,0.55)', color: PINK, accentColor: CYAN, position: 'bottom' }, activeRange: { startSec: 2.5, endSec: 17 } },
  ],

  hashtags: ['kpop', 'dance', 'viral', 'heart', 'peace', 'motiq'],

  missionTimeline: [
    { id: 'sc1_heart',   startSec: 2,  endSec: 8,  mission: { kind: 'gesture', gesture: 'heart' },              scoreWeight: 0.5, hudBinding: 'hud_prompt' },
    { id: 'sc2_peace',   startSec: 11, endSec: 17, mission: { kind: 'gesture', gesture: 'peace' },              scoreWeight: 0.5 },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.6 },
    { kind: 'saturation', boost: 0.15 },
  ],

  successEffects: [
    { kind: 'confetti', durationMs: 1500 },
  ],
  failEffects: [],
};
