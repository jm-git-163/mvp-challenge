/**
 * noseSquat.ts — FIX-Z25 (2026-04-22)
 *
 * FIX-SQUAT-QUALITY (2026-04-24): 이중 방향 오류 해결.
 *   ① baseline 잠금 (lock-in): 기존 2초 rolling 평균은 down 구간에도 값이 흘러들어가
 *      baseline 이 스쿼트 깊이만큼 밀리고, 다시 "서있는" 높이로 복귀 시 noseY가 새
 *      baseline 보다 오히려 위쪽으로 가서 uptrigger 가 조기 발동 → 한 rep 에 여러 카운트
 *      또는 실제 rep 이 업 복귀 전에 끝난 걸로 오판. → 첫 20 프레임의 "정적" 구간만
 *      평균해 d0 를 **고정**하고 이후는 up-구간 EMA 로만 미세 드리프트 보정.
 *   ② 카운트 arming: 기존엔 1 프레임이라도 upTrigger 면 phase=up 으로 무장 → 첫 입장
 *      이 down-구간일 때 다음 복귀로 즉시 카운트 허용 (false positive). → 연속 N 프레임
 *      (≥3) up-zone 머물러야 arming.
 *   ③ up-threshold 0.03 → 0.02. 너무 관대하면 얕은 고개 움직임에서도 카운트 완료로
 *      잡힘. 실제 스쿼트는 머리가 거의 baseline 까지 돌아와야 함.
 *   ④ 최소 깊이 기록: rep 을 인정하려면 down 페이즈 동안 최저점이 baseline+0.06 이상
 *      내려간 적이 있어야 (진짜 앉은 적 있어야). 고개 끄덕임 차단.
 *
 * 좌표계: MediaPipe/MoveNet normalized (0~1). y=0 상단, y=1 하단.
 * "머리가 내려간다" = y 가 커진다.
 */

const BASELINE_LOCK_FRAMES = 15;    // FIX-SQUAT-QUALITY: 초기 15 프레임으로 d0 고정 (~750ms @ 20fps)
const THRESHOLD_DOWN = 0.08;        // baseline 대비 아래로 8% 내려가야 DOWN 진입
const THRESHOLD_UP   = 0.02;        // FIX-SQUAT-QUALITY: 0.03 → 0.02 (정직한 복귀)
const MIN_DEPTH = 0.06;             // FIX-SQUAT-QUALITY: rep 인정 최소 깊이 (baseline+0.06)
const ARM_UP_FRAMES = 3;            // FIX-SQUAT-QUALITY: up-zone N 프레임 연속 필요
const MIN_REP_INTERVAL_MS = 700;    // FIX-SQUAT-QUALITY: 600→700ms (인간 스쿼트 하한)
const MIN_VISIBILITY = 0.6;         // FIX-SQUAT-QUALITY: 0.5 → 0.6 (더 확실한 감지만)
const UP_ZONE_EMA_ALPHA = 0.04;     // lock 후 up-구간 미세 보정

export type NoseSquatPhase = 'up' | 'down' | 'unknown';

export interface NoseSquatUpdate {
  count: number;
  phase: NoseSquatPhase;
  baseline: number;       // 0~1 (최근 2초 평균 nose.y)
  noseY: number;          // 현재 nose.y
  visible: boolean;       // nose.visibility > 0.5
  lastCountAtMs: number;
  /** 방금 이 update 호출에서 count 가 1 증가했나 */
  justCounted: boolean;
}

export class NoseSquatDetector {
  private initSamples: number[] = [];
  private baseline: number = 0;
  private baselineLocked: boolean = false;
  private phase: NoseSquatPhase = 'unknown';
  private count = 0;
  private lastCountAt = 0;
  private lastChangeAt = 0;
  // FIX-SQUAT-QUALITY: arming + depth tracking.
  private upZoneFrames = 0;
  private armed = false;
  private maxYSinceDown: number | null = null;  // down 구간 중 가장 깊이 내려간 nose.y

  reset(): void {
    this.initSamples = [];
    this.baseline = 0;
    this.baselineLocked = false;
    this.phase = 'unknown';
    this.count = 0;
    this.lastCountAt = 0;
    this.lastChangeAt = 0;
    this.upZoneFrames = 0;
    this.armed = false;
    this.maxYSinceDown = null;
  }

