/**
 * engine/ar/faceAnchor.ts
 *
 * Phase 5e — MediaPipe FaceLandmarker 478점에서 **의미 있는 기준점 + 자세 각도** 추출.
 *
 * docs/COMPOSITION.md §6.1 FaceAnchor:
 *   nose · leftEye · rightEye · mouth · forehead · chin · leftCheek · rightCheek
 *   yaw · pitch · roll · faceSize
 *
 * 좌표는 정규화(0..1) 또는 픽셀 둘 다 지원. `normalize=true`일 때 입력은 MediaPipe 기본 정규화 좌표.
 *
 * One Euro 스무딩은 상위(FaceStickerLayer)에서 주입. 이 모듈은 순수 기하.
 */

export interface Point2D { x: number; y: number; }
export interface Landmark { x: number; y: number; z?: number; visibility?: number; }

/** MediaPipe FaceLandmarker 478점 기준 인덱스. */
export const FACE_LM = {
  NOSE_TIP: 1,
  FOREHEAD: 10,
  CHIN: 152,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  MOUTH_UPPER: 13,
  MOUTH_LOWER: 14,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
} as const;

export interface FaceAnchor {
  nose: Point2D;
  leftEye: Point2D; rightEye: Point2D;
  mouth: Point2D;
  forehead: Point2D;
  chin: Point2D;
  leftCheek: Point2D; rightCheek: Point2D;
  /** radians. 좌→우 회전 축 (고개 좌우로 돌리기). */
  yaw: number;
  /** radians. 위→아래 회전 (끄덕임). */
  pitch: number;
  /** radians. 기울임 (고개를 어깨 쪽으로). */
  roll: number;
  /** 정규화된 얼굴 크기 (캔버스 폭 대비 0..1 근사). */
  faceSize: number;
}

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 478 landmarks 배열에서 FaceAnchor 추출.
 * @param lms 길이 ≥ 468. 정규화 좌표(0..1) 기준.
 * @returns null이면 랜드마크 부족.
 */
export function extractFaceAnchor(lms: Landmark[] | null | undefined): FaceAnchor | null {
  if (!lms || lms.length < 468) return null;
  const p = (i: number): Point2D => ({ x: lms[i].x, y: lms[i].y });

  const nose = p(FACE_LM.NOSE_TIP);
  const forehead = p(FACE_LM.FOREHEAD);
  const chin = p(FACE_LM.CHIN);
  const leftEyeOuter = p(FACE_LM.LEFT_EYE_OUTER);
  const rightEyeOuter = p(FACE_LM.RIGHT_EYE_OUTER);
  const leftEyeInner = p(FACE_LM.LEFT_EYE_INNER);
  const rightEyeInner = p(FACE_LM.RIGHT_EYE_INNER);
  const leftCheek = p(FACE_LM.LEFT_CHEEK);
  const rightCheek = p(FACE_LM.RIGHT_CHEEK);
  const mouthUpper = p(FACE_LM.MOUTH_UPPER);
  const mouthLower = p(FACE_LM.MOUTH_LOWER);

  const leftEye = mid(leftEyeOuter, leftEyeInner);
  const rightEye = mid(rightEyeOuter, rightEyeInner);
  const mouth = mid(mouthUpper, mouthLower);
  const eyeMid = mid(leftEye, rightEye);

  // roll: 두 눈을 잇는 선의 기울기
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  // yaw: eyeMid에서 nose.x가 얼굴 중심축에서 얼마나 이탈했는지.
  // 얼굴 너비 = 두 볼 사이 거리. 이탈/너비 ≈ sin(yaw).
  const faceWidth = Math.max(1e-4, dist(leftCheek, rightCheek));
  const yawProxy = (nose.x - eyeMid.x) / faceWidth;
  const yaw = Math.asin(Math.max(-1, Math.min(1, yawProxy * 2))); // 경험적 스케일

  // pitch: eyeMid→nose의 수직 거리 vs (forehead→chin) 거리.
  const faceHeight = Math.max(1e-4, dist(forehead, chin));
  const pitchProxy = (nose.y - eyeMid.y) / faceHeight;
  // 정면일 때 약 0.3 근처이므로 보정.
  const pitch = Math.asin(Math.max(-1, Math.min(1, (pitchProxy - 0.3) * 2)));

  // faceSize: forehead~chin 거리 (정규화 좌표). 캔버스 폭 대비 이미 0..1.
  const faceSize = faceHeight;

  return {
    nose, leftEye, rightEye, mouth, forehead, chin,
    leftCheek, rightCheek,
    yaw, pitch, roll, faceSize,
  };
}

/**
 * 여러 얼굴이 감지되면 가장 큰 얼굴(forehead-chin 거리 기준) 하나만 사용.
 */
export function selectPrimaryFace(faces: Landmark[][]): Landmark[] | null {
  if (!faces || faces.length === 0) return null;
  if (faces.length === 1) return faces[0];
  let best: Landmark[] | null = null;
  let bestSize = -1;
  for (const f of faces) {
    if (f.length < 468) continue;
    const size = dist({ x: f[FACE_LM.FOREHEAD].x, y: f[FACE_LM.FOREHEAD].y }, { x: f[FACE_LM.CHIN].x, y: f[FACE_LM.CHIN].y });
    if (size > bestSize) { bestSize = size; best = f; }
  }
  return best;
}

/**
 * FaceAnchor + 랜드마크 ID로 캔버스 픽셀 위치 반환 (track binding 계산용).
 * canvasW/H는 anchor가 정규화 좌표인 경우의 스케일.
 */
export function anchorPointByLandmark(
  anchor: FaceAnchor,
  landmark: 'nose' | 'left_eye' | 'right_eye' | 'forehead' | 'chin' | 'left_cheek' | 'right_cheek' | 'mouth',
  canvasW: number,
  canvasH: number,
): Point2D {
  const map: Record<string, Point2D> = {
    nose: anchor.nose,
    left_eye: anchor.leftEye,
    right_eye: anchor.rightEye,
    forehead: anchor.forehead,
    chin: anchor.chin,
    left_cheek: anchor.leftCheek,
    right_cheek: anchor.rightCheek,
    mouth: anchor.mouth,
  };
  const p = map[landmark];
  return { x: p.x * canvasW, y: p.y * canvasH };
}

/**
 * 스무딩된 FaceAnchor 저장소. 프레임 간 미감지 시 최근 anchor 유지 + 페이드아웃 계수(0..1).
 * persistenceMs 내 재감지되면 스냅처럼 돌아옴.
 */
export class FaceAnchorCache {
  private last: FaceAnchor | null = null;
  private lastMs = -Infinity;
  private readonly persistenceMs: number;

  constructor(persistenceMs = 400) {
    this.persistenceMs = persistenceMs;
  }

  update(nowMs: number, anchor: FaceAnchor | null): void {
    if (anchor) { this.last = anchor; this.lastMs = nowMs; }
  }

  /** 현재 anchor + confidence. 미감지 시 persistenceMs 안에서 페이드. */
  get(nowMs: number): { anchor: FaceAnchor | null; confidence: number } {
    if (!this.last) return { anchor: null, confidence: 0 };
    const age = nowMs - this.lastMs;
    if (age <= 0) return { anchor: this.last, confidence: 1 };
    if (age >= this.persistenceMs) return { anchor: null, confidence: 0 };
    return { anchor: this.last, confidence: 1 - age / this.persistenceMs };
  }
}
