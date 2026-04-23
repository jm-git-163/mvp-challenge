/**
 * data/templates/squat-master.ts
 *
 * TEAM-TEMPLATE-v2 (2026-04-23) — 스쿼트 마스터 독립 템플릿 비주얼 강화.
 *
 * 사용자 피드백: "스쿼트는 bgm은 딱 맞는데 화면에 사람 전신이 다 나와야하는데
 * 원형으로 구멍이 있어서 얼굴만 나오고" → `portrait_split` 으로 전신 프레이밍 유지.
 * v2: 11 → 22 레이어. 인트로/미드/아웃트로 명확 분리, 비트 반응 강화, 반응형 다층화.
 *
 * 팔레트: 헬스 테마 — 인디고(#1B2A4E) + 에너지옐로우(#FFD23F) + 핫레드(#FF3B3B).
 * BGM: anomy5-aggressive-sport-phonk (고에너지 워크아웃).
 */
import type { Template } from '../../engine/templates/schema';

const INDIGO = '#1B2A4E';
const YELLOW = '#FFD23F';
const RED    = '#FF3B3B';
const WHITE  = '#FFFFFF';
const NAVY   = '#0A1530';

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
    src: '/bgm/anomy5-aggressive-sport-phonk-464391.mp3',
    volume: 0.7,
    beatsJson: '/bgm/anomy5-aggressive-sport-phonk-464391.beats.json',
    loop: true,
    duckingDb: -8,
  },

  // 전신 노출 — 풀 9:16 유지, 하단 1/3 바닥존 분할
  cameraFraming: { kind: 'portrait_split', topRatio: 0.67 },

  layers: [
    // ── 배경 (4) ────────────────────────────────────────────────
    { id: 'bg_mesh',       type: 'gradient_mesh',    zIndex: 1, opacity: 1,    enabled: true, props: { colors: [NAVY, INDIGO, '#000000'], rotatePeriodSec: 60 } },
    // FIX-EFFECT-INTENSITY-v2 (2026-04-23): 스쿼트 효과 과도 → 피사체 가독성 우선, opacity ~45% 감소.
    { id: 'bg_grid',       type: 'animated_grid',    zIndex: 2, opacity: 0.30, enabled: true, props: { color: YELLOW, perspective: true, scrollPerBarPx: 48 }, reactive: { onBeat: { every: 4, property: 'opacity', amount: 0.1, easing: 'easeOut', durationMs: 240 } } },
    { id: 'bg_sweat',      type: 'particle_ambient', zIndex: 3, opacity: 0.28, enabled: true, props: { preset: 'electric_blue_rise', count: 18 } },
    { id: 'bg_shapes',     type: 'floating_shapes',  zIndex: 4, opacity: 0.20, enabled: true, props: { shapes: ['star'], yBand: [120, 420], tint: YELLOW, sizeJitter: 0.4 } },

    // ── 카메라 (2) ─────────────────────────────────────────────
    { id: 'cam_feed',      type: 'camera_feed',      zIndex: 20, opacity: 1,    enabled: true },
    { id: 'cam_frame',     type: 'camera_frame',     zIndex: 21, opacity: 0.18, enabled: true, props: { ringColor: YELLOW, ringWidth: 3, glowBlur: 12 },
      reactive: { onBeat: { every: 2, property: 'glow', amount: 0.2, easing: 'overshoot', durationMs: 130 } } },

    // ── 비트 반응 레이어 (3) ─────────────────────────────────────
    { id: 'beat_flash',    type: 'beat_flash',       zIndex: 73, opacity: 0.55, enabled: true, props: { color: YELLOW, maxAlpha: 0.10 },
      reactive: { onBeat: { every: 2, property: 'opacity', amount: 0.10, easing: 'standard', durationMs: 150 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'beat_pulse',    type: 'pulse_circle',     zIndex: 24, opacity: 0.13, enabled: true, props: { cx: 540, cy: 1100, baseRadius: 420, color: RED },
      reactive: { onBeat: { every: 4, property: 'scale', amount: 0.12, easing: 'easeOut', durationMs: 360 } }, activeRange: { startSec: 3, endSec: 17 } },
    { id: 'chroma_pulse',  type: 'chromatic_pulse',  zIndex: 74, opacity: 0.30, enabled: true, props: { peakPx: 0.25 },
      reactive: { onBeat: { every: 8, property: 'opacity', amount: 0.25, easing: 'easeOut', durationMs: 220 } }, activeRange: { startSec: 4, endSec: 16 } },

    // ── HUD (4) ────────────────────────────────────────────────
    { id: 'hud_counter',   type: 'counter_hud',      zIndex: 60, opacity: 1, enabled: true, props: { target: 10, format: '{n} / 10', fontSize: 72, position: 'bottom-center', fontFamily: '"JetBrains Mono"' } },
    { id: 'hud_timer',     type: 'timer_ring',       zIndex: 61, opacity: 1, enabled: true, props: { position: 'top-left', color: YELLOW } },
    { id: 'hud_score',     type: 'score_hud',        zIndex: 62, opacity: 1, enabled: true, props: { position: 'top-right', label: 'HR', suffix: ' BPM', color: RED } },
    { id: 'hud_prompt',    type: 'mission_prompt',   zIndex: 63, opacity: 1, enabled: true, props: { text: '스쿼트 10회', color: YELLOW, position: 'top' }, activeRange: { startSec: 2.5, endSec: 5 } },

    // ── 인트로 (2) ─────────────────────────────────────────────
    { id: 'intro_flash',   type: 'beat_flash',       zIndex: 28, opacity: 1, enabled: true, props: { color: YELLOW, peakOpacity: 0.5 }, activeRange: { startSec: 0, endSec: 0.6 } },
    { id: 'intro_title',   type: 'kinetic_text',     zIndex: 29, opacity: 1, enabled: true, props: { text: 'SQUAT × 10', fontSize: 100, color: YELLOW, strokeColor: INDIGO, strokeWidth: 8, mode: 'pop', position: 'top-center', startMs: 200, staggerMs: 60 }, activeRange: { startSec: 0, endSec: 2.5 } },

    // TEAM-CHAOS (2026-04-23 v3): mid_tag "🔥 KEEP GOING", mid_burst, outro_title "COMPLETE!",
    //   hashtag_strip 전부 제거 — 사용자 피드백 "난리 났다, 텍스트 오버레이 스팸".
    //   카운트 HUD + 타이머 + 비트 반응만 남기고 군더더기 제거. 조용한 마무리.
    { id: 'outro_flash',   type: 'beat_flash',       zIndex: 74, opacity: 0.5, enabled: true, props: { color: RED, peakOpacity: 0.25 }, activeRange: { startSec: 17, endSec: 17.5 } },
    { id: 'outro_flare',   type: 'lens_flare',       zIndex: 76, opacity: 0.3, enabled: true, props: { x: 540, y: 700, color: YELLOW, size: 260 }, activeRange: { startSec: 17, endSec: 20 } },
  ],

  hashtags: ['squat', 'fitness', 'workout', 'hr', 'challenge', 'motiq'],

  missionTimeline: [
    { id: 'main_squat', startSec: 2, endSec: 20, mission: { kind: 'squat_count', target: 10 }, scoreWeight: 1.0, hudBinding: 'hud_counter' },
  ],

  postProcess: [
    { kind: 'bloom', intensity: 0.7 },
    { kind: 'chromatic', baseOffsetPx: 1.5, onOnsetPx: 5 },
    { kind: 'vignette', intensity: 0.28 },
    { kind: 'saturation', boost: 0.12 },
  ],

  successEffects: [
    { kind: 'particle_burst', durationMs: 800, props: { count: 80, colors: [YELLOW, RED] } },
    { kind: 'lens_flare', durationMs: 600 },
  ],
  failEffects: [
    { kind: 'chromatic_pulse', durationMs: 300 },
  ],
};
