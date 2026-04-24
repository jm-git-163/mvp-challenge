/**
 * engine/missions/poseHoldMission.ts
 *
 * Phase 1 — 포즈 유지 미션.
 *
 * CLAUDE.md §5 Pose Hold: 유사도 60 + 안정성 40, 유지시간 비례.
 *
 * 접근: 타겟 포즈를 "주요 관절 각도 8개"로 대표한다. 카메라/기기 각도에 덜 민감.
 *   - 좌우 팔꿈치 각도 (shoulder-elbow-wrist × 2)
 *   - 좌우 어깨 각도 (elbow-shoulder-hip × 2)
 *   - 좌우 무릎 각도 (hip-knee-ankle × 2)
 *   - 좌우 고관절 각도 (shoulder-hip-knee × 2)
 *
 * 유사도 = 1 - 평균(각도차/180) (각도차를 0..180°로 클램프)
 * 안정성 = 1 - 각 관절 각도의 최근 N프레임 std 평균 정규화
 *
 * 입력: `push(keyAngles: number[8], t)` — poseTypes.angleDeg로 호출자가 미리 계산
 */

export interface PoseHoldMissionParams {
  /** 유사도 활성 임계 (holding 시작). */
  enterSimilarity?: number;  // 기본 0.8
  /** 유사도 해제 임계. */
  exitSimilarity?: number;   // 기본 0.7
  /** 안정성 계산 윈도우 (프레임). */
  stabilityWindow?: number;  // 기본 20
  /** 목표 유지 시간 (ms). */
  targetHoldMs?: number;     // 기본 3000
}

const DEFAULTS: Required<PoseHoldMissionParams> = {
  enterSimilarity: 0.8,
  exitSimilarity: 0.7,
  stabilityWindow: 20,
  targetHoldMs: 3000,
};

export interface PoseHoldState {
  holding: boolean;
  holdSince: number | null;
  bestHoldMs: number;
  peakSimilarity: number;
  meanStability: number;
  sampleCount: number;
}

export class PoseHoldMission {
  private readonly p: Required<PoseHoldMissionParams>;
  private target: number[] | null = null;
  private history: number[][] = [];
  private stabilitySum = 0;
  private stabilityCount = 0;
  private s: PoseHoldState = {
    holding: false, holdSince: null, bestHoldMs: 0,
    peakSimilarity: 0, meanStability: 0, sampleCount: 0,
  };

  constructor(params: PoseHoldMissionParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  setTarget(angles: number[]): void {
    this.target = angles.slice();
  }

  push(angles: number[], t: number): PoseHoldState {
    if (!this.target) return this.s;
    if (angles.length !== this.target.length) {
      throw new Error(`angles dim mismatch: got ${angles.length}, target ${this.target.length}`);
    }

    const sim = similarityFromAngles(angles, this.target);
    this.s.peakSimilarity = Math.max(this.s.peakSimilarity, sim);
    this.s.sampleCount++;

    // stability: 관절별 std over window
    this.history.push(angles.slice());
    if (this.history.length > this.p.stabilityWindow) this.history.shift();
    if (this.history.length >= Math.max(4, this.p.stabilityWindow >> 1)) {
      const stab = stabilityFromHistory(this.history);
      this.stabilitySum += stab;
      this.stabilityCount++;
      this.s.meanStability = this.stabilitySum / this.stabilityCount;
    }

    // hold state machine
    if (!this.s.holding && sim >= this.p.enterSimilarity) {
      this.s.holding = true;
      this.s.holdSince = t;
    } else if (this.s.holding && sim < this.p.exitSimilarity) {
      if (this.s.holdSince !== null) {
        this.s.bestHoldMs = Math.max(this.s.bestHoldMs, t - this.s.holdSince);
      }
      this.s.holding = false;
      this.s.holdSince = null;
    }
    if (this.s.holding && this.s.holdSince !== null) {
      this.s.bestHoldMs = Math.max(this.s.bestHoldMs, t - this.s.holdSince);
    }

    return this.s;
  }

  getState(): PoseHoldState { return this.s; }

  similarity(): number { return this.s.peakSimilarity; }
  stability(): number { return this.s.meanStability; }
  /** 유지시간 비율 (0..1). */
  holdRatio(): number {
    return Math.min(1, this.s.bestHoldMs / this.p.targetHoldMs);
  }

  /** CLAUDE §5: (similarity*60 + stability*40) * holdRatio. */
  totalScore(): number {
    const base = this.similarity() * 60 + this.stability() * 40;
    return Math.round(base * this.holdRatio());
  }

  reset(): void {
    this.history = []; this.stabilitySum = 0; this.stabilityCount = 0;
    this.s = {
      holding: false, holdSince: null, bestHoldMs: 0,
      peakSimilarity: 0, meanStability: 0, sampleCount: 0,
    };
  }
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

export function similarityFromAngles(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    const clamped = Math.min(180, d);
    sum += clamped / 180;
  }
  return Math.max(0, 1 - sum / a.length);
}

/**
 * 관절별 std를 계산해 안정성 점수(0..1)로 매핑.
 * std ≤ 2° → 1.0, std ≥ 20° → 0.
 */
export function stabilityFromHistory(history: readonly (readonly number[])[]): number {
  if (history.length < 2) return 0;
  const dim = history[0].length;
  let sumScore = 0;
  for (let j = 0; j < dim; j++) {
    let m = 0;
    for (let i = 0; i < history.length; i++) m += history[i][j];
    m /= history.length;
    let v = 0;
    for (let i = 0; i < history.length; i++) v += (history[i][j] - m) ** 2;
    v /= history.length;
    const std = Math.sqrt(v);
    const score = (20 - Math.max(2, Math.min(20, std))) / 18;
    sumScore += Math.max(0, Math.min(1, score));
  }
  return sumScore / dim;
}
