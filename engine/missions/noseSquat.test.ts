/**
 * noseSquat.test.ts — FIX-Z25 (2026-04-22)
 *
 * nose-based squat detector 단위 테스트.
 *  - baseline 산정 (최근 2초 평균)
 *  - down → up 전환 시 count++
 *  - 600ms 디바운스
 *  - nose.visibility ≤ 0.5 이면 무시
 */
import { describe, it, expect } from 'vitest';
import { NoseSquatDetector } from './noseSquat';

function lm(y: number, vis = 0.9) {
  // landmark array: index 0 = nose. 나머지는 빈 객체로 채움 (최소 1개면 됨).
  return [{ x: 0.5, y, visibility: vis }];
}

describe('NoseSquatDetector', () => {
  it('초기 상태: count=0 phase=unknown', () => {
    const d = new NoseSquatDetector();
    expect(d.getCount()).toBe(0);
    expect(d.getPhase()).toBe('unknown');
  });

  it('visibility 0.5 이하면 update 해도 카운트 없음', () => {
    const d = new NoseSquatDetector();
    for (let t = 0; t < 3000; t += 50) {
      d.update(lm(0.15, 0.3), t);
    }
    expect(d.getCount()).toBe(0);
  });

  it('baseline 설정 후 down→up 전환 시 count++', () => {
    const d = new NoseSquatDetector();
    // 0~1000ms: 서있는 자세 (y=0.15) — baseline 형성
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.15), t);
    expect(d.getCount()).toBe(0);
    expect(d.getPhase()).toBe('up');

    // 1000~1400ms: 앉는 동작 (y=0.30, baseline+0.15) — down 진입
    for (; t < 1400; t += 50) d.update(lm(0.30), t);
    expect(d.getPhase()).toBe('down');
    expect(d.getCount()).toBe(0);

    // 1400~1800ms: 복귀 (y=0.16) — up 전환 + count=1
    for (; t < 1800; t += 50) d.update(lm(0.16), t);
    expect(d.getPhase()).toBe('up');
    expect(d.getCount()).toBe(1);
  });

  it('600ms 디바운스 — 너무 빠른 연속 rep 은 1회만 카운트', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.15), t);
    // 첫 rep: down → up
    for (; t < 1200; t += 50) d.update(lm(0.30), t);
    for (; t < 1300; t += 50) d.update(lm(0.16), t);
    const first = d.getCount();
    expect(first).toBe(1);

    // 바로(200ms 뒤) 두 번째 down → up 시도 — 디바운스로 무시
    for (; t < 1400; t += 50) d.update(lm(0.30), t);
    for (; t < 1500; t += 50) d.update(lm(0.16), t);
    // 첫 카운트 시각 ~1250, 두 번째 up 복귀 ~1450 → 200ms < 600ms
    expect(d.getCount()).toBe(1);

    // 600ms 이후엔 카운트됨
    for (; t < 2000; t += 50) d.update(lm(0.30), t);
    for (; t < 2200; t += 50) d.update(lm(0.16), t);
    expect(d.getCount()).toBeGreaterThanOrEqual(2);
  });

  it('justCounted 플래그는 해당 프레임에만 true', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.15), t);
    for (; t < 1400; t += 50) d.update(lm(0.30), t);
    // 복귀 첫 프레임에 justCounted=true
    const r1 = d.update(lm(0.16), t); t += 50;
    expect(r1.justCounted).toBe(true);
    // 다음 프레임엔 false
    const r2 = d.update(lm(0.16), t);
    expect(r2.justCounted).toBe(false);
  });

  it('reset() 으로 완전 초기화', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.15), t);
    for (; t < 1400; t += 50) d.update(lm(0.30), t);
    for (; t < 1600; t += 50) d.update(lm(0.16), t);
    expect(d.getCount()).toBeGreaterThan(0);

    d.reset();
    expect(d.getCount()).toBe(0);
    expect(d.getPhase()).toBe('unknown');
  });

  it('msSinceLastChange — phase 변화 추적', () => {
    const d = new NoseSquatDetector();
    expect(d.msSinceLastChange(1000)).toBe(Infinity);
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.15), t);
    // phase 가 up 으로 전환된 시점 이후 경과
    const delta = d.msSinceLastChange(t);
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThan(1000);
  });
});
