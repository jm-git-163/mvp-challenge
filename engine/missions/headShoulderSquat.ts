/**
 * headShoulderSquat.ts — Team SQUAT (2026-04-22)
 *
 * 근접촬영(셀피) 모드 스쿼트 카운팅 알고리즘.
 * docs/research/02-squat-counting.md §4 추천안 "HeadShoulderSquat (C + A 폴백)".
 *
 * 핵심 아이디어:
 *  - 신호 d = mean(shoulder.y) − nose.y
 *    → 어깨는 스쿼트 중 상체 강직으로 상대적 안정, 머리는 아래로 이동 → d 감소.
 *    → 두 점 차분이므로 카메라 흔들림에 덜 민감.
 *  - 3초 정적 캘리브레이션으로 baseline d0 확보 (rolling baseline 드리프트 방지).
 *  - DOWN 진입: d < d0 − max(0.04, d0 * 0.15)
 *  - UP 복귀 : d > d0 − max(0.015, d0 * 0.05) → +1 rep (600ms 디바운스)
 *  - 첫 rep 자동 진폭 학습: 두 번째 rep 부터 threshold 를 관측 진폭 비례로 개인화.
 *  - 어깨 visibility 부족 시 A 폴백 (nose.y 단독, 부호 반전).
 *
 * 왜 visibility 게이트를 0.3 으로 완화하는가 (research §1.3 가설 C/D):
 *  - MoveNet 근접촬영에서 nose.score 는 종종 0.3~0.5 사이로 안착.
 *  - 0.5 게이트는 history 10 을 채우기까지 5초 이상 걸려 첫 rep 을 구조적으로 놓침.
 *
 * 좌표계: normalized (0~1), y=0 상단, y=1 하단.
 * shoulder 평균 y는 nose.y 보다 아래 → d > 0 이 정상 서있는 상태.
 * 스쿼트 시 머리가 어깨 쪽으로 가라앉음 → d 감소.
 *
 * 순수 상태기 — Vitest 단위테스트 용이.
 */

const MIN_REP_INTERVAL_MS = 600;
const CALIBRATION_MS = 3000;
const CALIBRATION_MIN_SAMPLES = 15;         // 약 1.5s @10fps 이상
const NOSE_VIS_GATE = 0.30;                 // research §4.1 완화
const SHOULDER_VIS_GATE = 0.30;
// FIX-CALIB (2026-04-22): 셀피 근접촬영에서 0.08 은 너무 빡빡해 사용자가
//   완벽히 정지해도 MoveNet 랜드마크 지터만으로 σ/d0 > 8% 초과 → 캘리브가
//   영원히 14% 근방에서 재시작 루프. 0.20 으로 완화 (연구 §4.1 관용).
//   너무 흔들리면 여전히 unstable 이지만 정상 서있는 사용자는 통과한다.
const CALIBRATION_SIGMA_LIMIT = 0.20;

// FIX-HSS-v2 (2026-04-22): v1 (0.06 + dwell 300 + depth 0.035) 은 과민 해결했지만
//   "타이트하게 안될 때가 있고" — 실제 스쿼트까지 탈락. 중간값으로 재조정.
//   abs 0.05 / rel 0.18 / dwell 200ms / depth 0.025 = 고개 까딱은 탈락, 실제 스쿼트는 통과.
const ABS_DOWN_THRESHOLD = 0.05;
const REL_DOWN_THRESHOLD = 0.18;
const ABS_UP_THRESHOLD   = 0.018;
const REL_UP_THRESHOLD   = 0.06;
const MIN_DOWN_DWELL_MS  = 200;
const MIN_DEPTH_FOR_REP  = 0.025;

// UP 구간 baseline 미세조정 EMA (drift 억제)
const BASELINE_EMA_ALPHA = 0.02;

// 첫 rep 자동 진폭 학습 후 재계산 계수 (research §4.4)
const LEARNED_DOWN_FRACTION = 0.50;
const LEARNED_UP_FRACTION   = 0.20;

export type HssPhase = 'up' | 'down' | 'unknown';
export type HssMode = 'hs' | 'nose_fallback';    // head-shoulder / nose-only fallback

export type HssCalibrationStatus =
  | { state: 'pending'; progress: number }       // 샘플 수집 중 (0~1)
  | { state: 'unstable'; sigmaRatio: number }    // 흔들림 과다 — 재시작 유도
  | { state: 'ready'; d0: number; samples: number };

export interface HssUpdate {
  count: number;
  phase: HssPhase;
  mode: HssMode;
  d: number;                          // 현재 신호 값
  d0: number;                         // 현재 baseline (0 이면 미완)
  calibration: HssCalibrationStatus;
  visible: boolean;
  justCounted: boolean;
  lastCountAtMs: number;
  /** 두 번째 rep 부터 personalized threshold 가 활성화됐는가. 디버그용. */
  learnedAmp: number | null;
}

