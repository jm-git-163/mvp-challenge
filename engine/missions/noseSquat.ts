/**
 * noseSquat.ts — FIX-Z25 (2026-04-22)
 *
 * 초단순 스쿼트 카운터: 코(nose, landmark 0) 의 y 좌표만 본다.
 *  - 최근 2초 평균을 baseline 으로 유지
 *  - baseline - 0.08 이하로 내려가면 'down' 상태 전환
 *  - baseline - 0.03 이상 복귀하면 'up' 전환 + count++
 *  - 600ms 중복 방지 디바운스
 *  - nose.visibility > 0.5 한 조건만 (PoseCalibration 게이트 없음)
 *
 * 기존 full-body knee-angle 로직이 PoseCalibration 게이트까지 막혀 0 이 뜨는
 * 실기기 케이스에 대한 안전망. 두 로직 중 더 관대한 쪽이 카운트되도록.
 *
 * 좌표계: MediaPipe/MoveNet normalized (0~1). y=0 상단, y=1 하단.
 * "머리가 내려간다" = y 가 커진다 (기존 대부분 라이브러리 컨벤션).
 * → baseline + THRESHOLD_DOWN 이상이면 down, baseline + THRESHOLD_UP 이하 복귀하면 up.
 *
 * 순수 상태기 — 단위테스트 가능.
 */

const BASELINE_WINDOW_MS = 2000;
const THRESHOLD_DOWN = 0.08;   // baseline 대비 아래로 8% (정규화) 내려가면 down
const THRESHOLD_UP   = 0.03;   // baseline 대비 위로 3% 복귀하면 up
const MIN_REP_INTERVAL_MS = 600;
const MIN_VISIBILITY = 0.5;

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
  private history: Array<{ t: number; y: number }> = [];
  private phase: NoseSquatPhase = 'unknown';
  private count = 0;
  private lastCountAt = 0;
  private lastChangeAt = 0;

  reset(): void {
    this.history = [];
    this.phase = 'unknown';
    this.count = 0;
    this.lastCountAt = 0;
    this.lastChangeAt = 0;
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
        baseline: this.computeBaseline(),
        noseY: Number.isFinite(noseY) ? noseY : 0,
        visible: false, lastCountAtMs: this.lastCountAt,
        justCounted: false,
      };
    }

    // history 업데이트 (2초 윈도)
    this.history.push({ t: nowMs, y: noseY });
    while (this.history.length > 0 && this.history[0].t < nowMs - BASELINE_WINDOW_MS) {
      this.history.shift();
    }

    const baseline = this.computeBaseline();

    // baseline 이 안정화되려면 최소 몇 샘플 필요.
    // 최소 10 프레임(≈500ms @20fps) 이상 쌓인 뒤 카운트 시작.
    if (this.history.length < 10) {
      return {
        count: this.count, phase: this.phase, baseline,
        noseY, visible, lastCountAtMs: this.lastCountAt, justCounted: false,
      };
    }

    // 상 / 하 판정.
    //   y 가 baseline 보다 커지면(아래로 내려감) → down 후보.
    //   y 가 baseline 에 복귀하면 → up.
    const downTrigger = noseY > baseline + THRESHOLD_DOWN;
    const upTrigger   = noseY < baseline + THRESHOLD_UP;

    if (this.phase === 'unknown') {
      // 첫 안정 상태: baseline 근처면 up 으로 arm
      if (upTrigger) {
        this.phase = 'up';
        this.lastChangeAt = nowMs;
      }
    } else if (this.phase === 'up') {
      if (downTrigger) {
        this.phase = 'down';
        this.lastChangeAt = nowMs;
      }
    } else if (this.phase === 'down') {
      if (upTrigger) {
        // up 복귀 = 1 rep 완료
        if (nowMs - this.lastCountAt >= MIN_REP_INTERVAL_MS) {
          this.count += 1;
          this.lastCountAt = nowMs;
          justCounted = true;
        }
        this.phase = 'up';
        this.lastChangeAt = nowMs;
      }
    }

    return {
      count: this.count, phase: this.phase, baseline,
      noseY, visible, lastCountAtMs: this.lastCountAt, justCounted,
    };
  }

  /**
   * 최근 2초간 nose.y 평균. history 비어있으면 0.15 (기본 "서있는" 값).
   */
  private computeBaseline(): number {
    if (this.history.length === 0) return 0.15;
    let sum = 0;
    for (const h of this.history) sum += h.y;
    return sum / this.history.length;
  }

  /** 마지막 phase 변화 이후 경과 (ms). 정체 감지용. */
  msSinceLastChange(nowMs: number): number {
    return this.lastChangeAt === 0 ? Infinity : nowMs - this.lastChangeAt;
  }

  getCount(): number { return this.count; }
  getPhase(): NoseSquatPhase { return this.phase; }
}
