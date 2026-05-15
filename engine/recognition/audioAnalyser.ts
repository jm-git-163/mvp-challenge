/**
 * engine/recognition/audioAnalyser.ts
 *
 * Phase 1 — 오디오 RMS·dBFS·온셋 분석기.
 *
 * docs/COMPOSITION §5.3 (비트 폴백) + 미션 "Loud Voice" 점수 공식.
 * 입력: Web Audio API `AnalyserNode`의 `getFloatTimeDomainData` 또는
 *      `getByteFrequencyData` 버퍼를 매 프레임 push.
 *
 * 순수 함수들 + 상태기 `AudioAnalyser`로 분리:
 *   - computeRMS / computeDbFS / smoothDbFS: 순수
 *   - OnsetDetector: 스펙트럴 플럭스 기반 실시간 온셋
 *   - AudioAnalyser: 샘플 push → {rms, dbFS, isLoud, isOnset}
 */

// ─── 순수 함수 ──────────────────────────────────────────────────────────────

/** RMS on Float32 PCM (−1..1). */
export function computeRMS(pcm: Float32Array | number[]): number {
  if (pcm.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < pcm.length; i++) s += pcm[i] * pcm[i];
  return Math.sqrt(s / pcm.length);
}

/** RMS → dBFS. 무음 floor는 −100 dB로 클램프. */
export function rmsToDbFS(rms: number): number {
  if (rms <= 0) return -100;
  const db = 20 * Math.log10(rms);
  return Math.max(-100, db);
}

/** dBFS 두 값 이동 평균 (attack/release 분리 일차 IIR). */
export function smoothDbFS(current: number, prev: number, attack = 0.3, release = 0.05): number {
  const coef = current > prev ? attack : release;
  return prev + coef * (current - prev);
}

// ─── 온셋 감지 ──────────────────────────────────────────────────────────────

export interface OnsetDetectorParams {
  /** 플럭스 이동 평균 윈도우 (프레임). */
  window?: number;
  /** 평균 대비 배수 이상 튀면 온셋. */
  threshold?: number;
  /** 연속 온셋 간 최소 간격 (ms). */
  refractoryMs?: number;
}

const ONSET_DEFAULTS: Required<OnsetDetectorParams> = {
  window: 43,          // ≈ 1초 at 46fps
  threshold: 1.6,
  refractoryMs: 120,
};

/**
 * 스펙트럴 플럭스 기반 온셋 검출기.
 * 입력은 매 프레임 주파수 대역 크기(log-mel 또는 byte spectrum).
 */
export class OnsetDetector {
  private prevSpec: Float32Array | null = null;
  private fluxHistory: number[] = [];
  private lastOnsetAt = -Infinity;
  private readonly p: Required<OnsetDetectorParams>;

  constructor(params: OnsetDetectorParams = {}) {
    this.p = { ...ONSET_DEFAULTS, ...params };
  }

  /** @returns true면 이 프레임이 온셋. */
  push(spec: Float32Array | Uint8Array | number[], t: number): boolean {
    const arr = spec instanceof Float32Array
      ? spec
      : new Float32Array(Array.from(spec, v => v / 255));
    let flux = 0;
    if (this.prevSpec) {
      const n = Math.min(arr.length, this.prevSpec.length);
      for (let i = 0; i < n; i++) {
        const d = arr[i] - this.prevSpec[i];
        if (d > 0) flux += d; // half-wave rectify
      }
    }
    this.prevSpec = arr;

    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > this.p.window) this.fluxHistory.shift();

    const avg = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length;
    const isPeak = this.fluxHistory.length >= 4 // warm-up
      && flux > avg * this.p.threshold
      && flux > 0.01;

    if (!isPeak) return false;
    if (t - this.lastOnsetAt < this.p.refractoryMs) return false;
    this.lastOnsetAt = t;
    return true;
  }

  reset(): void {
    this.prevSpec = null;
    this.fluxHistory = [];
    this.lastOnsetAt = -Infinity;
  }
}

// ─── 메인 분석기 ────────────────────────────────────────────────────────────

export interface AudioAnalyserParams {
  /** Loud 판정 dBFS 임계값. docs/TESTING §loud-voice 에서 참조. */
  loudThresholdDb?: number;
  onset?: OnsetDetectorParams;
}

export interface AudioFrame {
  rms: number;
  dbFS: number;
  smoothedDbFS: number;
  isLoud: boolean;
  isOnset: boolean;
  /** 0..1 normalized dBFS (floor −60 → 0, 0 dB → 1). */
  level: number;
}

export class AudioAnalyser {
  private onset: OnsetDetector;
  private prevSmoothed = -100;
  private readonly loudDb: number;

  constructor(params: AudioAnalyserParams = {}) {
    this.onset = new OnsetDetector(params.onset);
    this.loudDb = params.loudThresholdDb ?? -20;
  }

  /**
   * @param pcm 시간 도메인 PCM (−1..1). 없으면 dBFS만 스킵
   * @param spec 주파수 스펙트럼 (온셋 감지용)
   * @param t 프레임 타임스탬프 (ms)
   */
  push(pcm: Float32Array | null, spec: Float32Array | Uint8Array | null, t: number): AudioFrame {
    const rms = pcm ? computeRMS(pcm) : 0;
    const dbFS = rmsToDbFS(rms);
    const smoothed = smoothDbFS(dbFS, this.prevSmoothed);
    this.prevSmoothed = smoothed;

    const isOnset = spec ? this.onset.push(spec, t) : false;
    const isLoud = smoothed >= this.loudDb;
    const level = Math.max(0, Math.min(1, (smoothed + 60) / 60));

    return { rms, dbFS, smoothedDbFS: smoothed, isLoud, isOnset, level };
  }

  reset(): void {
    this.onset.reset();
    this.prevSmoothed = -100;
  }
}
