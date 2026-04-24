/**
 * engine/recognition/faceTypes.ts
 *
 * Phase 1 — MediaPipe FaceLandmarker blendshape 스키마.
 *
 * 52 blendshape categories, ARKit 표준.
 * https://developers.google.com/mediapipe/solutions/vision/face_landmarker
 *
 * 여기선 미션에서 실제 쓰는 것만 열거.
 */

export interface Blendshape {
  categoryName: string;
  score: number; // 0..1
}

/** 이름 → 점수 맵. undefined면 0. */
export function shapeScore(shapes: ReadonlyArray<Blendshape> | undefined, name: string): number {
  if (!shapes) return 0;
  for (const s of shapes) if (s.categoryName === name) return s.score;
  return 0;
}

/** 미소 강도 = max(mouthSmileLeft, mouthSmileRight). 0..1 */
export function smileIntensity(shapes: ReadonlyArray<Blendshape> | undefined): number {
  const l = shapeScore(shapes, 'mouthSmileLeft');
  const r = shapeScore(shapes, 'mouthSmileRight');
  return Math.max(l, r);
}

/** 눈 깜박임 0..1 (양쪽 평균). */
export function blinkAmount(shapes: ReadonlyArray<Blendshape> | undefined): number {
  return (shapeScore(shapes, 'eyeBlinkLeft') + shapeScore(shapes, 'eyeBlinkRight')) / 2;
}

/** 입 벌림 (jawOpen). */
export function jawOpen(shapes: ReadonlyArray<Blendshape> | undefined): number {
  return shapeScore(shapes, 'jawOpen');
}

/** 눈썹 치켜올림 (놀람·기쁨 보조 신호). */
export function browUp(shapes: ReadonlyArray<Blendshape> | undefined): number {
  return (shapeScore(shapes, 'browOuterUpLeft') + shapeScore(shapes, 'browOuterUpRight')) / 2;
}
