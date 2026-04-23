/**
 * hipMotionGate.ts — TEAM-ACCURACY (2026-04-23)
 *
 * 가짜 카운트 근절 게이트.
 *
 * 배경:
 *   사용자 제보: "스쿼트 1 개도 안 했는데 가만히 앉아있던 동안 카운트 12 개로 올라갔다."
 *   원인: HSS (head-shoulder), NoseSquat 등 "근접 모드" 디텍터들은 머리/어깨 y 변화만으로
 *         rep 을 판정하므로, 사용자가 의자에 앉은 채 핸드폰을 보거나 살짝 슬럼프해도
 *         landmark jitter + 작은 머리 움직임이 threshold 를 넘어 false positive 발생.
 *
 * 해결 (CLAUDE.md §3 #1 "가짜 인식 금지" 준수):
 *   진짜 스쿼트는 **엉덩이가 크게 오르내린다**. 머리만 흔들리고 엉덩이가 정지면 스쿼트 아님.
 *   따라서 모든 카운트 증가 직전에 다음 게이트를 통과해야 한다:
 *     ① 최근 WINDOW_MS 안에 hip(11,12) y 의 (max − min) ≥ MIN_HIP_AMPL (정규화)
 *     ② 최근 프레임의 hip visibility 가 MIN_VIS 이상 (양쪽 중 하나라도)
 *   둘 중 하나라도 실패하면 카운트 거부.
 *
 * 좌표계: normalized (0~1), y=0 상단, y=1 하단.
 *
 * 순수 상태기 — Vitest 단위테스트 가능.
 */

import type { NormalizedLandmark } from '../../utils/poseUtils';

// 1.2 초 윈도 — 한 rep (≈700~1200ms) 동안 hip 이 한 번은 크게 움직여야.
//   v2 (2026-04-23): 1.5→1.2 단축. 윈도 길수록 과거 미세움직임이 누적되어 false-allow.
const WINDOW_MS = 1200;
// TEAM-CHAOS (2026-04-23 v3): 사용자 제보 "카운트 0/10 고정, 아예 안 올라감".
//   v2 (0.12) 은 실기기(카메라 거리 가변·full-body 프레이밍 부분 침범)에서 hip 정규화
//   진폭이 7~10% 대에 머물러 거의 모든 rep 이 게이트에서 막힘. 게이트 자체가 카운트를
//   0 으로 고정시키는 주범. 7% 로 하향 — 여전히 0.04 노이즈 (amplitude<0.06) 는 거부,
//   실제 스쿼트 0.08~0.20 은 통과. hipMotionGate.test.ts 의 두 경계 시나리오 모두 유지.
const MIN_HIP_AMPL = 0.07;
// hip visibility 최소값. MoveNet 근접촬영에서 hip 이 frame 밖이면 0 근처.
//   v3: 0.5 → 0.35 완화. 실기기에서 hip 가려짐(옷·조명) 으로 vis 0.4 전후 빈번 →
//        항상 low-visibility 거부. 테스트 시나리오 (hipVis=0.2) 는 여전히 차단.
const MIN_VIS = 0.35;
// 최소 샘플 수 — 너무 적으면 amplitude 가 작은 jitter 우연한 큰값일 수 있음.
//   v3: 8 → 5 완화. 20fps 에서 250ms 만 있어도 방향성 판단 가능.
const MIN_SAMPLES = 5;
// 방향성 검증 — 진짜 스쿼트는 "내려갔다(y 증가) 올라옴(y 감소)" 시퀀스.
//   윈도 안에 max y(가장 깊이 앉은 시점) 이후 y 가 다시 ≥ MIN_RETURN 만큼 감소해야.
//   v3: 0.05 → 0.025. 실기기 hip 정규화 진폭 스케일에 맞춰 완화.
const MIN_RETURN = 0.025;

interface HipSample {
  t: number;
  y: number;
  visible: boolean;
}

export interface HipGateResult {
  /** rep 카운트 허용 여부 (false 면 카운트 거부). */
  allow: boolean;
  /** 윈도 내 hip y 진폭 (max − min). visible 샘플 기준. */
  amplitude: number;
  /** 마지막 프레임 hip visibility (left/right 중 큰 값). */
  visibility: number;
  /** 윈도 내 visible 샘플 수. */
  samples: number;
  /** 거부 사유 (디버그/UI 용). */
  reason: 'ok' | 'no-amplitude' | 'low-visibility' | 'too-few-samples' | 'no-landmarks' | 'no-return';
}

