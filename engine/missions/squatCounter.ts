/**
 * engine/missions/squatCounter.ts
 *
 * Phase 1 — 스쿼트 반복 카운터.
 *
 * CLAUDE.md §5 Squat 점수: 달성률 50 + 깊이 30 + 템포 20.
 * docs/TESTING §missions 경계값:
 *   - 무릎 각도 hysteresis (down < 100°, up > 160°)
 *   - 최소 유지 시간(down 상태 > 150ms) 으로 지터 방지
 *   - 템포: rep 간 간격의 CV(변동계수) 낮을수록 높은 점수
 *
 * 입력: 매 프레임 `{ t, kneeAngle }` 또는 pose 랜드마크에서 파생.
 *       (pose→angle 변환은 caller가 poseTypes.angleDeg로)
 *
 * 출력: `{ reps, depth[], tempo[], isDown, phase }`
 */

export interface SquatCounterParams {
  /** 아래 상태 진입 임계 각도. */
  downAngle?: number;    // 기본 100°
  /** 위 상태 진입 임계 각도. */
  upAngle?: number;      // 기본 160°
  /** down 상태 최소 유지 시간. 이보다 짧으면 무시. */
  downHoldMs?: number;   // 기본 150ms
  /** 목표 횟수 (달성률 계산용). */
  target?: number;       // 기본 10
  /**
   * Focused Session-3 Candidate I — 실기기 MediaPipe 랜드마크 지터 대응.
   * 입력 각도 스무딩 방식. 기본 'ema'(알파 0.35).
   *   - 'none'    : 원본값 사용 (과거 호환)
   *   - 'ema'     : 지수이동평균 — 1~2 프레임 스파이크 흡수
   *   - 'median3' : 최근 3 프레임 중앙값 — 임펄스 노이즈에 강함
   */
  smoothing?: 'none' | 'ema' | 'median3';
  /** EMA 알파 (smoothing='ema' 일 때만). 0~1, 클수록 반응 빠름. 기본 0.35. */
  emaAlpha?: number;
  /**
   * 1프레임 이상치 각도 변화 한계 (°). 절댓값이 이 이상이면 해당 샘플 무시.
   * MediaPipe landmark 소실/튐으로 100→40→100 처럼 급변 시 지터 방지.
   * 기본 55° (사람 무릎이 1/30 초 안에 55° 이상 움직이는 건 물리적으로 불가).
   */
  maxAnglePerFrame?: number;
}

const DEFAULTS: Required<SquatCounterParams> = {
  downAngle: 100,
  upAngle: 160,
  downHoldMs: 150,
  target: 10,
  // 기본 'none' — 기존 호출부 호환성. 프로덕션 MediaPipe 경로에서는 'ema' 권장.
  smoothing: 'none',
  emaAlpha: 0.35,
  maxAnglePerFrame: 0, // 0 = 비활성. 프로덕션에서는 55 권장.
};

export type SquatPhase = 'up' | 'descending' | 'down' | 'ascending';

export interface SquatRep {
  /** rep 완료 타임스탬프 (ms). */
  t: number;
  /** rep 중 최소 각도 (깊이). 낮을수록 깊음. */
  minAngle: number;
  /** descent→ascent→up 복귀까지 걸린 시간. */
  durationMs: number;
}

export interface SquatState {
  phase: SquatPhase;
  reps: number;
  repList: SquatRep[];
  /** 현재 rep 동안의 최저 각도. */
  currentMinAngle: number;
  /** 현재 down 진입 시각. */
  downEnteredAt: number | null;
  /** 현재 rep 시작 시각 (descending 진입 직전 up 마지막). */
  repStartedAt: number | null;
}

export class SquatCounter {
  private readonly p: Required<SquatCounterParams>;
  private state: SquatState = {
    phase: 'up',
    reps: 0,
    repList: [],
    currentMinAngle: 180,
    downEnteredAt: null,
    repStartedAt: null,
  };
  // Focused Session-3 Candidate I: 지터/이상치 필터 상태
  private emaPrev: number | null = null;
  private hist3: number[] = [];
  private lastAccepted: number | null = null;

