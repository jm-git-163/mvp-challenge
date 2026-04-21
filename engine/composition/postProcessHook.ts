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
        // 아래 항목은 세션 3+ PixiJS 또는 offscreen 소스 도입 시 구현.
        case 'chromatic':
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
