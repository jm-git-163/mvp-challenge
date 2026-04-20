/**
 * engine/recognition/poseTypes.ts
 *
 * Phase 1 — MediaPipe PoseLandmarker 33-포인트 스키마.
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 *
 * 런타임 PoseLandmarker 임포트는 Phase 5e (AR 레이어)에서 실제 연결.
 * 여기선 타입만 고정해 미션 카운터/스코어러가 의존할 수 있게 한다.
 */

export interface Landmark3D {
  x: number;   // 0..1 normalized (image width)
  y: number;   // 0..1 normalized (image height, down = +)
  z: number;   // depth in landmark space
  visibility?: number; // 0..1
}

/** MediaPipe Pose 33 포인트 인덱스. */
export const POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

export type PoseIndex = (typeof POSE)[keyof typeof POSE];

export interface PoseFrame {
  t: number;                   // ms
  landmarks: Landmark3D[];     // 33개
  worldLandmarks?: Landmark3D[];
}

/** 두 점 사이 2D 거리 (정규화 좌표계). */
export function dist2D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 세 점이 이루는 각도 (도). b가 정점. */
export function angleDeg(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mab = Math.hypot(abx, aby);
  const mcb = Math.hypot(cbx, cby);
  if (mab === 0 || mcb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mab * mcb)));
  return Math.acos(cos) * 180 / Math.PI;
}

/** 좌우 평균 landmark. 한 쪽만 visible하면 그 쪽만. */
export function mean(a: Landmark3D, b: Landmark3D): Landmark3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}
