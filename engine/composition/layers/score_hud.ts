/**
 * engine/composition/layers/score_hud.ts
 *
 * Phase 5g — **점수 HUD 레이어**.
 *
 *   현재 누적 점수를 반투명 glass 박스 + 큰 숫자로 표시.
 *   점수 소스 우선순위:
 *     1) state.missionState.score
 *     2) state.score
 *     3) 0
 *
 *   props:
 *     - position : 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | {x,y}
 *     - label : string (default 'SCORE')
 *     - suffix : string (default '')
 *     - color : string (숫자 색, default '#FFFFFF')
 *     - border : string (glass 테두리 색, default 'rgba(255,255,255,0.22)')
 *     - glass : boolean (반투명 배경, default true)
 *     - bigNumber : boolean (더 큰 폰트, default false)
 */
import type { BaseLayer } from '../../templates/schema';

function resolveCorner(
  pos: any, W: number, H: number, margin: number, boxW: number, boxH: number,
): { x: number; y: number } {
  if (pos && typeof pos === 'object' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    return { x: pos.x, y: pos.y };
  }
  switch (pos) {
    case 'top-left':     return { x: margin, y: margin };
    case 'bottom-left':  return { x: margin, y: H - margin - boxH };
    case 'bottom-right': return { x: W - margin - boxW, y: H - margin - boxH };
    case 'top-right':
    default:             return { x: W - margin - boxW, y: margin };
  }
}

function readScore(state: any): number {
  if (!state) return 0;
  const ms = state.missionState;
  if (ms && Number.isFinite(ms.score)) return ms.score;
  if (Number.isFinite(state.score)) return state.score;
  return 0;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;

  const label = (props.label as string) ?? 'SCORE';
  const suffix = (props.suffix as string) ?? '';
  const color = (props.color as string) || '#FFFFFF';
  const border = (props.border as string) || 'rgba(255,255,255,0.22)';
  const glass = (props.glass as boolean) ?? true;
  const bigNumber = (props.bigNumber as boolean) ?? false;

  const score = readScore(state);
  const numText = `${Math.round(score)}${suffix}`;
  const numFontSize = bigNumber ? 64 : 48;
  const labelFontSize = 16;

  const boxW = bigNumber ? 200 : 160;
  const boxH = bigNumber ? 100 : 80;
  const margin = 36;
  const { x, y } = resolveCorner(props.position, W, H, margin, boxW, boxH);

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  if (glass) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxW, boxH);
  }

  // label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `600 ${labelFontSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 14, y + 12);

  // number
  ctx.fillStyle = color;
  ctx.font = `700 ${numFontSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(numText, x + 14, y + boxH - 14);

  ctx.restore();
}
