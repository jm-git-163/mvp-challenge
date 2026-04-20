/**
 * engine/studio/calibration.ts
 *
 * Phase 6 — 촬영 시작 전 캘리브레이션.
 * docs/EDGE_CASES.md §3: 전신/얼굴 프레임 진입, 조명, 거리 검증.
 *
 * 순수 계산만. 실제 프레임 샘플링·표시는 UI 레이어에서.
 */

export type CalibrationCheckKind =
  | 'face_in_frame'       // 얼굴 감지됨 + 프레임 중앙 부근
  | 'body_in_frame'       // 전신(양쪽 어깨+엉덩이) 감지됨
  | 'distance_ok'         // faceSize/shoulderWidth 적정 범위
  | 'lighting_ok'         // 평균 밝기 임계값 이상
  | 'microphone_live';    // 마이크 레벨 > 노이즈 플로어

export type CalibrationStatus = 'pending' | 'ok' | 'fail';

export interface CalibrationCheck {
  kind: CalibrationCheckKind;
  status: CalibrationStatus;
  message: string;         // 사용자 안내 문구 (한국어)
}

export interface CalibrationInput {
  face?: { detected: boolean; centerX: number; centerY: number; sizePx: number } | null;
  body?: { shouldersVisible: boolean; hipVisible: boolean; shoulderWidthPx: number } | null;
  /** 0~1 평균 밝기 (0=검정, 1=흰색) */
  avgBrightness?: number;
  /** 마이크 dBFS */
  micDbfs?: number;
  /** 캔버스 크기 */
  canvasW: number;
  canvasH: number;
  /** 어느 체크를 요구하는지 (템플릿이 포즈 없으면 body 생략 가능) */
  requires: CalibrationCheckKind[];
}

export interface CalibrationThresholds {
  /** 얼굴 중앙 이탈 허용 % (0.3 = 중앙 60% 영역) */
  faceCenterTolerance: number;
  /** 얼굴 최소 지름 / 캔버스 너비 */
  faceMinRatio: number;
  faceMaxRatio: number;
  /** 어깨 너비 / 캔버스 너비 */
  bodyMinShoulderRatio: number;
  bodyMaxShoulderRatio: number;
  /** 평균 밝기 최소 */
  minBrightness: number;
  /** 마이크 dBFS 최소 (노이즈 플로어 상회) */
  minMicDbfs: number;
}

export const DEFAULT_THRESHOLDS: CalibrationThresholds = {
  faceCenterTolerance: 0.3,
  faceMinRatio: 0.12,
  faceMaxRatio: 0.45,
  bodyMinShoulderRatio: 0.18,
  bodyMaxShoulderRatio: 0.55,
  minBrightness: 0.18,
  minMicDbfs: -55,
};

export function evaluateCalibration(
  input: CalibrationInput,
  th: CalibrationThresholds = DEFAULT_THRESHOLDS,
): CalibrationCheck[] {
  const out: CalibrationCheck[] = [];
  const { canvasW, canvasH, requires } = input;

  for (const kind of requires) {
    out.push(evalOne(kind, input, th, canvasW, canvasH));
  }
  return out;
}

function evalOne(
  kind: CalibrationCheckKind,
  inp: CalibrationInput,
  th: CalibrationThresholds,
  W: number,
  H: number,
): CalibrationCheck {
  switch (kind) {
    case 'face_in_frame': {
      const f = inp.face;
      if (!f || !f.detected) {
        return { kind, status: 'fail', message: '얼굴이 보이지 않습니다. 카메라를 바라봐주세요.' };
      }
      const dx = Math.abs(f.centerX - W / 2) / W;
      const dy = Math.abs(f.centerY - H / 2) / H;
      if (dx > th.faceCenterTolerance || dy > th.faceCenterTolerance) {
        return { kind, status: 'fail', message: '얼굴을 화면 중앙으로 맞춰주세요.' };
      }
      return { kind, status: 'ok', message: '얼굴 인식 완료' };
    }
    case 'body_in_frame': {
      const b = inp.body;
      if (!b || !b.shouldersVisible) {
        return { kind, status: 'fail', message: '양 어깨가 보이도록 한 걸음 물러서주세요.' };
      }
      if (!b.hipVisible) {
        return { kind, status: 'fail', message: '허리까지 보이도록 카메라에서 더 떨어져주세요.' };
      }
      return { kind, status: 'ok', message: '전신 인식 완료' };
    }
    case 'distance_ok': {
      const f = inp.face;
      const b = inp.body;
      if (f && f.detected) {
        const r = f.sizePx / W;
        if (r < th.faceMinRatio) return { kind, status: 'fail', message: '카메라에 더 가까이 와주세요.' };
        if (r > th.faceMaxRatio) return { kind, status: 'fail', message: '카메라에서 조금 더 떨어져주세요.' };
      }
      if (b && b.shouldersVisible) {
        const r = b.shoulderWidthPx / W;
        if (r < th.bodyMinShoulderRatio) return { kind, status: 'fail', message: '한 걸음 앞으로 와주세요.' };
        if (r > th.bodyMaxShoulderRatio) return { kind, status: 'fail', message: '한 걸음 뒤로 물러서주세요.' };
      }
      if (!f?.detected && !b?.shouldersVisible) {
        return { kind, status: 'fail', message: '프레임 안에 들어와주세요.' };
      }
      return { kind, status: 'ok', message: '거리 적정' };
    }
    case 'lighting_ok': {
      const br = inp.avgBrightness;
      if (br == null) return { kind, status: 'pending', message: '밝기 측정 중…' };
      if (br < th.minBrightness) {
        return { kind, status: 'fail', message: '더 밝은 곳에서 촬영해주세요.' };
      }
      return { kind, status: 'ok', message: '조명 적정' };
    }
    case 'microphone_live': {
      const d = inp.micDbfs;
      if (d == null) return { kind, status: 'pending', message: '마이크 확인 중…' };
      if (d < th.minMicDbfs) {
        return { kind, status: 'fail', message: '마이크가 음소거 상태인지 확인해주세요.' };
      }
      return { kind, status: 'ok', message: '마이크 정상' };
    }
  }
}

/** 모든 required 체크가 ok 일 때 true. pending/fail 하나라도 있으면 false. */
export function isCalibrationReady(checks: CalibrationCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.status === 'ok');
}
