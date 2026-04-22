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
  z.object({ kind: z.literal('tv_frame'), framePath: z.string() }),
  z.object({ kind: z.literal('custom_mask'), maskPath: z.string() }),
]);

// ── 레이어 타입 (docs/COMPOSITION §3) ────────────────────────
export const zLayerType = z.enum([
  // 배경
  'gradient_mesh', 'animated_grid', 'star_field', 'noise_pattern', 'image_bg',
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
  z.object({ kind: z.literal('read_script'), script: z.string().min(1) }),
]);

export const zMissionEvent = z.object({
  id: z.string().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  mission: zMissionSpec,
  scoreWeight: z.number().min(0).max(1),
  hudBinding: z.string().optional(),
}).refine((e) => e.endSec > e.startSec, { message: 'endSec must be > startSec' });

// ── BGM ──────────────────────────────────────────────────────
export const zBgmSpec = z.object({
  src: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.7),
  beatsJson: z.string().optional(), // 사전 분석 없으면 실시간 폴백
  loop: z.boolean().default(true),
  duckingDb: z.number().default(-8),
});

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
