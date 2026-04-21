/**
 * engine/composition/layers/beat_flash.ts
 *
 * Focused Session-5 Candidate V: **풀스크린 비트 플래시 레이어**.
 *
 *   state.beatIntensity (0~1) 또는 props.manualIntensity 에 따라 화면 전체를
 *   단색 덮개로 깜빡인다. 매 온셋마다 즉시 peak → 지정된 decay 를 타고 사라짐.
 *
 *   beatBridge 가 이미 decay 처리를 하므로, 이 레이어는 현재 beatIntensity 를
 *   그대로 alpha 로 변환한다. 추가 감쇠 곡선(exp / linear)은 선택.
 *
 *   props:
 *     - color : string              (default 'rgba(255,255,255,1)')
 *     - maxAlpha : number (0~1)     (default 0.6)
 *     - threshold : number (0~1)    (default 0.0) — 이 이하 intensity 는 무시 (보통 0.05)
 *     - curve : 'linear' | 'quad' | 'cubic'  (default 'quad') — alpha = intensity^n
 *     - mode : 'fill' | 'radial'    (default 'fill') — radial 은 가운데에서 퍼지는 진동
 *     - blend : GlobalCompositeOperation  (default 'screen')
 *
 *   activeKey(state): beatIntensity  또는 missionState.beatIntensity 모두 허용.
 */
import type { BaseLayer } from '../../templates/schema';

function readIntensity(state: any, props: any): number {
  if (typeof props?.manualIntensity === 'number') {
    return Math.max(0, Math.min(1, props.manualIntensity));
  }
  const a = state?.beatIntensity;
  if (typeof a === 'number') return Math.max(0, Math.min(1, a));
  const b = state?.missionState?.beatIntensity;
  if (typeof b === 'number') return Math.max(0, Math.min(1, b));
  return 0;
}

function applyCurve(x: number, curve: string): number {
  if (curve === 'cubic') return x * x * x;
  if (curve === 'linear') return x;
  return x * x; // quad (default)
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const threshold = Math.max(0, Math.min(1, (props.threshold as number) ?? 0));
  const intensity = readIntensity(state, props);
  if (intensity <= threshold) return;

  const { width: W, height: H } = ctx.canvas;
  const color = (props.color as string) || 'rgba(255,255,255,1)';
  const maxAlpha = Math.max(0, Math.min(1, (props.maxAlpha as number) ?? 0.6));
  const curve = (props.curve as string) || 'quad';
  const mode = (props.mode as string) || 'fill';
  const blend = (props.blend as GlobalCompositeOperation) || 'screen';

  const alpha = applyCurve(intensity, curve) * maxAlpha;
  if (alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = (layer.opacity ?? 1) * alpha;
  ctx.globalCompositeOperation = blend;

  if (mode === 'radial') {
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.sqrt(W * W + H * H) * 0.6;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = color;
  }

  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
