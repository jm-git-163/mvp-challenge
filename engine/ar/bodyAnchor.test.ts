import { describe, it, expect } from 'vitest';
import { extractBodyAnchor, bodyPointByLandmark } from './bodyAnchor';
import { POSE } from '../recognition/poseTypes';
import type { Landmark } from './faceAnchor';

function syntheticPose(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  const arr: Landmark[] = [];
  for (let i = 0; i < 33; i++) arr.push({ x: 0.5, y: 0.5, visibility: 0.9 });
  arr[POSE.NOSE] = { x: 0.5, y: 0.2, visibility: 0.95 };
  arr[POSE.LEFT_SHOULDER] = { x: 0.4, y: 0.4, visibility: 0.95 };
  arr[POSE.RIGHT_SHOULDER] = { x: 0.6, y: 0.4, visibility: 0.95 };
  arr[POSE.LEFT_WRIST] = { x: 0.3, y: 0.6, visibility: 0.9 };
  arr[POSE.RIGHT_WRIST] = { x: 0.7, y: 0.6, visibility: 0.9 };
  arr[POSE.LEFT_HIP] = { x: 0.44, y: 0.7, visibility: 0.9 };
  arr[POSE.RIGHT_HIP] = { x: 0.56, y: 0.7, visibility: 0.9 };
  for (const [k, v] of Object.entries(overrides)) {
    arr[Number(k)] = { ...arr[Number(k)], ...v };
  }
  return arr;
}

describe('extractBodyAnchor', () => {
  it('정상 포즈 → anchor 반환', () => {
    const a = extractBodyAnchor(syntheticPose());
    expect(a).not.toBeNull();
    expect(a!.head.y).toBeLessThan(a!.hip.y);
    expect(Math.abs(a!.shoulderRoll)).toBeLessThan(0.05);
    expect(a!.shoulderWidth).toBeCloseTo(0.2, 2);
  });

  it('어깨 visibility 낮으면 null', () => {
    const lms = syntheticPose({ [POSE.LEFT_SHOULDER]: { visibility: 0.1 } });
    expect(extractBodyAnchor(lms)).toBeNull();
  });

  it('어깨 한쪽이 내려가면 shoulderRoll 양수', () => {
    const a = extractBodyAnchor(syntheticPose({ [POSE.RIGHT_SHOULDER]: { x: 0.6, y: 0.45, visibility: 0.95 } }));
    expect(a!.shoulderRoll).toBeGreaterThan(0.1);
  });

  it('코 visibility 낮으면 head=어깨 중점 위쪽', () => {
    const a = extractBodyAnchor(syntheticPose({ [POSE.NOSE]: { visibility: 0.1 } }));
    expect(a!.head.x).toBeCloseTo(0.5, 3);
    expect(a!.head.y).toBeLessThan(0.4);
  });

  it('랜드마크 부족하면 null', () => {
    expect(extractBodyAnchor([])).toBeNull();
  });
});

describe('bodyPointByLandmark', () => {
  it('left_hand 픽셀 좌표', () => {
    const a = extractBodyAnchor(syntheticPose())!;
    const p = bodyPointByLandmark(a, 'left_hand', 1080, 1920);
    expect(p.x).toBeCloseTo(0.3 * 1080, 2);
    expect(p.y).toBeCloseTo(0.6 * 1920, 2);
  });
});
