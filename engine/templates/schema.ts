/**
 * engine/templates/schema.ts
 *
 * docs/COMPOSITION.md §9 + docs/TEMPLATES.md 기준 템플릿 zod 스키마.
 *
 * 목적: 템플릿 파일을 선언형 JSON/TS로 작성하고, 런타임에 스키마 검증을 통과한
 * 객체만 `LayerEngine`(Phase 5b)에 주입되도록 보증.
 *
 * 이 스키마는 Phase 5i 3개 레퍼런스 템플릿(`neon-arena`/`news-anchor`/`emoji-explosion`)의
 * 기술적 요구사항을 모두 커버해야 한다.
 */

import { z } from 'zod';

// ── 공통 ─────────────────────────────────────────────────────
export const zPoint2D = z.object({ x: z.number(), y: z.number() });

export const zEasingToken = z.enum([
  'standard', 'overshoot', 'bounce', 'anticipate',
  'linear', 'easeIn', 'easeOut', 'easeInOut',
]);

export const zBlendMode = z.enum([
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

// ── 카메라 프레이밍 (docs/COMPOSITION §8) ────────────────────
export const zCameraFraming = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fullscreen') }),
  z.object({ kind: z.literal('circle'), centerX: z.number(), centerY: z.number(), radius: z.number().positive() }),
  z.object({ kind: z.literal('rounded_rect'), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), radius: z.number().nonnegative() }),
  z.object({ kind: z.literal('hexagon'), centerX: z.number(), centerY: z.number(), size: z.number().positive() }),
  z.object({ kind: z.literal('heart'), centerX: z.number(), centerY: z.number(), size: z.number().positive() }),
  // Team SQUAT (2026-04-22): 세로 분할 — 스쿼트 근접촬영용. 상단 2/3 얼굴·상체, 하단 1/3 바닥존.
  //   clip 은 풀스크린으로 유지하고 visual 은 camera_frame 레이어가 커스텀 처리.
  z.object({ kind: z.literal('portrait_split'), topRatio: z.number().min(0.1).max(0.95).default(0.67) }),
  z.object({ kind: z.literal('tv_frame'), framePath: z.string() }),
  z.object({ kind: z.literal('custom_mask'), maskPath: z.string() }),
]);

// ── 레이어 타입 (docs/COMPOSITION §3) ────────────────────────
export const zLayerType = z.enum([
  // 배경
  'gradient_mesh', 'animated_grid', 'star_field', 'noise_pattern', 'image_bg', 'video_bg',
  // 기하
  'floating_shapes', 'orbiting_ring', 'pulse_circle',
  // 파티클
  'particle_ambient', 'particle_burst', 'particle_trail',
  // 카메라
  'camera_feed', 'camera_frame', 'camera_reflection',
  // AR
  'face_sticker', 'face_mask', 'body_accessory', 'hand_emoji',
  // 텍스트
  'kinetic_text', 'karaoke_caption', 'beat_text', 'news_ticker', 'banner_badge',
  // HUD
  'score_hud', 'counter_hud', 'timer_ring', 'mission_prompt',
  // 리액티브
  'audio_visualizer', 'voice_bubble', 'beat_flash', 'chromatic_pulse',
  // 특수
  'lottie', 'lens_flare', 'lightning', 'smoke', 'confetti',
]);
export type LayerType = z.infer<typeof zLayerType>;

// ── 리액티브 바인딩 (docs/COMPOSITION §4) ────────────────────
const zReactiveProperty = z.enum(['scale', 'opacity', 'rotate', 'translate', 'color', 'glow']);

export const zOnBeat = z.object({
  every: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16)]),
  property: zReactiveProperty,
  amount: z.number(),
  easing: zEasingToken,
  durationMs: z.number().positive(),
});

export const zOnOnset = z.object({
  property: zReactiveProperty,
  amount: z.number(),
  easing: zEasingToken,
  durationMs: z.number().positive(),
  /** 최소 간격 ms. 연속 온셋 시 트리거 제한. */
  minIntervalMs: z.number().nonnegative().optional(),
});

export const zOnVolume = z.object({
  /** dBFS 기준. -20이면 라우드 대비 −20dB 이상에서 반응. */
  thresholdDb: z.number(),
  property: zReactiveProperty,
  amount: z.number(),
});

