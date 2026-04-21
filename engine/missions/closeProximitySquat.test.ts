/**
 * engine/missions/closeProximitySquat.test.ts
 * FIX-J: 얼굴 Y 진동 기반 근접 스쿼트 카운터 테스트.
 */
import { describe, it, expect } from 'vitest';
import { CloseProximitySquatDetector } from './closeProximitySquat';

function makeLms(faceY: number, vis = 0.9) {
  const lms: any[] = [];
  for (let i = 0; i < 33; i++) {
    // 얼굴 인덱스(0~8)는 faceY, 나머지는 화면 밖(visibility 낮음)
    if (i <= 8) lms.push({ x: 0.5, y: faceY, z: 0, visibility: vis });
    else        lms.push({ x: 0.5, y: 1.2, z: 0, visibility: 0.05 });
  }
  return lms;
}

describe('CloseProximitySquatDetector', () => {
  it('얼굴 안 잡히면 active=false', () => {
    const d = new CloseProximitySquatDetector();
    const s = d.update(makeLms(0.3, 0.05));
    expect(s.active).toBe(false);
    expect(s.count).toBe(0);
  });

  it('얼굴 Y 진동 없으면 count=0', () => {
    const d = new CloseProximitySquatDetector();
    for (let i = 0; i < 30; i++) d.update(makeLms(0.3));
    expect(d.getCount()).toBe(0);
  });

  it('얼굴 Y 진폭 충분히 크면 rep 카운트', () => {
    const d = new CloseProximitySquatDetector();
    // 히스토리 채움 (up 상태)
    for (let i = 0; i < 12; i++) d.update(makeLms(0.30));
    // 내려감 (down)
    for (let i = 0; i < 6; i++) d.update(makeLms(0.50));
    // 다시 올라감 (up) → rep 완성
    for (let i = 0; i < 6; i++) d.update(makeLms(0.30));
    expect(d.getCount()).toBe(1);
  });

  it('연속 반복으로 다중 카운트', () => {
    const d = new CloseProximitySquatDetector();
    for (let i = 0; i < 12; i++) d.update(makeLms(0.30));
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 8; i++) d.update(makeLms(0.55));  // down
      for (let i = 0; i < 8; i++) d.update(makeLms(0.28));  // up
    }
    expect(d.getCount()).toBeGreaterThanOrEqual(2);
  });

  it('진폭 너무 작으면(노이즈) 카운트 안됨', () => {
    const d = new CloseProximitySquatDetector();
    for (let i = 0; i < 12; i++) d.update(makeLms(0.30));
    // 아주 작은 흔들림
    for (let r = 0; r < 5; r++) {
      for (let i = 0; i < 6; i++) d.update(makeLms(0.305));
      for (let i = 0; i < 6; i++) d.update(makeLms(0.298));
    }
    expect(d.getCount()).toBe(0);
  });

  it('reset() — 카운트·히스토리 초기화', () => {
    const d = new CloseProximitySquatDetector();
    for (let i = 0; i < 12; i++) d.update(makeLms(0.30));
    for (let i = 0; i < 6; i++) d.update(makeLms(0.55));
    for (let i = 0; i < 6; i++) d.update(makeLms(0.28));
    expect(d.getCount()).toBeGreaterThan(0);
    d.reset();
    expect(d.getCount()).toBe(0);
    expect(d.getPhase()).toBe('unknown');
  });
});
