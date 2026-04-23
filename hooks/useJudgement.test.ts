/**
 * hooks/useJudgement.test.ts
 *
 * TEAM-HONESTY (2026-04-23) — 가짜 PERFECT/GOOD 판정 회귀 방지.
 *
 * useJudgement 훅 자체는 React + Zustand 의존이 무거워 단위 테스트가 어렵다.
 * 대신 핵심 결정 로직을 분리해서 검증한다:
 *   1) scoreToTag: 임계값(0.80 / 0.55) 검증 — perfect 가 노이즈로 절대 안 뜸.
 *   2) detectGesture: 랜드마크 부재 / 정중앙 자세 / 진짜 동작 시나리오별
 *      "공짜 점수" 가 0 인지 확인.
 */

import { describe, it, expect } from 'vitest';
import { scoreToTag } from './useJudgement';
import { detectGesture, type NormalizedLandmark } from '../utils/poseUtils';

describe('scoreToTag — 임계값 정직성', () => {
  it('점수 0 → fail (가짜 idle 시 perfect 금지)', () => {
    expect(scoreToTag(0)).toBe('fail');
  });

  it('점수 0.30 → fail (제스처 floor 가 흘러도 fail 유지)', () => {
    expect(scoreToTag(0.30)).toBe('fail');
  });

  it('점수 0.54 → fail (good 임계값 1점 차이)', () => {
    expect(scoreToTag(0.54)).toBe('fail');
  });

  it('점수 0.55 → good (임계값 정확히)', () => {
    expect(scoreToTag(0.55)).toBe('good');
  });

  it('점수 0.79 → good (perfect 임계값 직전)', () => {
    expect(scoreToTag(0.79)).toBe('good');
  });

  it('점수 0.80 → perfect (임계값 정확히)', () => {
    expect(scoreToTag(0.80)).toBe('perfect');
  });

  it('점수 1.0 → perfect', () => {
    expect(scoreToTag(1.0)).toBe('perfect');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectGesture — 가짜 점수 floor 가 모두 0 으로 정정됐는지 확인.
// 17 keypoint MoveNet 인덱스. 신뢰도(score) 0.5 이상이어야 사용됨.
// ─────────────────────────────────────────────────────────────────────────────

function emptyLm(): NormalizedLandmark[] {
  return Array.from({ length: 17 }, () => ({ x: 0, y: 0, score: 0 }));
}

function setKp(lms: NormalizedLandmark[], idx: number, x: number, y: number, score = 1): void {
  lms[idx] = { x, y, score };
}

describe('detectGesture — 가짜 floor 제거 (TEAM-HONESTY 2026-04-23)', () => {
  it('signal 없는 빈 랜드마크 → 모든 제스처 0 점', () => {
    const lms = emptyLm();
    expect(detectGesture(lms, 'hands_up')).toBe(0);
    expect(detectGesture(lms, 'v_sign')).toBe(0);
    expect(detectGesture(lms, 'heart')).toBe(0);
    expect(detectGesture(lms, 'arms_spread')).toBe(0);
    expect(detectGesture(lms, 'thumbs_up')).toBe(0);
    expect(detectGesture(lms, 'wave')).toBe(0);
    expect(detectGesture(lms, 'point_cam')).toBe(0);
    expect(detectGesture(lms, 'arms_cross')).toBe(0);
    expect(detectGesture(lms, 'lean_left')).toBe(0);
    expect(detectGesture(lms, 'lean_right')).toBe(0);
  });

  it('정중앙 자세에서 lean_left/lean_right 둘 다 0 (이전엔 0.3 floor)', () => {
    const lms = emptyLm();
    setKp(lms, 0, 0.5, 0.3); // nose 정중앙
    expect(detectGesture(lms, 'lean_left')).toBe(0);
    expect(detectGesture(lms, 'lean_right')).toBe(0);
  });

  it('손이 어깨 아래로 내려와 있으면 hands_up = 0 (이전엔 0.5 floor)', () => {
    const lms = emptyLm();
    setKp(lms, 5, 0.4, 0.3);   // ls
    setKp(lms, 6, 0.6, 0.3);   // rs
    setKp(lms, 9, 0.4, 0.6);   // lw — 어깨보다 한참 아래
    setKp(lms, 10, 0.6, 0.6);  // rw — 어깨보다 한참 아래
    expect(detectGesture(lms, 'hands_up')).toBe(0);
  });

  it('실제로 손을 머리 위까지 올리면 hands_up ≥ 0.55 (good 이상)', () => {
    const lms = emptyLm();
    setKp(lms, 5, 0.4, 0.4);   // ls
    setKp(lms, 6, 0.6, 0.4);   // rs
    setKp(lms, 9, 0.35, 0.15); // lw — 어깨보다 0.25 위
    setKp(lms, 10, 0.65, 0.15);
    const s = detectGesture(lms, 'hands_up');
    expect(s).toBeGreaterThanOrEqual(0.55);
  });

  it('알 수 없는 gestureId → 0 (이전엔 0.5 GOOD)', () => {
    const lms = emptyLm();
    expect(detectGesture(lms, 'unknown_gesture' as any)).toBe(0);
  });

  it('lean_left: 코가 살짝 왼쪽(0.4) → 진짜 기울임 점수만', () => {
    const lms = emptyLm();
    setKp(lms, 0, 0.4, 0.3);
    const s = detectGesture(lms, 'lean_left');
    // (0.5 - 0.4) * 5 = 0.5 — good 직전 (0.55 미만이라 fail 처리)
    expect(s).toBeCloseTo(0.5, 2);
    expect(scoreToTag(s)).toBe('fail');
  });
});