export const zLandmarkId = z.enum([
  'nose', 'left_eye', 'right_eye', 'forehead', 'chin',
  'left_cheek', 'right_cheek', 'mouth',
  'left_shoulder', 'right_shoulder', 'left_hand', 'right_hand',
  'hip', 'head',
]);

export const zTrackBinding = z.object({
  landmark: zLandmarkId,
  offset: zPoint2D.default({ x: 0, y: 0 }),
  rotateWith: z.enum(['face_yaw', 'face_roll', 'face_pitch', 'none']).default('none'),
  scaleWith: z.enum(['face_size', 'none']).default('none'),
});

export const zAnimationState = z.object({
  property: zReactiveProperty,
  from: z.number(),
  to: z.number(),
  durationMs: z.number().positive(),
  easing: zEasingToken.default('standard'),
});

export const zReactiveBinding = z.object({
  onBeat: zOnBeat.optional(),
  onOnset: zOnOnset.optional(),
  onVolume: zOnVolume.optional(),
  onMissionProgress: z.array(zAnimationState).optional(),
  onMissionSuccess: zAnimationState.optional(),
  onMissionFail: zAnimationState.optional(),
  track: zTrackBinding.optional(),
});

// ── 베이스 레이어 ───────────────────────────────────────────
export const zBaseLayer = z.object({
  id: z.string().min(1),
  type: zLayerType,
  zIndex: z.number().int(),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: zBlendMode.optional(),
  enabled: z.boolean().default(true),
  /** 씬 단위 활성 범위 (초). */
  activeRange: z.object({ startSec: z.number().nonnegative(), endSec: z.number().nonnegative() }).optional(),
  reactive: zReactiveBinding.optional(),
  /** 레이어 타입별 커스텀 설정. 타입 레벨에서는 unknown, 렌더러가 해석. */
  props: z.record(z.string(), z.unknown()).optional(),
});

// ── 미션 (Phase 1 엔진과 일치) ───────────────────────────────
export const zMissionSpec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('squat_count'), target: z.number().int().positive() }),
  z.object({ kind: z.literal('smile'), intensity: z.number().min(0).max(1), durationMs: z.number().positive() }),
  z.object({ kind: z.literal('gesture'), gesture: z.string(), sequence: z.array(z.string()).optional() }),
  z.object({ kind: z.literal('pose_hold'), pose: z.string(), holdMs: z.number().positive() }),
  z.object({ kind: z.literal('loud_voice'), minDb: z.number(), durationMs: z.number().positive() }),
  // FIX-SCRIPT-POOL (2026-04-22): script 가 string 이면 고정, 배열이면 세션마다
  //   missionRunner 가 무작위로 하나 선택 (재시도마다 다른 대본 → 재미·리플레이성).
  z.object({ kind: z.literal('read_script'), script: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]) }),
]);

export const zMissionEvent = z.object({
  id: z.string().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  mission: zMissionSpec,
  scoreWeight: z.number().min(0).max(1),
  hudBinding: z.string().optional(),
}).refine((e) => e.endSec > e.startSec, { message: 'endSec must be > startSec' });

// ── 미션 시퀀스 (Phase 5 wave2 — chaining) ─────────────────
// 한 챌린지 = 미션 3~5개 연속. 각 미션 종료 → transitionMs 페이드 → 다음 미션.
// 단일 MediaRecorder 세션 유지 (시퀀서는 점수·상태만 관리).
export const zMissionSequenceStep = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  spec: zMissionSpec,
  hudBinding: z.string().optional(),
  weight: z.number().min(0).default(1),
});

export const zTransitionConfig = z.object({
  durationMs: z.number().min(0).default(1000),
  kind: z.enum(['glow_fade', 'flash', 'none']).default('glow_fade'),
});

export const zMissionSequence = z.object({
  steps: z.array(zMissionSequenceStep).min(2),
  transitions: z.array(zTransitionConfig).optional(),
  comboBonusPct: z.number().min(0).max(100).default(10),
  comboBonusMaxPct: z.number().min(0).max(200).default(50),
  passingScore: z.number().min(0).max(100).default(60),
}).refine((s) => {
  const ids = new Set<string>();
  for (const st of s.steps) {
    if (ids.has(st.id)) return false;
    ids.add(st.id);
  }
  return true;
}, { message: 'steps 내 id 중복' });