  /**
   * landmarks: normalized (0~1).
   * nowMs: 이 프레임 타임스탬프. 테스트에서는 임의 값 주입 가능.
   */
  update(landmarks: Array<{ x?: number; y?: number; visibility?: number; score?: number }>, nowMs: number): NoseSquatUpdate {
    const nose = landmarks?.[0];
    const vis = (nose?.visibility ?? nose?.score ?? 0);
    const noseY = typeof nose?.y === 'number' ? nose.y : NaN;
    const visible = vis > MIN_VISIBILITY && Number.isFinite(noseY);

    let justCounted = false;

    if (!visible) {
      return {
        count: this.count, phase: this.phase,
        baseline: this.baseline,
        noseY: Number.isFinite(noseY) ? noseY : 0,
        visible: false, lastCountAtMs: this.lastCountAt,
        justCounted: false,
      };
    }

    // FIX-SQUAT-QUALITY (2026-04-24): baseline lock-in.
    //   초기 N 프레임의 "정적" 값만 누적해 평균 → d0 고정. 이후 rolling 금지.
    //   사용자가 처음 프레임에 들어오자마자 움직이면 lock 값 오염 — 그래도
    //   up-zone EMA 로 서서히 보정됨. 치명적 drift 는 없음.
    if (!this.baselineLocked) {
      this.initSamples.push(noseY);
      if (this.initSamples.length >= BASELINE_LOCK_FRAMES) {
        // 이상치 제거: 중앙값 근처 75% 만 평균에 반영.
        const sorted = [...this.initSamples].sort((a, b) => a - b);
        const lo = Math.floor(sorted.length * 0.125);
        const hi = Math.ceil(sorted.length * 0.875);
        const core = sorted.slice(lo, hi);
        this.baseline = core.reduce((s, v) => s + v, 0) / core.length;
        this.baselineLocked = true;
      }
      return {
        count: this.count, phase: this.phase, baseline: this.baseline || 0.15,
        noseY, visible, lastCountAtMs: this.lastCountAt, justCounted: false,
      };
    }

    const baseline = this.baseline;
    const downTrigger = noseY > baseline + THRESHOLD_DOWN;
    const upTrigger   = noseY < baseline + THRESHOLD_UP;
    const inUpZone    = noseY < baseline + THRESHOLD_UP * 2; // relaxed zone for arming + drift

    // FIX-SQUAT-QUALITY: arming — 첫 N 프레임 연속 up-zone 에 머물러야 카운트 무장.
    //   부정적 입장: 사용자가 이미 앉아있던 상태로 프레임 진입 → down-zone → 일어나면서
    //   upTrigger 즉시 만족 → 가짜 카운트. armed=false 면 그 전이를 무시.
    if (!this.armed) {
      if (inUpZone) {
        this.upZoneFrames += 1;
        if (this.upZoneFrames >= ARM_UP_FRAMES) {
          this.armed = true;
          this.phase = 'up';
          this.lastChangeAt = nowMs;
        }
      } else {
        this.upZoneFrames = 0;
      }
      return {
        count: this.count, phase: this.phase, baseline,
        noseY, visible, lastCountAtMs: this.lastCountAt, justCounted: false,
      };
    }

    // Armed state machine
    if (this.phase === 'up' || this.phase === 'unknown') {
      // up 구간 EMA baseline 미세조정 (drift 억제)
      if (inUpZone) {
        this.baseline = this.baseline * (1 - UP_ZONE_EMA_ALPHA) + noseY * UP_ZONE_EMA_ALPHA;
      }
      if (downTrigger) {
        this.phase = 'down';
        this.lastChangeAt = nowMs;
        this.maxYSinceDown = noseY;
      }
    } else if (this.phase === 'down') {
      if (this.maxYSinceDown === null || noseY > this.maxYSinceDown) {
        this.maxYSinceDown = noseY;
      }
      if (upTrigger) {
        // FIX-SQUAT-QUALITY: 3-조건 AND — interval, 진짜 깊이, 최소 dwell.
        const depthOk = this.maxYSinceDown !== null && (this.maxYSinceDown - baseline) >= MIN_DEPTH;
        const intervalOk = nowMs - this.lastCountAt >= MIN_REP_INTERVAL_MS;
        const dwellOk = nowMs - this.lastChangeAt >= 200;
        if (intervalOk && dwellOk && depthOk) {
          this.count += 1;
          this.lastCountAt = nowMs;
          justCounted = true;
        }
        this.phase = 'up';
        this.lastChangeAt = nowMs;
        this.maxYSinceDown = null;
      }
    }

    return {
      count: this.count, phase: this.phase, baseline,
      noseY, visible, lastCountAtMs: this.lastCountAt, justCounted,
    };
  }

  /** 마지막 phase 변화 이후 경과 (ms). 정체 감지용. */
  msSinceLastChange(nowMs: number): number {
    return this.lastChangeAt === 0 ? Infinity : nowMs - this.lastChangeAt;
  }

  getCount(): number { return this.count; }
  getPhase(): NoseSquatPhase { return this.phase; }
}