export class HipMotionGate {
  private history: HipSample[] = [];

  reset(): void {
    this.history = [];
  }

  /**
   * 카운트 성공 직후 호출. 현재 히스토리를 소진하여 **다음 rep 은 새 hip 움직임**이
   * 필요하도록 강제. 이렇게 하지 않으면 한 번의 큰 자세 변경이 게이트를 1.2초간
   * 열어 그 동안 누적된 작은 노이즈도 카운트 통과 → 가짜 3연속 카운트.
   */
  consume(): void {
    this.history = [];
  }

  /**
   * 매 프레임 호출. 카운트 증가 시점에 result.allow 를 체크.
   */
  update(landmarks: NormalizedLandmark[] | undefined | null, nowMs: number): HipGateResult {
    if (!landmarks || landmarks.length < 13) {
      // hip 인덱스(11,12) 가 없는 경우 — landmark 자체가 비었거나 짧음.
      return {
        allow: false, amplitude: 0, visibility: 0, samples: 0, reason: 'no-landmarks',
      };
    }
    const lh = landmarks[11];
    const rh = landmarks[12];
    const lhVis = (lh?.score ?? lh?.visibility ?? 0);
    const rhVis = (rh?.score ?? rh?.visibility ?? 0);
    const visibility = Math.max(lhVis, rhVis);

    // 두 hip 중 visible 한 쪽 평균 y. 한쪽만 보이면 그 쪽 사용.
    let hipY: number | null = null;
    if (lhVis >= MIN_VIS && rhVis >= MIN_VIS && Number.isFinite(lh?.y) && Number.isFinite(rh?.y)) {
      hipY = ((lh!.y as number) + (rh!.y as number)) / 2;
    } else if (lhVis >= MIN_VIS && Number.isFinite(lh?.y)) {
      hipY = lh!.y as number;
    } else if (rhVis >= MIN_VIS && Number.isFinite(rh?.y)) {
      hipY = rh!.y as number;
    }

    const visible = hipY !== null;
    this.history.push({ t: nowMs, y: hipY ?? 0, visible });
    // 윈도 슬라이드
    while (this.history.length > 0 && this.history[0].t < nowMs - WINDOW_MS) {
      this.history.shift();
    }

    const visibleSamples = this.history.filter(s => s.visible);
    if (visibleSamples.length < MIN_SAMPLES) {
      return {
        allow: false, amplitude: 0, visibility,
        samples: visibleSamples.length, reason: 'too-few-samples',
      };
    }

    let minY = Infinity, maxY = -Infinity;
    for (const s of visibleSamples) {
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const amplitude = maxY - minY;

    if (visibility < MIN_VIS) {
      return {
        allow: false, amplitude, visibility,
        samples: visibleSamples.length, reason: 'low-visibility',
      };
    }
    if (amplitude < MIN_HIP_AMPL) {
      return {
        allow: false, amplitude, visibility,
        samples: visibleSamples.length, reason: 'no-amplitude',
      };
    }

    // 방향성 검증 — 진짜 스쿼트는 "max y 도달 후 다시 상승(y 감소)" 시퀀스.
    //   max y 가 윈도 끝에 있으면(= 현재도 계속 내려가는 중) 카운트 금지.
    //   max y 이후 최저 y 가 max − MIN_RETURN 이하여야 (올라왔다는 증거).
    let maxYIdx = 0;
    for (let i = 1; i < visibleSamples.length; i++) {
      if (visibleSamples[i].y > visibleSamples[maxYIdx].y) maxYIdx = i;
    }
    let postMaxMinY = visibleSamples[maxYIdx].y;
    for (let i = maxYIdx + 1; i < visibleSamples.length; i++) {
      if (visibleSamples[i].y < postMaxMinY) postMaxMinY = visibleSamples[i].y;
    }
    const returned = visibleSamples[maxYIdx].y - postMaxMinY;
    if (returned < MIN_RETURN) {
      return {
        allow: false, amplitude, visibility,
        samples: visibleSamples.length, reason: 'no-return',
      };
    }

    return {
      allow: true, amplitude, visibility,
      samples: visibleSamples.length, reason: 'ok',
    };
  }

  /** 디버그용. */
  getAmplitude(): number {
    const visible = this.history.filter(s => s.visible);
    if (visible.length < 2) return 0;
    let minY = Infinity, maxY = -Infinity;
    for (const s of visible) {
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    return maxY - minY;
  }
}
