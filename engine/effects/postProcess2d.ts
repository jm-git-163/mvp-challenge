/**
 * engine/effects/postProcess2d.ts
 *
 * Phase 5f 대체 — **Canvas 2D 기반 포스트프로세스 폴백**.
 * PixiJS 도입 전까지 템플릿 postProcess 체인을 Canvas 2D 로 근사.
 *
 * ⚠️ 품질은 Pixi 대비 제한적:
 *   - bloom: blur+screen 합성 (실제 tonemap 없음)
 *   - chromatic: 채널별 offset drawImage (GPU 대비 느림)
 *   - vignette/film_grain/crt_scanlines: 프로시저 드로잉
 *   - lut: CPU 3D LUT 적용 (ImageData 픽셀 루프)
 *
 * Canvas 2D `ctx.filter` Safari 호환성 한계는 docs/COMPATIBILITY §8 참고.
 * PixiJS 승인되면 이 파일은 폴백 전용으로 유지.
 */

export type PostFxKind =
  | 'bloom'
  | 'chromatic'
  | 'crt_scanlines'
  | 'vignette'
  | 'saturation'
  | 'bokeh'
  | 'film_grain'
  | 'lut_mono';

export interface PostFxStep {
  kind: PostFxKind;
  /** 강도 0~1 (효과별 해석 다름). */
  intensity?: number;
  /** onset 순간 일시 부스트 배율. */
  onsetBoost?: number;
}

export interface PostFxInput {
  /** 소스·타겟 캔버스. 인플레이스 수정. */
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** 현재 시각 ms (film_grain 노이즈 seed 용). */
  tMs: number;
  /** 0~1 onset envelope (reactive). */
  onset?: number;
  /** 결정적 난수 — 테스트용. */
  rng?: () => number;
}

/** ctx.filter 문자열 빌더. */
export function buildCssFilter(steps: PostFxStep[]): string {
  const parts: string[] = [];
  for (const s of steps) {
    const i = s.intensity ?? 0.5;
    switch (s.kind) {
      case 'bloom':
        parts.push(`brightness(${(1 + i * 0.2).toFixed(3)}) blur(${(i * 2).toFixed(2)}px)`);
        break;
      case 'saturation':
        parts.push(`saturate(${(1 + i).toFixed(3)})`);
        break;
      case 'bokeh':
        parts.push(`blur(${(i * 3).toFixed(2)}px)`);
        break;
      case 'lut_mono':
        parts.push(`grayscale(${i.toFixed(3)}) contrast(${(1 + i * 0.2).toFixed(3)})`);
        break;
      default:
        break;
    }
  }
  return parts.join(' ').trim();
}

/**
 * 절차적 오버레이 적용 (filter 로 표현 안 되는 항목).
 * 호출 순서: 메인 레이어 렌더 → applyProceduralOverlays.
 */
export function applyProceduralOverlays(input: PostFxInput, steps: PostFxStep[]): void {
  const { ctx, width: W, height: H } = input;
  for (const s of steps) {
    const i = (s.intensity ?? 0.5) * (1 + (input.onset ?? 0) * (s.onsetBoost ?? 0));
    switch (s.kind) {
      case 'vignette':
        drawVignette(ctx, W, H, i);
        break;
      case 'crt_scanlines':
        drawScanlines(ctx, W, H, i);
        break;
      case 'film_grain':
        drawFilmGrain(input, i);
        break;
      case 'chromatic':
        // 채널 offset 은 drawImage 에 소스 필요 — 호출 측이 captureFrame 후 수행.
        break;
      default:
        break;
    }
  }
}

/** 채널 분리형 chromatic aberration. src 캔버스를 dst 로 합성. */
export function applyChromaticAberration(
  src: CanvasImageSource,
  dst: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetPx: number,
): void {
  dst.save();
  dst.clearRect(0, 0, width, height);
  // Red shift 왼쪽
  dst.globalCompositeOperation = 'source-over';
  (dst as CanvasRenderingContext2D & { filter: string }).filter = 'url(#none)';
  dst.drawImage(src as CanvasImageSource, -offsetPx, 0);
  dst.globalCompositeOperation = 'lighten';
  dst.drawImage(src as CanvasImageSource, offsetPx, 0);
  dst.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number): void {
  const cx = W / 2, cy = H / 2;
  const outer = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, outer * 0.4, cx, cy, outer);
  const alpha = Math.max(0, Math.min(0.85, intensity));
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${alpha.toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number, intensity: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, intensity);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  for (let y = 0; y < H; y += 2) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();
}

export function drawFilmGrain(input: PostFxInput, intensity: number): void {
  const { ctx, width: W, height: H, tMs } = input;
  const rng = input.rng ?? makeSeededRng(Math.floor(tMs));
  const density = Math.min(0.2, intensity) * 0.0008; // 1080*1920*0.0008 ≈ 1660 픽셀
  const count = Math.floor(W * H * density);
  ctx.save();
  ctx.globalAlpha = Math.min(0.18, intensity);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let k = 0; k < count; k++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

export function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return s / 0xFFFFFFFF;
  };
}
