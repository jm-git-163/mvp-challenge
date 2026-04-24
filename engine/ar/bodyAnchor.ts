/**
 * engine/ar/bodyAnchor.ts
 *
 * Phase 5e — MediaPipe PoseLandmarker 33점 → BodyAnchor.
 *
 * docs/COMPOSITION.md §6.2.
 * head · leftShoulder · rightShoulder · leftHand · rightHand · hip · 파생 팔 각도.
 *
 * 손 위치는 포즈 모델의 '왼/오른 손목'(wrist) 지점을 사용. 별도 HandLandmarker 없이도 대략 작동.
 */

import { POSE } from '../recognition/poseTypes';
import type { Landmark, Point2D } from './faceAnchor';

export interface BodyAnchor {
  head: Point2D;             // 코 또는 양 어깨의 중점 위쪽
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  leftHand: Point2D;
  rightHand: Point2D;
  hip: Point2D;
  /** 라디안. 어깨 기울기 (좌→우). */
  shoulderRoll: number;
  /** 어깨 너비 (정규화). */
  shoulderWidth: number;
}

function pt(lms: Landmark[], i: number): Point2D {
  return { x: lms[i].x, y: lms[i].y };
}

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 33점 PoseLandmarker 결과에서 BodyAnchor 추출.
 * visibility 임계치(기본 0.5) 미만은 무시.
 */
export function extractBodyAnchor(lms: Landmark[] | null | undefined, visThreshold = 0.5): BodyAnchor | null {
  if (!lms || lms.length < 33) return null;
  const ls = lms[POSE.LEFT_SHOULDER];
  const rs = lms[POSE.RIGHT_SHOULDER];
  if ((ls.visibility ?? 1) < visThreshold || (rs.visibility ?? 1) < visThreshold) return null;

  const leftShoulder = pt(lms, POSE.LEFT_SHOULDER);
  const rightShoulder = pt(lms, POSE.RIGHT_SHOULDER);
  const shoulderMid = mid(leftShoulder, rightShoulder);

  const nose = pt(lms, POSE.NOSE);
  // head는 코. 단, 보이지 않으면 어깨 중점 위쪽 25%.
  const headVisible = (lms[POSE.NOSE].visibility ?? 1) >= visThreshold;
  const head = headVisible ? nose : { x: shoulderMid.x, y: shoulderMid.y - 0.1 };

  const leftHand = pt(lms, POSE.LEFT_WRIST);
  const rightHand = pt(lms, POSE.RIGHT_WRIST);
  const hip = mid(pt(lms, POSE.LEFT_HIP), pt(lms, POSE.RIGHT_HIP));

  const shoulderRoll = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x);
  const shoulderWidth = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);

  return { head, leftShoulder, rightShoulder, leftHand, rightHand, hip, shoulderRoll, shoulderWidth };
}

/** 지정된 landmark id로 캔버스 픽셀 좌표 반환 (track binding 계산용). */
export function bodyPointByLandmark(
  anchor: BodyAnchor,
  landmark: 'head' | 'left_shoulder' | 'right_shoulder' | 'left_hand' | 'right_hand' | 'hip',
  canvasW: number,
  canvasH: number,
): Point2D {
  const map: Record<string, Point2D> = {
    head: anchor.head,
    left_shoulder: anchor.leftShoulder,
    right_shoulder: anchor.rightShoulder,
    left_hand: anchor.leftHand,
    right_hand: anchor.rightHand,
    hip: anchor.hip,
  };
  const p = map[landmark];
  return { x: p.x * canvasW, y: p.y * canvasH };
}
