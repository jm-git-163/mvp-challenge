/**
 * engine/missions/closeProximitySquat.ts
 *
 * FIX-O (2026-04-22) — 알고리즘 완전 재설계.
 *
 * 문제: 기존(FIX-J/L) 은 "히스토리 min/max 의 % 기반 임계 교차"로 판정.
 *   한 번의 일회성 이동(예: 앉는 동작) 이 히스토리에 큰 진폭을 남기면,
 *   이후 작은 머리 흔들림이 양쪽 임계를 양방향으로 넘어 스쿼트 1~2 회로
 *   잘못 카운트되는 치명적 버그 (유저 보고: 앉아서 2회 카운트).
 *
 * 해결: **실제 local minima/maxima 검출** + **속도 반전 확인** + **rep 시간 제약**.
 *   - 매 프레임 y 의 방향 변화(up→down 또는 down→up) 를 체크
 *   - 반전이 일어난 지점을 pivot 으로 기록, 이전 pivot 과의 진폭이 충분할 때만 유효
 *   - pivot 시퀀스 "up-pivot → down-pivot → up-pivot" 이 완성되면 1 rep
 *   - 각 rep 의 시간(down→up 전환) 은 0.4~3.0s 범위 (너무 짧으면 지터, 길면 스쿼트 아님)
 *
 * 한계: 유저가 완전히 가만히 앉아있어도 머리 이동 없으면 카운트 안됨 ✓
 *   유저가 머리를 크게 끄덕이면 오인식 가능 → UX 안내 필요.
 */

import type { NormalizedLandmark } from '../../utils/poseUtils';

const FACE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const MIN_VIS = 0.3;
const MIN_PIVOT_AMPL  = 0.05;    // 5% — pivot 간 최소 진폭 (실제 스쿼트 다운 폭)
const MIN_REP_MS      = 400;     // rep 최소 시간 (이보다 짧으면 머리 끄덕임)
const MAX_REP_MS      = 3500;    // rep 최대 시간 (이보다 길면 스쿼트 아님)
const VELOCITY_EPS    = 0.0005;  // 프레임 당 y 변화 무시 임계(float 노이즈만 컷)
const SMOOTHING_ALPHA = 0.4;     // EMA 스무딩

export interface CloseSquatState {
  phase: 'up' | 'down' | 'unknown';
  count: number;
  faceY: number;
  amplitude: number;
  active: boolean;
  // 디버그 — HUD 표시용
  visibility: number;       // 얼굴 랜드마크 평균 visibility
  velSign: -1 | 0 | 1;      // 현재 Y 속도 부호 (+=아래)
  lastPivotType: 'top' | 'bottom' | 'none';
  lastPivotY: number;
}

export class CloseProximitySquatDetector {
  // EMA-스무딩된 y
  private smoothedY: number | null = null;
  // 직전 프레임의 스무딩 y (속도 계산용)
  private lastY: number | null = null;
  // 속도 부호: +1 = 아래로(squat down), -1 = 위로(standing), 0 = 정지
  private lastVelSign: 0 | 1 | -1 = 0;
  // pivot: 방향 반전이 일어난 지점 {y, t, type}
  private lastPivot: { y: number; t: number; type: 'top' | 'bottom' } | null = null;
  // 최근 완성된 bottom pivot 시각 (rep 완성 시 사용)
  private lastBottomAt: number | null = null;
  // 상태
  private phase: 'up' | 'down' | 'unknown' = 'unknown';
  private count = 0;
  private lastFaceY = 0;
  private lastAmpl = 0;
  private lastActive = false;
  private lastVisibility = 0;

