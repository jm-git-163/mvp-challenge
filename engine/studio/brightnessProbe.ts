/**
 * engine/studio/brightnessProbe.ts
 *
 * Phase 6 — 카메라 프레임 평균 밝기 측정.
 * docs/EDGE_CASES.md §3: "캔버스 평균 밝기 임계값 이하 감지 시 더 밝은 곳".
 *
 * ImageData 를 받아 Rec.709 luminance 계산. 서브샘플링으로 연산 경량화.
 */

/**
 * ImageData 의 평균 밝기(0~1) 계산.
 * Rec.709: Y = 0.2126 R + 0.7152 G + 0.0722 B, [0,255] → [0,1] 정규화.
 * @param step 픽셀 샘플링 간격 (기본 8 = 1/8 다운샘플, 연산 1/64로 경감).
 */
export function averageBrightness(img: ImageData, step = 8): number {
  const { data, width, height } = img;
  if (width === 0 || height === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count++;
    }
  }
  if (count === 0) return 0;
  return (sum / count) / 255;
}

/** 평균 RGB 합산값도 필요하면 반환. */
export function averageLuma(img: ImageData, step = 8): { brightness: number; samples: number } {
  const b = averageBrightness(img, step);
  const count = Math.ceil(img.width / step) * Math.ceil(img.height / step);
  return { brightness: b, samples: count };
}

/** 임계값 미만이면 true. */
export function isTooDark(brightness: number, threshold = 0.18): boolean {
  return brightness < threshold;
}