export type MissionSequenceConfig = z.infer<typeof zMissionSequence>;

// ── BGM ──────────────────────────────────────────────────────
export const zBgmSpec = z.object({
  src: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.7),
  beatsJson: z.string().optional(), // 사전 분석 없으면 실시간 폴백
  loop: z.boolean().default(true),
  duckingDb: z.number().default(-8),
});

// ── SFX (PIXABAY-SFX 2026-05-01) ─────────────────────────────
// 템플릿이 미션 이벤트 키별로 mp3 URL 을 직접 지정 (선택). 없으면 sfxPlayer 가
// generated tone 폴백. 키 이름은 sfxPlayer.SfxKey 와 일치할 수도, 다를 수도 있다 —
// 런타임에서 mission event → key → 이 매핑으로 URL 해석.
export const zSfxSpec = z.object({
  count: z.string().optional(),
  success: z.string().optional(),
  bonus: z.string().optional(),
  fail: z.string().optional(),
  transition: z.string().optional(),
  cheer: z.string().optional(),
  shimmer: z.string().optional(),
  drop: z.string().optional(),
  jingle: z.string().optional(),
  ding: z.string().optional(),
  typing: z.string().optional(),
  pop: z.string().optional(),
}).partial();

// ── 포스트프로세스 ──────────────────────────────────────────
export const zPostFx = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bloom'), intensity: z.number().nonnegative() }),
  z.object({ kind: z.literal('lut'), path: z.string() }),
  z.object({ kind: z.literal('chromatic'), baseOffsetPx: z.number().nonnegative(), onOnsetPx: z.number().nonnegative().optional() }),
  z.object({ kind: z.literal('film_grain'), opacity: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('vignette'), intensity: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('crt_scanlines'), opacity: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('pixelate'), size: z.number().int().positive() }),
  z.object({ kind: z.literal('saturation'), boost: z.number() }),
  z.object({ kind: z.literal('bokeh'), strength: z.number().min(0).max(1) }),
]);

export const zPostFxChain = z.array(zPostFx);

// ── 전역 이펙트 ─────────────────────────────────────────────
export const zGlobalEffect = z.object({
  kind: z.enum(['particle_burst', 'lens_flare', 'chromatic_pulse', 'beat_flash', 'confetti', 'kinetic_text', 'lut_mono']),
  durationMs: z.number().positive().default(600),
  props: z.record(z.string(), z.unknown()).optional(),
});

// ── 카메라 플랜 (CAMERA-SWAP 2026-04-23) ─────────────────────
// 시점별 권장 facing. 런타임에 다음 segment 시작 5초 전 토스트 표시.
// 자동 전환은 기본 OFF (사용자 수동) — 오동작·권한 팝업 유발 회피.
export const zCameraPlanSegment = z.object({
  /** 세그먼트 시작 시각 (녹화 기준 ms). 0 = 녹화 시작 순간. */
  atMs: z.number().min(0),
  /** 해당 구간 권장 facing. */
  facing: z.enum(['front', 'back']),
  /** 토스트에 표시할 짧은 라벨 (예: "음식 클로즈업"). */
  label: z.string().min(1).max(20),
});

export const zCameraPlan = z.object({
  segments: z.array(zCameraPlanSegment).min(1),
});

export type CameraPlanSegment = z.infer<typeof zCameraPlanSegment>;
export type CameraPlan = z.infer<typeof zCameraPlan>;

// ── 무드 ────────────────────────────────────────────────────
export const zMoodToken = z.enum([
  'neon_cyberpunk', 'cinematic_news', 'pop_candy', 'warm_asmr', 'luxury_night',
]);

