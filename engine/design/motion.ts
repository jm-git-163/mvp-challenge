/**
 * engine/design/motion.ts
 *
 * docs/VISUAL_DESIGN.md §4 모션 토큰 — 이징 곡선 평가기 + 프리셋.
 *
 * React Native/웹/Canvas 어디서든 쓰는 **순수 함수 곡선**.
 * Framer Motion을 직접 import하지 않는다 (의존성 부재 시 대비 + RN 호환).
 */

// ── 지속 시간 ──────────────────────────────────────────────────
export const DURATION = {
  instant: 100,
  fast: 180,
  medium: 320,
  slow: 540,
  cinematic: 1200,
} as const;
export type DurationToken = keyof typeof DURATION;

// ── 이징 곡선 ──────────────────────────────────────────────────
/** cubic-bezier(x1,y1,x2,y2) 평가. De Casteljau 방식. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  // t(x) Newton–Raphson → y(t)
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = -6 * x1 + 3 * x2;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = -6 * y1 + 3 * y2;
  const cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xe = sampleX(t) - x;
      if (Math.abs(xe) < 1e-5) return sampleY(t);
      const d = sampleDerivX(t);
      if (Math.abs(d) < 1e-6) break;
      t = t - xe / d;
    }
    // 바이섹션 폴백
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const xe = sampleX(t) - x;
      if (Math.abs(xe) < 1e-5) break;
      if (xe > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

export const EASE = {
  standard:  cubicBezier(0.4, 0.0, 0.2, 1),
  overshoot: cubicBezier(0.34, 1.56, 0.64, 1),
  bounce:    cubicBezier(0.68, -0.55, 0.27, 1.55),
  anticipate:cubicBezier(0.36, 0, 0.66, -0.56),
  linear:    (x: number) => x,
  easeIn:    cubicBezier(0.42, 0, 1, 1),
  easeOut:   cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
} as const;
export type EasingToken = keyof typeof EASE;

// ── 트윈 헬퍼 ──────────────────────────────────────────────────
/** 0..durationMs 경과에 대해 from→to 보간. easing 적용. */
export function tween(from: number, to: number, elapsedMs: number, durationMs: number, ease: EasingToken = 'standard'): number {
  if (durationMs <= 0) return to;
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return from + (to - from) * EASE[ease](t);
}

// ── 프리셋 (keyframe 배열) ─────────────────────────────────────
export interface MotionKeyframe {
  /** 0..1 정규화 시각. */
  t: number;
  /** 프로퍼티별 스칼라 값. */
  values: Partial<{ opacity: number; scale: number; translateX: number; translateY: number; rotate: number }>;
}
export interface MotionPreset {
  durationMs: number;
  ease: EasingToken;
  frames: MotionKeyframe[];
}

export const MOTION_PRESETS: Record<string, MotionPreset> = {
  /** 등장: translateY(20) + opacity(0) → 0 + 1, overshoot, medium */
  enter: {
    durationMs: DURATION.medium,
    ease: 'overshoot',
    frames: [
      { t: 0,   values: { opacity: 0, translateY: 20 } },
      { t: 1,   values: { opacity: 1, translateY: 0 } },
    ],
  },
  /** 퇴장: scale(1) → 0.95 + opacity(1) → 0, anticipate, fast */
  exit: {
    durationMs: DURATION.fast,
    ease: 'anticipate',
    frames: [
      { t: 0, values: { opacity: 1, scale: 1 } },
      { t: 1, values: { opacity: 0, scale: 0.95 } },
    ],
  },
  /** 성공 팝업: scale(0.5) → 1.15 → 1.0, bounce, medium */
  successPop: {
    durationMs: DURATION.medium,
    ease: 'bounce',
    frames: [
      { t: 0,   values: { opacity: 0, scale: 0.5 } },
      { t: 0.6, values: { opacity: 1, scale: 1.15 } },
      { t: 1,   values: { opacity: 1, scale: 1 } },
    ],
  },
  /** 버튼 누름: scale(1) → 0.97, 100ms */
  press: {
    durationMs: DURATION.instant,
    ease: 'standard',
    frames: [
      { t: 0, values: { scale: 1 } },
      { t: 1, values: { scale: 0.97 } },
    ],
  },
  /** 씬 전환 (와이프 스테이지 1). */
  sceneWipeOut: {
    durationMs: 120,
    ease: 'easeIn',
    frames: [
      { t: 0, values: { opacity: 1, translateX: 0 } },
      { t: 1, values: { opacity: 0, translateX: -100 } },
    ],
  },
  sceneWipeIn: {
    durationMs: 120,
    ease: 'easeOut',
    frames: [
      { t: 0, values: { opacity: 0, translateX: 100 } },
      { t: 1, values: { opacity: 1, translateX: 0 } },
    ],
  },
};

/** 프리셋에서 경과 ms 기준 스칼라들 보간. */
export function evaluatePreset(preset: MotionPreset, elapsedMs: number): Partial<MotionKeyframe['values']> {
  const tNorm = preset.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / preset.durationMs));
  const eased = EASE[preset.ease](tNorm);
  const frames = preset.frames;
  if (frames.length === 0) return {};
  if (frames.length === 1) return { ...frames[0].values };

  // eased로 매핑된 t를 프레임 스팬 위에 놓고 두 프레임 사이 lerp.
  let lo = frames[0];
  let hi = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (eased >= frames[i].t && eased <= frames[i + 1].t) {
      lo = frames[i];
      hi = frames[i + 1];
      break;
    }
  }
  const span = hi.t - lo.t;
  const localT = span <= 0 ? 1 : (eased - lo.t) / span;
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(lo.values), ...Object.keys(hi.values)]);
  for (const k of keys) {
    const a = (lo.values as Record<string, number>)[k];
    const b = (hi.values as Record<string, number>)[k];
    if (a === undefined && b === undefined) continue;
    if (a === undefined) { out[k] = b!; continue; }
    if (b === undefined) { out[k] = a; continue; }
    out[k] = a + (b - a) * localT;
  }
  return out as Partial<MotionKeyframe['values']>;
}