interface Landmark { x?: number; y?: number; visibility?: number; score?: number; }

export class HeadShoulderSquatDetector {
  private calibrationSamples: number[] = [];
  private calibrationStartMs: number | null = null;
  private d0: number = 0;
  private calibrated = false;
  private sigmaRatio = 0;

  private phase: HssPhase = 'unknown';
  private mode: HssMode = 'hs';
  private count = 0;
  private lastCountAt = 0;
  private lastChangeAt = 0;

  // 첫 rep 진폭 학습
  private minDSinceDown: number | null = null;
  private learnedAmp: number | null = null;

  reset(): void {
    this.calibrationSamples = [];
    this.calibrationStartMs = null;
    this.d0 = 0;
    this.calibrated = false;
    this.sigmaRatio = 0;
    this.phase = 'unknown';
    this.mode = 'hs';
    this.count = 0;
    this.lastCountAt = 0;
    this.lastChangeAt = 0;
    this.minDSinceDown = null;
    this.learnedAmp = null;
  }

  /** 외부에서 사전 측정한 d0 를 주입 (캘리브레이션 컴포넌트에서 전달) */
  injectBaseline(d0: number): void {
    if (d0 > 0 && d0 < 1) {
      this.d0 = d0;
      this.calibrated = true;
    }
  }

  getCount(): number { return this.count; }
  getPhase(): HssPhase { return this.phase; }
  getMode(): HssMode { return this.mode; }
  getBaseline(): number { return this.d0; }
  isCalibrated(): boolean { return this.calibrated; }

  msSinceLastChange(nowMs: number): number {
    return this.lastChangeAt === 0 ? Infinity : nowMs - this.lastChangeAt;
  }

