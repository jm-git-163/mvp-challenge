import { describe, it, expect } from 'vitest';
import {
  computeRMS,
  rmsToDbFS,
  smoothDbFS,
  OnsetDetector,
  AudioAnalyser,
} from './audioAnalyser';

function sine(freq: number, seconds: number, sampleRate = 48000, amp = 0.5): Float32Array {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
  return out;
}

describe('pure functions', () => {
  it('computeRMS of silence is 0', () => {
    expect(computeRMS(new Float32Array(128))).toBe(0);
  });

  it('computeRMS of unit sine ≈ 1/√2 * amp', () => {
    const rms = computeRMS(sine(440, 0.1, 48000, 1.0));
    expect(rms).toBeCloseTo(1 / Math.SQRT2, 2);
  });

  it('rmsToDbFS of 1.0 is 0, of silence clamps to -100', () => {
    expect(rmsToDbFS(1.0)).toBeCloseTo(0, 5);
    expect(rmsToDbFS(0)).toBe(-100);
    expect(rmsToDbFS(0.1)).toBeCloseTo(-20, 2);
  });

  it('smoothDbFS: attack이 release보다 빠름 (상승 추종 ↑)', () => {
    let s = -60;
    for (let i = 0; i < 3; i++) s = smoothDbFS(-10, s, 0.3, 0.05);
    const afterAttack = s;

    let s2 = -10;
    for (let i = 0; i < 3; i++) s2 = smoothDbFS(-60, s2, 0.3, 0.05);
    const afterRelease = s2;

    // 같은 단계 수에도 attack이 더 많이 움직여야 함
    expect(afterAttack - -60).toBeGreaterThan(-10 - afterRelease);
  });
});

describe('OnsetDetector', () => {
  it('스펙트럼 급격히 상승 → 온셋 true', () => {
    const det = new OnsetDetector({ threshold: 1.2, refractoryMs: 0, window: 8 });
    // 8프레임 조용
    for (let i = 0; i < 8; i++) {
      det.push(new Float32Array(32).fill(0.01), i * 20);
    }
    // 플럭스 큰 프레임
    const spike = new Float32Array(32).fill(0.9);
    const got = det.push(spike, 200);
    expect(got).toBe(true);
  });

  it('refractory 기간 내 연속 온셋 억제', () => {
    const det = new OnsetDetector({ threshold: 1.1, refractoryMs: 500, window: 8 });
    const quiet = new Float32Array(8).fill(0.01);
    const loud = new Float32Array(8).fill(0.9);
    for (let i = 0; i < 8; i++) det.push(quiet, i * 10);
    expect(det.push(loud, 100)).toBe(true);
    // 짧은 간격 내 두 번째 스파이크 시도 (refractory 상태)
    det.push(quiet, 150);
    expect(det.push(loud, 200)).toBe(false);
    // 넉넉히 쉬고 다시 급증 → 허용
    for (let i = 0; i < 8; i++) det.push(quiet, 300 + i * 10);
    expect(det.push(loud, 700)).toBe(true);
  });

  it('warm-up 이전엔 온셋 false', () => {
    const det = new OnsetDetector();
    expect(det.push(new Float32Array(32).fill(0.9), 0)).toBe(false);
    expect(det.push(new Float32Array(32).fill(0.9), 20)).toBe(false);
  });

  it('Uint8Array 입력 수용 (정규화)', () => {
    const det = new OnsetDetector({ threshold: 1.2, refractoryMs: 0, window: 4 });
    for (let i = 0; i < 4; i++) det.push(new Uint8Array(8).fill(2), i * 10);
    const got = det.push(new Uint8Array(8).fill(230), 100);
    expect(got).toBe(true);
  });
});

describe('AudioAnalyser', () => {
  it('무음 프레임 → isLoud=false, level≈0', () => {
    const a = new AudioAnalyser({ loudThresholdDb: -20 });
    const f = a.push(new Float32Array(1024), null, 0);
    expect(f.isLoud).toBe(false);
    expect(f.level).toBeLessThan(0.1);
  });

  it('−6 dBFS 신호 ≥ 수 프레임 후 isLoud=true', () => {
    const a = new AudioAnalyser({ loudThresholdDb: -20 });
    let last = a.push(sine(440, 0.02, 48000, 0.5), null, 0);
    for (let i = 1; i < 15; i++) {
      last = a.push(sine(440, 0.02, 48000, 0.5), null, i * 20);
    }
    expect(last.isLoud).toBe(true);
    expect(last.level).toBeGreaterThan(0.6);
  });

  it('level은 0..1 범위로 clamp', () => {
    const a = new AudioAnalyser();
    const f = a.push(sine(440, 0.02, 48000, 1.5), null, 0); // 과구동
    expect(f.level).toBeLessThanOrEqual(1);
    expect(f.level).toBeGreaterThanOrEqual(0);
  });

  it('reset 후 prevSmoothed 복원', () => {
    const a = new AudioAnalyser();
    a.push(sine(440, 0.02, 48000, 1.0), null, 0);
    a.reset();
    const f = a.push(new Float32Array(1024), null, 0);
    expect(f.smoothedDbFS).toBeLessThan(-50);
  });
});