// ── 최상위 템플릿 ───────────────────────────────────────────
export const zTemplate = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, '소문자/숫자/하이픈만'),
  title: z.string().min(1),
  description: z.string().default(''),
  thumbnail: z.string(),
  previewVideo: z.string().optional(),

  duration: z.number().positive(),
  aspectRatio: z.literal('9:16'),
  canvasSize: z.object({ w: z.literal(1080), h: z.literal(1920) }),

  mood: zMoodToken,

  bgm: zBgmSpec,
  /** 선택적 미션 이벤트별 SFX URL 매핑. 없으면 generated tone 폴백. */
  sfx: zSfxSpec.optional(),
  cameraFraming: zCameraFraming,
  layers: z.array(zBaseLayer).min(1),
  missionTimeline: z.array(zMissionEvent).min(1),
  postProcess: zPostFxChain.default([]),
  successEffects: z.array(zGlobalEffect).default([]),
  failEffects: z.array(zGlobalEffect).default([]),
  /**
   * 해시태그 — 아웃트로/하단 스트립에서 사용. (2026-04-22 FIX: 템플릿별 차별화·소셜 매체 감성 보강)
   * 6~8 개 권장. 영문/한글/이모지 혼용 가능. '#' 프리픽스는 자동 추가되므로 생략.
   */
  hashtags: z.array(z.string().min(1)).default([]),

  /**
   * CAMERA-SWAP (2026-04-23): 시점별 권장 카메라 facing.
   * 런타임에 다음 segment 시작 5초 전 상단 토스트 표시 ("5초 후 후면 전환 — {label}").
   * 자동 전환 아님 — 사용자가 🔄 버튼으로 직접 토글.
   */
  cameraPlan: zCameraPlan.optional(),

  /**
   * Phase 5 wave2 (2026-05-01): 미션 체이닝.
   * 존재 시 missionTimeline 과 병행 가능 (시퀀서가 우선). 단일 녹화 세션 안에서
   * 시퀀스가 종료되면 보너스 합산해 최종 점수에 반영.
   */
  missionSequence: zMissionSequence.optional(),
}).superRefine((t, ctx) => {
  // scoreWeight 합 = 1.0 (±0.01 허용)
  const sum = t.missionTimeline.reduce((s, m) => s + m.scoreWeight, 0);
  if (Math.abs(sum - 1) > 0.01) {
    ctx.addIssue({ code: 'custom', message: `missionTimeline scoreWeight 합 = ${sum.toFixed(3)}, 1.0 이어야 함`, path: ['missionTimeline'] });
  }
  // layer id 중복 금지
  const ids = new Set<string>();
  for (const l of t.layers) {
    if (ids.has(l.id)) {
      ctx.addIssue({ code: 'custom', message: `중복된 layer id "${l.id}"`, path: ['layers'] });
    }
    ids.add(l.id);
  }
  // mission id 중복 금지
  const mids = new Set<string>();
  for (const m of t.missionTimeline) {
    if (mids.has(m.id)) {
      ctx.addIssue({ code: 'custom', message: `중복된 mission id "${m.id}"`, path: ['missionTimeline'] });
    }
    mids.add(m.id);
  }
  // 미션 타임라인이 duration 초과 금지
  for (const m of t.missionTimeline) {
    if (m.endSec > t.duration + 0.001) {
      ctx.addIssue({ code: 'custom', message: `mission "${m.id}".endSec(${m.endSec}) > template.duration(${t.duration})`, path: ['missionTimeline'] });
    }
  }
  // CAMERA-SWAP (2026-04-23): cameraPlan.segments — atMs 오름차순, duration 내
  if (t.cameraPlan) {
    const durMs = t.duration * 1000;
    let prev = -1;
    for (const seg of t.cameraPlan.segments) {
      if (seg.atMs <= prev) {
        ctx.addIssue({ code: 'custom', message: `cameraPlan.segments.atMs 는 오름차순이어야 함 (prev=${prev}, got=${seg.atMs})`, path: ['cameraPlan', 'segments'] });
      }
      prev = seg.atMs;
      if (seg.atMs > durMs + 1) {
        ctx.addIssue({ code: 'custom', message: `cameraPlan segment atMs(${seg.atMs}) > duration(${durMs}ms)`, path: ['cameraPlan', 'segments'] });
      }
    }
  }
});

export type Template = z.infer<typeof zTemplate>;
export type BaseLayer = z.infer<typeof zBaseLayer>;
export type MissionEvent = z.infer<typeof zMissionEvent>;
export type CameraFraming = z.infer<typeof zCameraFraming>;
export type ReactiveBinding = z.infer<typeof zReactiveBinding>;

/** 검증 헬퍼. 실패 시 상세 에러 문자열로 throw. */
export function parseTemplate(input: unknown): Template {
  const r = zTemplate.safeParse(input);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Template 검증 실패:\n${issues}`);
  }
  return r.data;
}
