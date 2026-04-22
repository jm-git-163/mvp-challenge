/**
 * headShoulderSquat.test.ts — Team SQUAT (2026-04-22)
 *
 * docs/research/02-squat-counting.md §4 알고리즘 시나리오 검증.
 *
 * 핵심 시나리오:
 *  - 3초 캘리브레이션 → d0 확보
 *  - 정적 자세 유지 → 카운트 0 (false positive 없음)
 *  - 진입(d < d0 − max(0.04, d0*0.15)) + 복귀(d > d0 − max(0.015, d0*0.05)) → +1
 *  - 600ms 디바운스
 *  - 어깨 미검출 시 nose_fallback 으로 전환
 *  - 캘리브레이션 중 흔들림(σ/d0 > 0.08) → unstable 재시작
 *  - 첫 rep 자동 진폭 학습
 */
import { describe, it, expect } from 'vitest';
import { HeadShoulderSquatDetector } from '../headShoulderSquat';

type LM = { x?: number; y?: number; visibility?: number };

/**
 * MoveNet 17-keypoint 스텁.
 *   noseY: 코 y (0~1, 내려가면 증가)
 *   shoulderY: 어깨 평균 y. 보통 noseY + 0.12 정도 (어깨가 아래).
 *   noseVis / shVis: visibility. 없으면 어깨/코 탈락 시나리오.
 */
function makeLandmarks(noseY: number, shoulderY: number, opts: { noseVis?: number; shVis?: number } = {}): LM[] {
  const noseVis = opts.noseVis ?? 0.9;
  const shVis = opts.shVis ?? 0.9;
  const arr: LM[] = new Array(17).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0 }));
  arr[0] = { x: 0.5, y: noseY,     visibility: noseVis };
  arr[5] = { x: 0.45, y: shoulderY, visibility: shVis };
  arr[6] = { x: 0.55, y: shoulderY, visibility: shVis };
  return arr;
}

/** 정적 캘리브레이션 3초를 빠르게 통과시킨다. d0 ≈ 0.12 */
function runCalibration(det: HeadShoulderSquatDetector, startMs = 0): number {
  let t = startMs;
  // 초당 20 프레임 × 3.2초
  for (let i = 0; i < 65; i++) {
    det.update(makeLandmarks(0.20, 0.32), t);
    t += 50;
  }
  return t;
}

