/**
 * engine/missions/closeProximitySquat.ts
 *
 * FIX-J (2026-04-21) — 근접 촬영 스쿼트 판정.
 *
 * 배경: 유저가 스마트폰을 손에 쥐거나 눈 앞에 세워두고 챌린지를 하면 카메라에
 *   얼굴·상체만 잡혀 무릎 각도 계산이 불가 → `detectSquat` 가 `unknown / 180°`
 *   를 돌려주고 점수 영원히 0. 2~3 m 거리 전신 촬영은 모바일에선 비현실적.
 *
 * 해결: 무릎이 안 보여도 **얼굴 Y 좌표의 진동**으로 스쿼트를 감지.
 *   - 폰이 거치/고정 상태: 유저가 쪼그리면 얼굴 자체가 프레임 하단으로 내려옴
 *   - 폰이 손에 들린 상태: 팔이 얼굴을 따라 움직이지만 완전 동기화되진 않음 →
 *     진폭이 작아도 peak/trough 감지 가능 (임계 낮춤)
 *
 * 한계: 유저가 폰을 완벽히 얼굴에 고정하고 팔만 움직이면 감지 불가.
 *   → UX 로 "폰을 세워두면 정확도 ↑" 안내.
 *
 * 순수 함수·클래스 구조. 외부 API·센서 권한 불요.
 */

import type { NormalizedLandmark } from '../../utils/poseUtils';

// MediaPipe Pose 랜드마크 인덱스 — 얼굴 쪽 (nose, eye, ear)
const FACE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // nose, eyes, ears 주변

const MIN_VIS = 0.3;
const HISTORY_LEN = 24;         // ≈ 0.8~1.2s at 20~30fps
// FIX-L (2026-04-21): 실기기 테스트 결과 4% 는 너무 엄격.
//   폰을 손에 쥐거나 눈앞에 세워두면 스쿼트 시 얼굴 이동 폭이 실제로 2~3% 수준.
//   2.5% 로 낮춤 — 노이즈(손떨림 ≤1.5%)와 실제 스쿼트 구분은 여전히 충분.
const MIN_PEAK_AMPL = 0.025;     // Normalized Y: 2.5% 프레임 높이
const COOLDOWN_FRAMES = 8;       // rep 간 최소 프레임 수

export interface CloseSquatState {
  phase: 'up' | 'down' | 'unknown';
  count: number;
  faceY: number;                // 최근 얼굴 Y (디버그)
  amplitude: number;            // 최근 윈도우 진폭
  active: boolean;              // 감지 가능 상태 (얼굴 잘 잡힘)
}

/**
 * 얼굴 Y 좌표 진동 기반 스쿼트 카운터.
 * 인스턴스 당 상태 유지 (reset 으로 세션 초기화).
 */
export class CloseProximitySquatDetector {
  private yHistory: number[] = [];
  private phase: 'up' | 'down' | 'unknown' = 'unknown';
  private count = 0;
  private cooldown = 0;
  private lastFaceY = 0;
  private lastAmpl = 0;
  private lastActive = false;

  /**
   * 한 프레임의 랜드마크를 주입.
   * @returns 현재 상태 스냅샷
   */
  update(lms: NormalizedLandmark[]): CloseSquatState {
    const faceY = this.extractFaceY(lms);
    const active = faceY !== null;
    this.lastActive = active;

    if (!active) {
      // 얼굴이 안 잡히면 진동 추적 불가 — 히스토리는 유지
      if (this.cooldown > 0) this.cooldown--;
      return this.snapshot();
    }

    this.lastFaceY = faceY!;
    this.yHistory.push(faceY!);
    if (this.yHistory.length > HISTORY_LEN) this.yHistory.shift();
    if (this.cooldown > 0) this.cooldown--;

    if (this.yHistory.length < HISTORY_LEN / 2) return this.snapshot();

    const minY = Math.min(...this.yHistory);
    const maxY = Math.max(...this.yHistory);
    const ampl = maxY - minY;
    this.lastAmpl = ampl;

    if (ampl < MIN_PEAK_AMPL) {
      // 진폭이 작으면 "서 있음" 판정 유지
      this.phase = this.phase === 'down' ? 'up' : this.phase;
      return this.snapshot();
    }

    // 임계선 (진폭의 30%, 70% 지점)
    const lowThresh  = minY + ampl * 0.3;
    const highThresh = maxY - ampl * 0.3;

    const y = faceY!;
    // Y 좌표는 원점이 상단 → 값이 클수록 화면 아래 = 몸이 내려간 상태
    const newPhase: 'up' | 'down' | 'unknown' =
      y > highThresh ? 'down' :
      y < lowThresh  ? 'up'   : this.phase;

    // 전이: up → down → up 한 사이클에서 up 복귀 시 count++
    if (this.phase === 'down' && newPhase === 'up' && this.cooldown === 0) {
      this.count++;
      this.cooldown = COOLDOWN_FRAMES;
    }
    this.phase = newPhase;
    return this.snapshot();
  }

  /**
   * 여러 얼굴 랜드마크의 평균 Y. visibility 가 낮으면 null.
   */
  private extractFaceY(lms: NormalizedLandmark[]): number | null {
    if (!lms || lms.length === 0) return null;
    let sum = 0;
    let n = 0;
    for (const idx of FACE_INDICES) {
      const lm = lms[idx];
      if (!lm) continue;
      const v = lm.score ?? lm.visibility ?? 1;
      if (v < MIN_VIS) continue;
      sum += lm.y;
      n++;
    }
    return n >= 2 ? sum / n : null;
  }

  reset(): void {
    this.yHistory = [];
    this.phase = 'unknown';
    this.count = 0;
    this.cooldown = 0;
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
    };
  }
}