  update(lms: NormalizedLandmark[], tMs?: number): CloseSquatState {
    const faceY = this.extractFaceY(lms);
    const active = faceY !== null;
    this.lastActive = active;

    if (!active) return this.snapshot();

    this.lastFaceY = faceY!;

    // 1) EMA 스무딩
    const sm = this.smoothedY === null
      ? faceY!
      : SMOOTHING_ALPHA * faceY! + (1 - SMOOTHING_ALPHA) * this.smoothedY;
    const prev = this.smoothedY;
    this.smoothedY = sm;

    if (prev === null || this.lastY === null) {
      this.lastY = sm;
      return this.snapshot();
    }

    // 2) 속도 부호 계산 (노이즈 epsilon 제외)
    const dy = sm - this.lastY;
    const currVelSign: 0 | 1 | -1 =
      dy >  VELOCITY_EPS ? 1 :
      dy < -VELOCITY_EPS ? -1 : 0;

    // 3) velocity 변화 감지 → pivot 기록
    const now = tMs ?? Date.now();
    const velChanged = currVelSign !== this.lastVelSign;

    if (velChanged && this.lastVelSign !== 0) {
      // 이전에 움직이고 있었고, 지금 멈추거나 반전 → 이전 움직임 끝나는 지점이 pivot
      // lastVelSign=+1 (아래로 가던 중) → bottom pivot
      // lastVelSign=-1 (위로 가던 중) → top pivot
      const pivotType: 'top' | 'bottom' = this.lastVelSign === 1 ? 'bottom' : 'top';
      const pivotY = this.lastY;

      if (this.lastPivot) {
        const ampl = Math.abs(pivotY - this.lastPivot.y);
        this.lastAmpl = ampl;
        if (ampl >= MIN_PIVOT_AMPL) {
          if (pivotType === 'bottom' && this.lastPivot.type === 'top') {
            this.phase = 'down';
            this.lastBottomAt = now;
            this.lastPivot = { y: pivotY, t: now, type: 'bottom' };
          } else if (pivotType === 'top' && this.lastPivot.type === 'bottom') {
            // rep 완성 후보 — 시간 체크
            if (this.lastBottomAt !== null) {
              const repDur = now - this.lastBottomAt;
              if (repDur >= MIN_REP_MS && repDur <= MAX_REP_MS) {
                this.count++;
              }
            }
            this.phase = 'up';
            this.lastPivot = { y: pivotY, t: now, type: 'top' };
          } else {
            // 같은 타입 연속 — 이전 pivot 을 더 극값으로 갱신
            if (pivotType === 'top' && pivotY < this.lastPivot.y) {
              this.lastPivot = { y: pivotY, t: now, type: 'top' };
            } else if (pivotType === 'bottom' && pivotY > this.lastPivot.y) {
              this.lastPivot = { y: pivotY, t: now, type: 'bottom' };
            }
          }
        }
      } else {
        this.lastPivot = { y: pivotY, t: now, type: pivotType };
      }
    }

    if (velChanged && currVelSign !== 0 && this.lastVelSign === 0) {
      // 정지 상태에서 움직임 시작 — 현재 위치가 암시적 pivot
      // currVelSign=+1 (아래로 시작) → 현재가 top, currVelSign=-1 (위로 시작) → 현재가 bottom
      const startType: 'top' | 'bottom' = currVelSign === 1 ? 'top' : 'bottom';
      if (!this.lastPivot || this.lastPivot.type !== startType) {
        this.lastPivot = { y: this.lastY, t: now, type: startType };
      }
    }

    this.lastVelSign = currVelSign;
    this.lastY = sm;

    return this.snapshot();
  }

  private extractFaceY(lms: NormalizedLandmark[]): number | null {
    if (!lms || lms.length === 0) { this.lastVisibility = 0; return null; }
    let sum = 0; let n = 0; let visSum = 0; let visN = 0;
    for (const idx of FACE_INDICES) {
      const lm = lms[idx];
      if (!lm) continue;
      const v = lm.score ?? lm.visibility ?? 1;
      visSum += v; visN++;
      if (v < MIN_VIS) continue;
      sum += lm.y;
      n++;
    }
    this.lastVisibility = visN > 0 ? visSum / visN : 0;
    return n >= 2 ? sum / n : null;
  }

  reset(): void {
    this.smoothedY = null;
    this.lastY = null;
    this.lastVelSign = 0;
    this.lastPivot = null;
    this.lastBottomAt = null;
    this.phase = 'unknown';
    this.count = 0;
    this.lastFaceY = 0;
    this.lastAmpl = 0;
  }

  getCount(): number { return this.count; }
  getPhase(): 'up' | 'down' | 'unknown' { return this.phase; }

  private snapshot(): CloseSquatState {
    return {
      phase: this.phase,
      count: this.count,
      faceY: this.lastFaceY,
      amplitude: this.lastAmpl,
      active: this.lastActive,
      visibility: this.lastVisibility,
      velSign: this.lastVelSign,
      lastPivotType: this.lastPivot?.type ?? 'none',
      lastPivotY: this.lastPivot?.y ?? 0,
    };
  }
}
