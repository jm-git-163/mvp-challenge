/**
 * engine/missions/smileMission.ts
 *
 * Phase 1 — 미소 미션.
 *
 * CLAUDE.md §5 Smile 공식: 강도 50 + 지속 50.
 *
 * 입력: 매 프레임 `{ t, intensity: 0..1 }` (FaceLandmarker blendshape에서 파생).
 * 출력:
 *   - peak: 세션 전체 최대 강도
 *   - sustainedMs: 연속 활성 (intensity ≥ activateThreshold) 중 가장 긴 구간
 *   - activeRatio: 전체 시간 대비 활성 프레임 비율
 *
 * Hysteresis: `activateThreshold` 이상이면 active, `deactivateThreshold` 이하면 inactive.
 */

export interface SmileMissionParams {
  activateThreshold?: number;   // 기본 0.5
  deactivateThreshold?: number; // 기본 0.35
  /** 미션 목표 지속 시간 (ms). 지속 점수 정규화에 사용. */
  targetSustainMs?: number;     // 기본 3000
}

const DEFAULTS: Required<SmileMissionParams> = {
  activateThreshold: 0.5,
  deactivateThreshold: 0.35,
  targetSustainMs: 3000,
};

export interface SmileState {
  active: boolean;
  activeSince: number | null;
  peak: number;
  bestSustainedMs: number;
  totalActiveMs: number;
  totalMs: number;
  lastT: number | null;
  /** 현재 유지 시간 (ms). */
  currentSustainedMs: number;
}

export class SmileMission {
  private readonly p: Required<SmileMissionParams>;
  private s: SmileState = {
    active: false,
    activeSince: null,
    peak: 0,
    bestSustainedMs: 0,
    totalActiveMs: 0,
    totalMs: 0,
    lastT: null,
    currentSustainedMs: 0,
  };

  constructor(params: SmileMissionParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  push(intensity: number, t: number): SmileState {
    if (this.s.lastT !== null) {
      const dt = Math.max(0, t - this.s.lastT);
      this.s.totalMs += dt;
      if (this.s.active) this.s.totalActiveMs += dt;
    }
    this.s.lastT = t;
    this.s.peak = Math.max(this.s.peak, intensity);

    const wasActive = this.s.active;
    if (!wasActive && intensity >= this.p.activateThreshold) {
      this.s.active = true;
      this.s.activeSince = t;
    } else if (wasActive && intensity <= this.p.deactivateThreshold) {
      // 전환 시점에 현재 유지 길이 best와 비교
      if (this.s.activeSince !== null) {
        const len = t - this.s.activeSince;
        this.s.bestSustainedMs = Math.max(this.s.bestSustainedMs, len);
      }
      this.s.active = false;
      this.s.activeSince = null;
      this.s.currentSustainedMs = 0;
    }

    if (this.s.active && this.s.activeSince !== null) {
      this.s.currentSustainedMs = t - this.s.activeSince;
      this.s.bestSustainedMs = Math.max(this.s.bestSustainedMs, this.s.currentSustainedMs);
    }

    return this.s;
  }

  getState(): SmileState { return this.s; }

  /** 강도 점수 0..1 (세션 피크). */
  intensity(): number { return Math.min(1, this.s.peak); }

  /** 지속 점수 0..1. bestSustainedMs / targetSustainMs. */
  sustain(): number {
    return Math.min(1, this.s.bestSustainedMs / this.p.targetSustainMs);
  }

  /** 0..100 총점 (CLAUDE §5). */
  totalScore(): number {
    return Math.round(this.intensity() * 50 + this.sustain() * 50);
  }

  reset(): void {
    this.s = {
      active: false, activeSince: null, peak: 0, bestSustainedMs: 0,
      totalActiveMs: 0, totalMs: 0, lastT: null, currentSustainedMs: 0,
    };
  }
}
