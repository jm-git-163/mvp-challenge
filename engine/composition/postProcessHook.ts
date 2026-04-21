/**
 * engine/composition/postProcessHook.ts
 *
 * Focused Session-2 Candidate F: **Template postProcess → Canvas 2D 폴백 체인 훅**.
 *
 * renderLayeredFrame 마지막에서 호출. 템플릿의 `postProcess` 단계를 순회하며
 * Canvas 2D 기반 `engine/effects/postProcess2d.ts` 헬퍼로 근사 적용한다.
 *
 * 이번 세션 범위(최소): **bloom + vignette + film_grain**.
 *   - chromatic / crt_scanlines / lut / bokeh / pixelate / saturation 은 세션 3+에서
 *     PixiJS 파이프라인 도입 시 또는 offscreen 소스복사 포함 확장 예정.
 *
 * state 에서 읽는 리액티브 값:
 *   - state.beatIntensity (0~1) → onset envelope
 *
 * bloom 은 Canvas 2D 단일 ctx 에서 destination-over + filter:blur 로 근사.
 * 원본 픽셀을 살짝 블러/브라이트 한 버전을 "lighter" 합성으로 덧붙인다.
 */
import {
  drawVignette,
  drawFilmGrain,
  makeSeededRng,
  type PostFxInput,
} from '../effects/postProcess2d';

// ── Focused Session-3 Candidate J: chromatic aberration (offscreen 소스) ──

/**
 * 오프스크린 소스 캔버스 싱글톤.
 * 매 프레임 생성하면 GC 폭주 → 모듈 스코프 재사용.
 * 크기가 바뀌면(리사이즈/템플릿 전환) 자동 확장.
 */
let _offscreen: HTMLCanvasElement | null = null;
let _offscreenCtx: CanvasRenderingContext2D | null = null;

function ensureOffscreen(W: number, H: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_offscreen) {
    _offscreen = document.createElement('canvas');
    _offscreen.width = W;
    _offscreen.height = H;
    _offscreenCtx = _offscreen.getContext('2d');
  }
  if (_offscreen.width !== W || _offscreen.height !== H) {
    _offscreen.width = W;
    _offscreen.height = H;
    _offscreenCtx = _offscreen.getContext('2d');
  }
  return _offscreenCtx;
}

/**
 * 채널 분리형 chromatic aberration.
 *   1) 메인 ctx → offscreen copy
 *   2) 메인 ctx clear
 *   3) R 채널(소스 alpha + source-over) 을 -offset 로 그림
 *   4) G/B 채널을 +offset 로 lighter 합성
 *
 * 실제 RGB 채널 분리는 WebGL 필요 — Canvas 2D 는 "red-shift / blue-shift"
 * 이미지 2장 lighter 합성으로 근사.
 *
 * @returns true 성공, false 환경 미지원 (SSR/offscreen 못 만듦)
 */
export function applyChromaticAberration2d(
  ctx: CanvasRenderingContext2D,
  offsetPx: number,
): boolean {
  const { width: W, height: H } = ctx.canvas;
  const off = ensureOffscreen(W, H);
  if (!off) return false;
  if (offsetPx <= 0.01) return true; // no-op

  // 1) copy current frame to offscreen
  off.clearRect(0, 0, W, H);
  try {
    off.drawImage(ctx.canvas, 0, 0, W, H);
  } catch {
    return false;
  }

  // 2) clear main, draw shifted copies
  const dx = Math.max(-12, Math.min(12, offsetPx));
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  // Base: full copy back (no shift)
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(_offscreen as HTMLCanvasElement, 0, 0, W, H);
  // Red-shift (left)
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  (ctx as CanvasRenderingContext2D & { filter: string }).filter =
    'url(#none)'; // reset filter
  try {
    // tint: 왼쪽으로 shift + red overlay 효과는 composite 로만 근사 (순수 drawImage)
    ctx.drawImage(_offscreen as HTMLCanvasElement, -dx, 0, W, H);
    // Blue-shift (right)
    ctx.drawImage(_offscreen as HTMLCanvasElement, dx, 0, W, H);
  } catch {
    /* ignore */
  }
  ctx.restore();
  return true;
}

/** 테스트 전용: 싱글톤 초기화. */
export function _resetChromaticOffscreen(): void {
  _offscreen = null;
  _offscreenCtx = null;
}

type AnyPostFx = { kind: string; [k: string]: unknown };

/**
 * bloom 근사: 현재 ctx 를 소스로 블러 버전을 'lighter' 합성.
 * intensity 는 템플릿 값(0~2+ 가능). 과도하면 알파로 제한.
 */
function applyBloom2d(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  intensity: number,
): void {
  if (intensity <= 0) return;
  const a = Math.min(0.6, intensity * 0.35);
  const blurPx = Math.max(2, Math.min(16, intensity * 6));
  ctx.save();
  (ctx as CanvasRenderingContext2D & { filter: string }).filter = `blur(${blurPx.toFixed(2)}px) brightness(1.2)`;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  // self-draw: 일부 브라우저는 같은 canvas drawImage 지원
  try {
    ctx.drawImage(ctx.canvas, 0, 0, W, H);
  } catch {
    /* 미지원 환경 폴백 — 효과 스킵 */
  }
  ctx.restore();
}

export interface PostProcessState {
  beatIntensity?: number;
  [k: string]: unknown;
}

/**
 * 템플릿 postProcess 체인 적용.
 * @param ctx 메인 캔버스 ctx
 * @param steps 템플릿 postProcess 배열 (zPostFx 유니온)
 * @param tMs  현재 시각 ms (film_grain seed)
 * @param state 리액티브 상태
 */
export function applyTemplatePostProcess(
  ctx: CanvasRenderingContext2D,
  steps: ReadonlyArray<AnyPostFx> | undefined,
  tMs: number,
  state: PostProcessState,
): void {
  if (!steps || steps.length === 0) return;

  const { width: W, height: H } = ctx.canvas;
  const onset = Math.max(0, Math.min(1, state?.beatIntensity ?? 0));
  const input: PostFxInput = {
    ctx,
    width: W,
    height: H,
    tMs,
    onset,
    rng: makeSeededRng(Math.floor(tMs)),
  };

  for (const step of steps) {
    try {
      switch (step.kind) {
        case 'bloom': {
          const base = Number(step.intensity ?? 0.5);
          // onset 부스트 +40%
          applyBloom2d(ctx, W, H, base * (1 + onset * 0.4));
          break;
        }
        case 'vignette': {
          const base = Number(step.intensity ?? 0.5);
          drawVignette(ctx, W, H, base);
          break;
        }
        case 'film_grain': {
          const base = Number(step.opacity ?? 0.15);
          drawFilmGrain(input, base);
          break;
        }
        case 'chromatic': {
          // Focused Session-3 Candidate J: offscreen 소스복사 기반 2D 근사.
          // zod 스키마 필드: baseOffsetPx + onOnsetPx (optional).
          const base = Number(step.baseOffsetPx ?? step.offsetPx ?? 2);
          const boost = Number(step.onOnsetPx ?? 0);
          const px = base + boost * onset;
          applyChromaticAberration2d(ctx, px);
          break;
        }
        // 아래 항목은 세션 4+ PixiJS 전환 시 구현.
        case 'crt_scanlines':
        case 'lut':
        case 'bokeh':
        case 'pixelate':
        case 'saturation':
        default:
          break;
      }
    } catch (e) {
      console.warn(`[PostProcess] ${step.kind} failed:`, e);
    }
  }
}
