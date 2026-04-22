/**
 * data/templates/squat-master.ts
 *
 * TEAM-TEMPLATE (2026-04-22) — 스쿼트 마스터 독립 템플릿.
 *
 * 사용자 피드백: "스쿼트는 bgm은 딱 맞는데 화면에 사람 전신이 다 나와야하는데
 * 원형으로 구멍이 있어서 얼굴만 나오고" → `portrait_split` 으로 전신 프레이밍,
 * 레이어는 11개로 압축 (기존 neon-arena 26개 대비 60% 감소).
 *
 * 팔레트: 헬스 테마 — 인디고(#1B2A4E) + 에너지옐로우(#FFD23F) + 핫레드(#FF3B3B).
 * BGM: synthwave-128 (고에너지 워크아웃).
 */
import type { Template } from '../../engine/templates/schema';

const INDIGO = '#1B2A4E';
const YELLOW = '#FFD23F';
const RED    = '#FF3B3B';
const WHITE  = '#FFFFFF';

export const squatMaster: Template = {
  id: 'squat-master',
  title: '스쿼트 마스터',
  description: '전신 운동 챌린지. HR·BPM·땀방울.',
  thumbnail: '/templates/squat-master/thumb.png',
  duration: 20,
  aspectRatio: '9:16',
  canvasSize: { w: 1080, h: 1920 },
  mood: 'neon_cyberpunk',

  bgm: {
    src: '/bgm/synthwave-128.wav',
    volume: 0.7,
    beatsJson: '/bgm/synthwave-128.beats.json',
    loop: true,
    duckingDb: -8,
  },

  // 전신 노출 — 풀 9:16 유지, 하단 1/3 바닥존 분할
  cameraFraming: { kind: 'portrait_split', topRatio: 0.67 },

  layers: [
    // 배경 (3)
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1,    enabled: true, props: { colors: [INDIGO, '#000000'], rotatePeriodSec: 60 } },
    { id: 'bg_grid',       type: 'animated_grid',    zIndex: 2, opacity: 0.6,  enabled: true, props: { color: YELLOW, perspective: true, scrollPerBarPx: 48 } },
    { id: 'bg_sweat',      type: 'particle_ambient', zIndex: 3, opacity: 0.5,  enabled: true, props: { preset: 'electric_blue_rise', count: 24 } },

    // 카메라 (2)
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1,    enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.25, enabled: true, props: { ringColor: YELLOW, ringWidth: 2, glowBlur: 10 },
      reactive: { onBeat: { every: 2, property: 'glow', amount: 0.3, easing: 'overshoot', durationMs: 120 } } },

    // HUD (4) — HR, BPM 카운터, 타이머, 점수
    { id: 'hud_counter',   type: 'counter_hud',      zIndex: 60, opacity: 1, enabled: true, props: { target: 10, format: '{n} / 10', fontSize: 72, position: 'bottom-center', fontFamily: '"JetBrains Mono"' } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: YELLOW } },
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', label: 'HR', suffix: ' BPM', color: RED } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '스쿼트 10회', color: YELLOW, position: 'top' }, activeRange: { startSec: 2.5, endSec: 5 } },

    // 반응형 (1)
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 1, enabled: true, props: { color: YELLOW, maxAlpha: 0.18 },
      reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.18, easing: 'standard', durationMs: 150 } }, activeRange: { startSec: 3, endSec: 17 } },

    // 인트로 (1)
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: 'SQUAT × 10', fontSize: 100, color: YELLOW, strokeColor: INDIGO, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // 아웃트로 (1)
    { id: 'outro_title',   type: 'kinetic_text',     zIndex: 75, opacity: 1, enabled: true, props: { text: 'COMPLETE!', fontSize: 88, color: RED, strokeColor: WHITE, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 17100, staggerMs: 55 }, activeRange: { startSec: 17, endSec: 20 } },

    // 해시태그 (1)
    { id: 'hashtag_strip', type: 'news_ticker',      zIndex: 72, opacity: 0.9, enabled: true, props: { texts: ['#squat', '#fitness', '#workout', '#hr', '#challenge', '#motiq'], separator: '   ', speedPxPerSec: 90, fontSize: 28, bgColor: 'rgba(27,42,78,0.7)', color: YELLOW, accentColor: RED, position: 'bottom' }, activeRange: { startSec: 2.5, endSec: 17 } },
  ],

  hashtags: ['squat', 'fitness', 'workout', 'hr', 'challenge', 'motiq'],

  missionTimeline: [
    { id: 'main_squat', startSec: 2, endSec: 20, mission: { kind: 'squat_count', target: 10 }, scoreWeight: 1.0, hudBinding: 'hud_counter' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.7 },
    { kind: 'vignette', intensity: 0.25 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 800, props: { count: 80 } },
  ],
  failEffects: [
    { kind: 'chromatic_pulse', durationMs: 300 },
  ],
};
