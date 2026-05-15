/**
 * engine/missions/angleSmoother.ts
 *
 * Focused Session-4 Candidate N:
 *   MoveNet/MediaPipe 추정 각도에 섞이는 스파이크/지터를 걸러내는 경량 스무더.
 *
 *   - outlier rejection: 직전 accepted 값 대비 |Δ| > maxAnglePerFrame 이면 reject (null 반환)
 *   - smoothing:
 *       'none'    : 그대로 통과
 *       'ema'     : y_t = α·x + (1-α)·y_{t-1}
 *       'median3' : 최근 3개 중앙값
 *
 *   SquatCounter.preprocess 와 동일한 세맨틱이지만, 클래스 없이도 쓸 수 있도록
 *   useJudgement 등 production caller 가 직접 재사용한다.
 */
export type SmoothingMode = 'none' | 'ema' | 'median3';

export interface AngleSmootherOptions {
  smoothing?: SmoothingMode;
  /** EMA α (0~1). 클수록 즉응, 작을수록 부드러움. */
  emaAlpha?: number;
  /** 한 프레임 최대 허용 각도 변화량. 0 이면 미적용. */
  maxAnglePerFrame?: number;
}

export interface AngleSmoother {
  /** 각도 1프레임 push. 아웃라이어면 null, 아니면 스무딩된 각도 반환. */
  push(angle: number): number | null;
  reset(): void;
  /** 마지막 accepted 원본(raw-after-outlier-filter) 진단용. */
  lastAccepted(): number | null;
}

export function createAngleSmoother(opts: AngleSmootherOptions = {}): AngleSmoother {
  const smoothing = opts.smoothing ?? 'none';
  const emaAlpha = Math.max(0, Math.min(1, opts.emaAlpha ?? 0.35));
  const maxStep = Math.max(0, opts.maxAnglePerFrame ?? 0);

  let emaPrev: number | null = null;
  let hist3: number[] = [];
  let last: number | null = null;

  return {
    push(raw: number): number | null {
      if (!Number.isFinite(raw)) return null;

      // 1) outlier rejection
      if (maxStep > 0 && last !== null) {
        if (Math.abs(raw - last) > maxStep) return null;
      }
      last = raw;

      // 2) smoothing
      if (smoothing === 'ema') {
        emaPrev = emaPrev === null ? raw : emaAlpha * raw + (1 - emaAlpha) * emaPrev;
        return emaPrev;
      }
      if (smoothing === 'median3') {
        hist3.push(raw);
        if (hist3.length > 3) hist3.shift();
        const sorted = [...hist3].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }
      return raw;
    },
    reset() {
      emaPrev = null;
      hist3 = [];
      last = null;
    },
    lastAccepted() { return last; },
  };
}
