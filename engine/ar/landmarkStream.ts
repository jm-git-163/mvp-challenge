/**
 * engine/ar/landmarkStream.ts
 *
 * Focused Session-5 Candidate T:
 *   MediaPipe NormalizedLandmark[] 스트림을 OneEuroFilter 로 일괄 스무딩하는 브릿지.
 *
 *   - 기존 `engine/ar/oneEuroFilter.ts` 의 scalar/vector 필터를 랜드마크 형태
 *     ({x,y,z,visibility?,score?}[]) 에 적합하게 래핑.
 *   - visibility/score 가 임계치 미만이면 해당 랜드마크는 "미관측" 처리 →
 *     직전 스무딩된 값을 그대로 반환 (튐 방지).
 *   - AR face_sticker / hand_emoji / body_overlay 레이어가 단일 API 로 소비하게 함.
 *
 * 사용:
 *   const sm = createLandmarkSmoother(33, { minCutoff: 0.5, beta: 0.01 });
 *   const smoothed = sm.push(landmarks, performance.now());
 *   // smoothed[i] = { x, y, z, visibility } — 축마다 1€ 필터 적용
 */
import { OneEuroFilter, type OneEuroParams } from './oneEuroFilter';

export interface NormalizedLandmarkLike {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  score?: number;
}

export interface LandmarkSmootherOptions extends OneEuroParams {
  /** visibility/score 이하면 새 raw 값을 무시. 기본 0.1. */
  visibilityThreshold?: number;
  /** 3D(true) 또는 2D(false) 스무딩. 기본 true. */
  useZ?: boolean;
}

export interface LandmarkSmoother {
  /**
   * 한 프레임 push. 반환 배열은 길이가 count 와 동일.
   * 랜드마크가 덜 들어오면(length < count) 부족분은 이전 값 유지.
   */
  push(lms: ReadonlyArray<NormalizedLandmarkLike>, tMs?: number): NormalizedLandmarkLike[];
  reset(): void;
  /** 진단: 현재 스무딩된 스냅샷. */
  snapshot(): NormalizedLandmarkLike[];
}

export function createLandmarkSmoother(
  count: number,
  opts: LandmarkSmootherOptions = {},
): LandmarkSmoother {
  const visTh = opts.visibilityThreshold ?? 0.1;
  const useZ = opts.useZ ?? true;
  // undefined 키는 넘기면 DEFAULTS 를 덮어써 NaN 을 유발 → 존재 키만 포함
  const params: OneEuroParams = {};
  if (opts.minCutoff !== undefined) params.minCutoff = opts.minCutoff;
  if (opts.beta !== undefined) params.beta = opts.beta;
  if (opts.dCutoff !== undefined) params.dCutoff = opts.dCutoff;
  if (opts.initAsIs !== undefined) params.initAsIs = opts.initAsIs;

  const xF: OneEuroFilter[] = [];
  const yF: OneEuroFilter[] = [];
  const zF: OneEuroFilter[] = [];
  const last: NormalizedLandmarkLike[] = [];
  for (let i = 0; i < count; i++) {
    xF.push(new OneEuroFilter(params));
    yF.push(new OneEuroFilter(params));
    zF.push(new OneEuroFilter(params));
    last.push({ x: 0, y: 0, z: 0, visibility: 0 });
  }

  function isObservable(lm: NormalizedLandmarkLike): boolean {
    const v = lm.visibility ?? lm.score ?? 1;
    return Number.isFinite(lm.x) && Number.isFinite(lm.y) && v >= visTh;
  }

  return {
    push(lms, tMs) {
      const out: NormalizedLandmarkLike[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const raw = lms[i];
        if (!raw || !isObservable(raw)) {
          // 관측 실패 → 이전 스무딩된 값 유지 (필터 상태도 갱신하지 않음)
          out[i] = { ...last[i] };
          continue;
        }
        const x = xF[i].filter(raw.x, tMs);
        const y = yF[i].filter(raw.y, tMs);
        const z = useZ ? zF[i].filter(raw.z ?? 0, tMs) : (raw.z ?? 0);
        const v = raw.visibility ?? raw.score ?? 1;
        const cur: NormalizedLandmarkLike = { x, y, z, visibility: v };
        out[i] = cur;
        last[i] = cur;
      }
      return out;
    },
    reset() {
      for (let i = 0; i < count; i++) {
        xF[i].reset();
        yF[i].reset();
        zF[i].reset();
        last[i] = { x: 0, y: 0, z: 0, visibility: 0 };
      }
    },
    snapshot() { return last.map((lm) => ({ ...lm })); },
  };
}
