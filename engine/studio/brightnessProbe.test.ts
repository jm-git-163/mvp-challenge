import { describe, it, expect } from 'vitest';
import { averageBrightness, isTooDark, averageLuma } from './brightnessProbe';

function mkImage(w: number, h: number, fill: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

describe('averageBrightness', () => {
  it('검정 프레임 → 0', () => {
    expect(averageBrightness(mkImage(32, 32, [0, 0, 0]), 1)).toBe(0);
  });

  it('흰색 프레임 → 1', () => {
    expect(averageBrightness(mkImage(32, 32, [255, 255, 255]), 1)).toBeCloseTo(1, 5);
  });

  it('녹색이 가장 밝게 가중됨 (Rec.709)', () => {
    const green = averageBrightness(mkImage(16, 16, [0, 255, 0]), 1);
    const red = averageBrightness(mkImage(16, 16, [255, 0, 0]), 1);
    const blue = averageBrightness(mkImage(16, 16, [0, 0, 255]), 1);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });

  it('빈 이미지 → 0', () => {
    expect(averageBrightness(mkImage(0, 0, [255, 255, 255]), 1)).toBe(0);
  });

  it('서브샘플링 결과도 균일한 이미지에선 동일', () => {
    const img = mkImage(64, 64, [128, 128, 128]);
    expect(averageBrightness(img, 1)).toBeCloseTo(averageBrightness(img, 8), 5);
  });
});

describe('averageLuma', () => {
  it('samples 개수 반환', () => {
    const r = averageLuma(mkImage(16, 16, [128, 128, 128]), 8);
    expect(r.samples).toBe(4); // ceil(16/8) * ceil(16/8)
    expect(r.brightness).toBeGreaterThan(0);
  });
});

describe('isTooDark', () => {
  it('임계값 미만 → true', () => {
    expect(isTooDark(0.1, 0.18)).toBe(true);
  });
  it('임계값 이상 → false', () => {
    expect(isTooDark(0.18, 0.18)).toBe(false);
    expect(isTooDark(0.5, 0.18)).toBe(false);
  });
});