describe('HeadShoulderSquatDetector', () => {
  it('초기 상태 — count 0, 미캘리브레이션', () => {
    const d = new HeadShoulderSquatDetector();
    expect(d.getCount()).toBe(0);
    expect(d.isCalibrated()).toBe(false);
  });

  it('3초 정적 캘리브레이션 통과 → d0 설정, phase=up', () => {
    const d = new HeadShoulderSquatDetector();
    runCalibration(d);
    expect(d.isCalibrated()).toBe(true);
    // d0 = shoulderY - noseY = 0.32 - 0.20 = 0.12
    expect(d.getBaseline()).toBeGreaterThan(0.10);
    expect(d.getBaseline()).toBeLessThan(0.14);
    expect(d.getPhase()).toBe('up');
  });

  it('캘리브레이션 실패 시 unstable 리포트 발생 + 재시작', () => {
    const d = new HeadShoulderSquatDetector();
    // 매 프레임 크게 흔들리는 자세: nose y 가 0.15 ~ 0.30 왕복
    let t = 0;
    let sawUnstable = false;
    for (let i = 0; i < 65; i++) {
      const noseY = i % 2 === 0 ? 0.15 : 0.30;
      const r = d.update(makeLandmarks(noseY, 0.35), t);
      if (r.calibration.state === 'unstable') sawUnstable = true;
      t += 50;
    }
    // unstable 이 최소 한 번 보고됐고, 끝까지 calibrated 되지 않아야 한다
    expect(sawUnstable).toBe(true);
    expect(d.isCalibrated()).toBe(false);
  });

  it('캘리브레이션 → 진입 → 복귀 → +1 카운트', () => {
    const d = new HeadShoulderSquatDetector();
    let t = runCalibration(d);   // d0 ≈ 0.12
    expect(d.getCount()).toBe(0);

    // 스쿼트 진입: 머리가 어깨 쪽으로 가라앉음 (noseY 0.20 → 0.28, 어깨 고정 0.32)
    //   d = 0.32 - 0.28 = 0.04 < d0 − max(0.04, 0.018) = 0.12 − 0.04 = 0.08 ✓
    for (let i = 0; i < 10; i++) {
      d.update(makeLandmarks(0.28, 0.32), t);
      t += 50;
    }
    expect(d.getPhase()).toBe('down');
    expect(d.getCount()).toBe(0);

    // 복귀: noseY 0.21. d = 0.11 > d0 − max(0.015, 0.006) = 0.105 ✓
    let rep: ReturnType<typeof d.update> | undefined;
    for (let i = 0; i < 15; i++) {
      rep = d.update(makeLandmarks(0.21, 0.32), t);
      t += 50;
    }
    expect(d.getCount()).toBe(1);
    expect(d.getPhase()).toBe('up');
    // justCounted 는 복귀 첫 프레임에서 true 였어야 하고, 그 뒤 false
    expect(rep?.justCounted).toBe(false);
  });

  it('복구 불가 시(계속 down 상태) 카운트 0 유지', () => {
    const d = new HeadShoulderSquatDetector();
    let t = runCalibration(d);
    // down 만 계속
    for (let i = 0; i < 50; i++) {
      d.update(makeLandmarks(0.28, 0.32), t);
      t += 50;
    }
    expect(d.getPhase()).toBe('down');
    expect(d.getCount()).toBe(0);
  });

  it('600ms 디바운스 — 너무 빠른 연속 rep 은 하나만', () => {
    const d = new HeadShoulderSquatDetector();
    let t = runCalibration(d);

    // 1st rep
    for (let i = 0; i < 6; i++) { d.update(makeLandmarks(0.28, 0.32), t); t += 50; }   // down
    for (let i = 0; i < 4; i++) { d.update(makeLandmarks(0.21, 0.32), t); t += 50; }   // up (+1)
    expect(d.getCount()).toBe(1);

    // 즉시 2nd rep (+200ms 정도) — 디바운스로 무시
    for (let i = 0; i < 3; i++) { d.update(makeLandmarks(0.28, 0.32), t); t += 50; }   // down
    for (let i = 0; i < 2; i++) { d.update(makeLandmarks(0.21, 0.32), t); t += 50; }   // up
    expect(d.getCount()).toBe(1);

    // 600ms+ 경과 후에는 카운트
    for (let i = 0; i < 15; i++) { d.update(makeLandmarks(0.28, 0.32), t); t += 50; }  // down (충분히 대기)
    for (let i = 0; i < 5; i++)  { d.update(makeLandmarks(0.21, 0.32), t); t += 50; }  // up
    expect(d.getCount()).toBeGreaterThanOrEqual(2);
  });

  it('어깨 vis < 0.3 → nose_fallback 모드로 전환', () => {
    const d = new HeadShoulderSquatDetector();
    let t = 0;
    // 어깨 visibility 0 으로 고정
    for (let i = 0; i < 65; i++) {
      d.update(makeLandmarks(0.20, 0.32, { shVis: 0 }), t);
      t += 50;
    }
    expect(d.getMode()).toBe('nose_fallback');
    // d = 1 − noseY = 0.80 — 큰 값이지만 캘리브레이션은 통과해야 한다
    expect(d.isCalibrated()).toBe(true);
  });

  it('nose vis < 0.3 → invisible (카운트 정지)', () => {
    const d = new HeadShoulderSquatDetector();
    let t = 0;
    let last;
    for (let i = 0; i < 10; i++) {
      last = d.update(makeLandmarks(0.20, 0.32, { noseVis: 0.1 }), t);
      t += 50;
    }
    expect(last?.visible).toBe(false);
    expect(d.isCalibrated()).toBe(false);
  });

  it('reset() 완전 초기화', () => {
    const d = new HeadShoulderSquatDetector();
    let t = runCalibration(d);
    for (let i = 0; i < 6; i++) { d.update(makeLandmarks(0.28, 0.32), t); t += 50; }
    for (let i = 0; i < 4; i++) { d.update(makeLandmarks(0.21, 0.32), t); t += 50; }
    expect(d.getCount()).toBe(1);
    d.reset();
    expect(d.getCount()).toBe(0);
    expect(d.isCalibrated()).toBe(false);
    expect(d.getPhase()).toBe('unknown');
  });

  it('첫 rep 완료 후 learnedAmp 기록', () => {
    const d = new HeadShoulderSquatDetector();
    let t = runCalibration(d);
    // 깊이 있는 rep: noseY 0.30 → d_min ≈ 0.02
    for (let i = 0; i < 10; i++) { d.update(makeLandmarks(0.30, 0.32), t); t += 50; }
    let last;
    for (let i = 0; i < 15; i++) { last = d.update(makeLandmarks(0.21, 0.32), t); t += 50; }
    expect(d.getCount()).toBe(1);
    expect(last?.learnedAmp).not.toBeNull();
    expect(last?.learnedAmp ?? 0).toBeGreaterThan(0.05);
  });

  it('injectBaseline — 외부 주입 d0 즉시 활성', () => {
    const d = new HeadShoulderSquatDetector();
    d.injectBaseline(0.12);
    expect(d.isCalibrated()).toBe(true);
    expect(d.getBaseline()).toBeCloseTo(0.12, 3);
  });
});
