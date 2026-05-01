/**
 * noseSquat.falsePositive.test.ts — FIX-FINAL-STAB (2026-05-01)
 *
 * 사용자 제보: "안 했는데 카운트 됐다."
 * 시나리오: 사용자가 의자에 앉아서 고개만 까딱이거나 화면에 들어왔다 나갔다 한다.
 * 기대: nose-only detector 가 0 카운트 유지.
 *
 * MIN_DEPTH = 0.06, BASELINE_LOCK_FRAMES = 15.
 */
import { describe, it, expect } from 'vitest';
import { NoseSquatDetector } from './noseSquat';

function lm(y: number, vis = 0.9) {
  return [{ x: 0.5, y, visibility: vis }];
}

describe('NoseSquatDetector — 거짓 양성 차단', () => {
  it('고개 끄덕임만 (진폭 0.04) — 카운트 0 유지', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    // baseline 락인을 위한 정적 1초.
    for (; t < 1000; t += 50) d.update(lm(0.20), t);
    expect(d.getPhase()).toBe('up');

    // 5초 동안 고개를 ±0.02 끄덕거림 (반복).
    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < 10; i++) {
        d.update(lm(0.22), t); t += 50;
      }
      for (let i = 0; i < 10; i++) {
        d.update(lm(0.18), t); t += 50;
      }
    }
    expect(d.getCount()).toBe(0);
  });

  it('낮은 visibility (0.4) — 카운트 0 유지', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.20, 0.4), t);
    for (; t < 1500; t += 50) d.update(lm(0.30, 0.4), t);
    for (; t < 2000; t += 50) d.update(lm(0.20, 0.4), t);
    expect(d.getCount()).toBe(0);
  });

  it('얕은 down (진폭 0.05 < MIN_DEPTH 0.06) — 카운트 0', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.20), t);
    // 깊이 0.05 — MIN_DEPTH(0.06) 미달.
    for (; t < 1500; t += 50) d.update(lm(0.25), t);
    for (; t < 2000; t += 50) d.update(lm(0.20), t);
    expect(d.getCount()).toBe(0);
  });

  it('실제 깊은 스쿼트 (진폭 0.10 ≥ MIN_DEPTH) — 정상 카운트 1', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    for (; t < 1000; t += 50) d.update(lm(0.20), t);
    // 깊이 0.10 — 충분.
    for (; t < 1700; t += 50) d.update(lm(0.30), t);
    for (; t < 2200; t += 50) d.update(lm(0.20), t);
    expect(d.getCount()).toBe(1);
  });

  it('입장 시 down 자세 — 첫 복귀가 가짜 카운트로 들어가지 않음 (arming)', () => {
    const d = new NoseSquatDetector();
    let t = 0;
    // 처음부터 down 자세 (앉아있음). baseline 형성.
    for (; t < 1000; t += 50) d.update(lm(0.30), t);
    // 일어남.
    for (; t < 1500; t += 50) d.update(lm(0.18), t);
    // 첫 입장이 down-zone 이었으므로 arming 이 일어나기 전 — 첫 복귀는 카운트 X.
    expect(d.getCount()).toBe(0);
  });
});