  constructor(params: SquatCounterParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  /**
   * 입력 각도 전처리: outlier reject → smoothing.
   * 반환 `null` 이면 이 프레임은 상태 머신을 건너뜀(이상치).
   */
  private preprocess(angle: number): number | null {
    if (!Number.isFinite(angle)) return null;

    // 1) outlier reject — lastAccepted 대비 과도 변화
    if (this.lastAccepted !== null && this.p.maxAnglePerFrame > 0) {
      if (Math.abs(angle - this.lastAccepted) > this.p.maxAnglePerFrame) {
        return null; // 튐 — 이번 프레임 스킵
      }
    }

    // 2) smoothing
    let smoothed = angle;
    switch (this.p.smoothing) {
      case 'ema': {
        const a = this.p.emaAlpha;
        smoothed = this.emaPrev === null ? angle : a * angle + (1 - a) * this.emaPrev;
        this.emaPrev = smoothed;
        break;
      }
      case 'median3': {
        this.hist3.push(angle);
        if (this.hist3.length > 3) this.hist3.shift();
        const sorted = [...this.hist3].sort((a, b) => a - b);
        smoothed = sorted[Math.floor(sorted.length / 2)];
        break;
      }
      case 'none':
      default:
        break;
    }

    this.lastAccepted = smoothed;
    return smoothed;
  }

  push(rawAngle: number, t: number): SquatState {
    const pre = this.preprocess(rawAngle);
    if (pre === null) return this.state;
    const angle = pre;

    // 현재 rep 최저 각도 갱신
    if (this.state.phase !== 'up') {
      this.state.currentMinAngle = Math.min(this.state.currentMinAngle, angle);
    }

    switch (this.state.phase) {
      case 'up':
        if (angle < this.p.upAngle - 5) {
          this.state.phase = 'descending';
          this.state.repStartedAt = t;
          this.state.currentMinAngle = angle;
        }
        break;
      case 'descending':
        if (angle <= this.p.downAngle) {
          this.state.phase = 'down';
          this.state.downEnteredAt = t;
        } else if (angle > this.p.upAngle) {
          // 다시 올라옴 (스쿼트 포기) — 취소
          this.reset();
        }
        break;
      case 'down':
        if (angle > this.p.downAngle + 5) {
          // down 유지 시간 체크
          const held = t - (this.state.downEnteredAt ?? t);
          if (held < this.p.downHoldMs) {
            // 너무 짧음 → 지터, 무시하고 descending로
            this.state.phase = 'descending';
          } else {
            this.state.phase = 'ascending';
          }
        }
        break;
      case 'ascending':
        if (angle >= this.p.upAngle) {
          // rep 완료
          const start = this.state.repStartedAt ?? t;
          this.state.repList.push({
            t,
            minAngle: this.state.currentMinAngle,
            durationMs: t - start,
          });
          this.state.reps++;
          this.state.phase = 'up';
          this.state.currentMinAngle = 180;
          this.state.downEnteredAt = null;
          this.state.repStartedAt = null;
        } else if (angle <= this.p.downAngle) {
          // 다시 내려감
          this.state.phase = 'down';
          this.state.downEnteredAt = t;
        }
        break;
    }

    return this.state;
  }

  getState(): SquatState { return this.state; }
  isDown(): boolean { return this.state.phase === 'down'; }

  /** 달성률 (0..1). */
  achievement(): number {
    return Math.min(1, this.state.reps / this.p.target);
  }

  /**
   * 깊이 점수 (0..1). 각 rep 최저 각도가 낮을수록 ↑.
   * 100° → 0.0, 60°이하 → 1.0 선형 매핑.
   */
  depth(): number {
    if (this.state.repList.length === 0) return 0;
    const avg = this.state.repList.reduce((s, r) => s + r.minAngle, 0) / this.state.repList.length;
    const score = (100 - Math.max(60, Math.min(100, avg))) / 40;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 템포 점수 (0..1). rep 간격의 CV가 작을수록 ↑.
   * CV = std / mean. CV ≤ 0.1 → 1.0, CV ≥ 0.5 → 0.
   */
  tempo(): number {
    if (this.state.repList.length < 2) return 0;
    const intervals: number[] = [];
    for (let i = 1; i < this.state.repList.length; i++) {
      intervals.push(this.state.repList[i].t - this.state.repList[i - 1].t);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) return 0;
    const variance = intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;
    const score = (0.5 - Math.max(0.1, Math.min(0.5, cv))) / 0.4;
    return Math.max(0, Math.min(1, score));
  }

  /** 최종 0~100 점수 (CLAUDE §5 공식). */
  totalScore(): number {
    return Math.round(this.achievement() * 50 + this.depth() * 30 + this.tempo() * 20);
  }

  reset(): void {
    this.state = {
      phase: 'up',
      reps: 0,
      repList: [],
      currentMinAngle: 180,
      downEnteredAt: null,
      repStartedAt: null,
    };
    this.emaPrev = null;
    this.hist3 = [];
    this.lastAccepted = null;
  }
}