  /**
   * 매 프레임 호출.
   * landmarks: MoveNet 17-keypoint (또는 mediapipe pose 33-keypoint).
   *   index 0 = nose, 5 = left_shoulder, 6 = right_shoulder.
   * nowMs: performance.now() 기반 단조 증가 타임스탬프.
   */
  update(landmarks: Landmark[], nowMs: number): HssUpdate {
    const nose = landmarks?.[0];
    const lSh  = landmarks?.[5];
    const rSh  = landmarks?.[6];

    const noseVis = nose?.visibility ?? nose?.score ?? 0;
    const lShVis  = lSh?.visibility  ?? lSh?.score  ?? 0;
    const rShVis  = rSh?.visibility  ?? rSh?.score  ?? 0;

    const noseY = typeof nose?.y === 'number' ? nose.y : NaN;
    const lShY  = typeof lSh?.y  === 'number' ? lSh.y  : NaN;
    const rShY  = typeof rSh?.y  === 'number' ? rSh.y  : NaN;

    // 모드 결정
    //   hs         : nose vis ≥ 0.3 AND (L 또는 R shoulder vis ≥ 0.3)
    //   nose_fb    : nose vis ≥ 0.3 만 (어깨 소실)
    //   invisible  : 그 외
    const noseOk = noseVis >= NOSE_VIS_GATE && Number.isFinite(noseY);
    const lOk    = lShVis  >= SHOULDER_VIS_GATE && Number.isFinite(lShY);
    const rOk    = rShVis  >= SHOULDER_VIS_GATE && Number.isFinite(rShY);

    if (!noseOk) {
      return this.freeze(false, 0, nowMs);
    }

    let d: number;
    if (lOk || rOk) {
      const shY = (lOk && rOk) ? (lShY + rShY) / 2 : (lOk ? lShY : rShY);
      // 정상 서있는 자세: 어깨가 코 아래 → shY > noseY → d > 0
      d = shY - noseY;
      this.mode = 'hs';
    } else {
      // A 폴백: nose.y 단독. "내려가면 y 증가" 이므로 부호 반전해서 d 를 "위쪽 여유" 로 표현.
      //   → d = (1 − noseY). 이렇게 하면 hs 모드와 방향(내려가면 d 감소)이 일치.
      d = 1 - noseY;
      this.mode = 'nose_fallback';
    }

    // 캘리브레이션 단계
    if (!this.calibrated) {
      if (this.calibrationStartMs === null) this.calibrationStartMs = nowMs;
      this.calibrationSamples.push(d);
      const elapsed = nowMs - this.calibrationStartMs;

      if (elapsed >= CALIBRATION_MS && this.calibrationSamples.length >= CALIBRATION_MIN_SAMPLES) {
        const { mean, sigma } = this.meanStd(this.calibrationSamples);
        this.sigmaRatio = mean > 0 ? sigma / mean : Infinity;
        if (this.sigmaRatio <= CALIBRATION_SIGMA_LIMIT && mean > 0) {
          this.d0 = mean;
          this.calibrated = true;
          this.phase = 'up';
          this.lastChangeAt = nowMs;
        } else {
          // 재시작
          this.calibrationSamples = [];
          this.calibrationStartMs = nowMs;
          return {
            count: 0, phase: 'unknown', mode: this.mode, d, d0: 0,
            calibration: { state: 'unstable', sigmaRatio: this.sigmaRatio },
            visible: true, justCounted: false, lastCountAtMs: this.lastCountAt,
            learnedAmp: null,
          };
        }
      } else {
        const progress = Math.min(1, elapsed / CALIBRATION_MS);
        return {
          count: 0, phase: 'unknown', mode: this.mode, d, d0: 0,
          calibration: { state: 'pending', progress },
          visible: true, justCounted: false, lastCountAtMs: this.lastCountAt,
          learnedAmp: null,
        };
      }
    }

    // ── 카운트 로직 (calibrated 상태) ──────────────────────────────
    const downThr = this.d0 - Math.max(ABS_DOWN_THRESHOLD, this.d0 * REL_DOWN_THRESHOLD);
    const upThr   = this.d0 - Math.max(ABS_UP_THRESHOLD,   this.d0 * REL_UP_THRESHOLD);

    // 학습된 진폭으로 threshold 재계산 (2rep 째부터)
    let effDown = downThr;
    let effUp   = upThr;
    if (this.learnedAmp !== null && this.learnedAmp > 0) {
      effDown = this.d0 - this.learnedAmp * LEARNED_DOWN_FRACTION;
      effUp   = this.d0 - this.learnedAmp * LEARNED_UP_FRACTION;
    }

    let justCounted = false;

    if (this.phase === 'up' || this.phase === 'unknown') {
      if (d < effDown) {
        this.phase = 'down';
        this.minDSinceDown = d;
        this.lastChangeAt = nowMs;
      } else {
        // UP 구간에서만 baseline EMA (드리프트 억제)
        this.d0 = this.d0 * (1 - BASELINE_EMA_ALPHA) + d * BASELINE_EMA_ALPHA;
      }
    } else if (this.phase === 'down') {
      if (this.minDSinceDown === null || d < this.minDSinceDown) {
        this.minDSinceDown = d;
      }
      if (d > effUp) {
        // FIX-HSS (2026-04-22): rep 인정 3-조건 AND
        //   1) 마지막 rep 으로부터 600ms 이상 (디바운스)
        //   2) DOWN 페이즈 300ms 이상 유지 (고개 까딱 탈락)
        //   3) DOWN 중 최저점이 baseline-0.035 이하 (진짜 내려간 적 있어야)
        const dwell = nowMs - this.lastChangeAt;
        const depthOk = this.minDSinceDown !== null && (this.d0 - this.minDSinceDown) >= MIN_DEPTH_FOR_REP;
        const intervalOk = nowMs - this.lastCountAt >= MIN_REP_INTERVAL_MS;
        const dwellOk = dwell >= MIN_DOWN_DWELL_MS;
        if (intervalOk && dwellOk && depthOk) {
          this.count += 1;
          this.lastCountAt = nowMs;
          justCounted = true;

          // 첫 rep 이후 진폭 학습 한 번만
          if (this.learnedAmp === null && this.minDSinceDown !== null) {
            const amp = this.d0 - this.minDSinceDown;
            if (amp > 0.02) this.learnedAmp = amp;
          }
        }
        this.phase = 'up';
        this.minDSinceDown = null;
        this.lastChangeAt = nowMs;
      }
    }

    return {
      count: this.count,
      phase: this.phase,
      mode: this.mode,
      d,
      d0: this.d0,
      calibration: { state: 'ready', d0: this.d0, samples: this.calibrationSamples.length },
      visible: true,
      justCounted,
      lastCountAtMs: this.lastCountAt,
      learnedAmp: this.learnedAmp,
    };
  }

  private freeze(visible: boolean, d: number, _nowMs: number): HssUpdate {
    return {
      count: this.count,
      phase: this.phase,
      mode: this.mode,
      d,
      d0: this.d0,
      calibration: this.calibrated
        ? { state: 'ready', d0: this.d0, samples: this.calibrationSamples.length }
        : { state: 'pending', progress: 0 },
      visible,
      justCounted: false,
      lastCountAtMs: this.lastCountAt,
      learnedAmp: this.learnedAmp,
    };
  }

  private meanStd(xs: number[]): { mean: number; sigma: number } {
    if (xs.length === 0) return { mean: 0, sigma: 0 };
    let s = 0;
    for (const x of xs) s += x;
    const mean = s / xs.length;
    let sq = 0;
    for (const x of xs) sq += (x - mean) * (x - mean);
    return { mean, sigma: Math.sqrt(sq / xs.length) };
  }
}
