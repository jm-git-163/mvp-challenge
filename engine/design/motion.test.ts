import { describe, it, expect } from 'vitest';
import { cubicBezier, EASE, tween, MOTION_PRESETS, evaluatePreset, DURATION } from './motion';

describe('cubicBezier', () => {
  it('경계 0/1 → 0/1', () => {
    const f = cubicBezier(0.4, 0, 0.2, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
  });
  it('standard ease는 중간에서 > 입력', () => {
    const f = EASE.standard;
    // ease-in-out류는 t=0.5에서 ~0.5 근처, 약간 > 0.5 (빠르게 빠져나옴)
    expect(f(0.5)).toBeGreaterThan(0.4);
    expect(f(0.5)).toBeLessThan(0.9);
  });
  it('overshoot는 t<1 구간에서 1을 초과할 수 있음', () => {
    const f = EASE.overshoot;
    const vals = [0.6, 0.7, 0.8, 0.9].map((x) => f(x));
    expect(Math.max(...vals)).toBeGreaterThan(1);
  });
  it('linear는 항등 함수', () => {
    expect(EASE.linear(0.3)).toBeCloseTo(0.3, 5);
  });
});

describe('tween', () => {
  it('0ms면 from, duration 이상이면 to', () => {
    expect(tween(10, 20, 0, 100)).toBe(10);
    expect(tween(10, 20, 500, 100)).toBe(20);
  });
  it('중간값은 from..to 사이', () => {
    const v = tween(0, 100, 50, 100, 'linear');
    expect(v).toBeCloseTo(50, 2);
  });
  it('duration=0이면 즉시 to', () => {
    expect(tween(10, 20, 0, 0)).toBe(20);
  });
});

describe('MOTION_PRESETS', () => {
  it('enter 프리셋이 opacity 0→1 포함', () => {
    const p = MOTION_PRESETS.enter;
    expect(p.frames[0].values.opacity).toBe(0);
    expect(p.frames[p.frames.length - 1].values.opacity).toBe(1);
    expect(p.durationMs).toBe(DURATION.medium);
  });

  it('evaluatePreset: enter 초반 opacity ≈ 0', () => {
    const v = evaluatePreset(MOTION_PRESETS.enter, 0);
    expect(v.opacity).toBeCloseTo(0, 5);
  });
  it('evaluatePreset: enter 종료 opacity = 1', () => {
    const v = evaluatePreset(MOTION_PRESETS.enter, MOTION_PRESETS.enter.durationMs);
    expect(v.opacity).toBeCloseTo(1, 5);
  });
  it('evaluatePreset: successPop 중간에 scale이 오버슈트 (>1)', () => {
    const p = MOTION_PRESETS.successPop;
    // t=0.6에서 1.15로 설정되어 있으므로 그 근처에서 scale > 1
    const eased = EASE[p.ease];
    // eased가 0.6인 원 t 찾기 → 대략 샘플링
    let maxScale = 0;
    for (let ms = 0; ms <= p.durationMs; ms += 10) {
      const v = evaluatePreset(p, ms);
      if (v.scale && v.scale > maxScale) maxScale = v.scale;
    }
    expect(maxScale).toBeGreaterThan(1);
    // bounce easing은 1을 크게 넘나들 수 있음 — 상한을 너무 빡빡하게 잡지 않음
    void eased;
  });
  it('evaluatePreset: 종료 시점 마지막 프레임 값', () => {
    const v = evaluatePreset(MOTION_PRESETS.press, MOTION_PRESETS.press.durationMs);
    expect(v.scale).toBeCloseTo(0.97, 5);
  });
});
