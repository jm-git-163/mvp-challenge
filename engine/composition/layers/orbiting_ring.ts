/**
 * engine/composition/layers/orbiting_ring.ts
 *
 * Phase 5c — **공전 링 레이어**.
 *
 *   캔버스 중앙에 투명한 원 + 그 위에서 돌고 있는 작은 점(위성).
 *   네온 아레나의 카메라 주위를 도는 에너지 고리 느낌.
 *
 *   props:
 *     - radiusPx : number     (default 460)
 *     - widthPx : number      (default 2)
 *     - periodSec : number    (default 8, 위성 공전 주기)
 *     - color : string        (default '#00E0FF')
 *     - satelliteCount : number (default 1)
 *     - centerX, centerY : number (default 캔버스 중앙)
 */
import type { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  _state: any,
): void {
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;
  const cx = (props.centerX as number) ?? W / 2;
  const cy = (props.centerY as number) ?? H / 2;
  const radius = Math.max(10, (props.radiusPx as number) ?? 460);
  const width = Math.max(1, (props.widthPx as number) ?? 2);
  const period = Math.max(0.5, (props.periodSec as number) ?? 8);
  const color = (props.color as string) || '#00E0FF';
  const satellites = Math.max(0, Math.min(12, (props.satelliteCount as number) ?? 1));

  const t = timeMs / 1000;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  // 링 자체 (반투명)
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = (layer.opacity ?? 1) * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 위성 점 + 글로우
  ctx.globalAlpha = layer.opacity ?? 1;
  for (let i = 0; i < satellites; i++) {
    const phase = (i / satellites) * Math.PI * 2;
    const ang = (t * Math.PI * 2) / period + phase;
    const sx = cx + Math.cos(ang) * radius;
    const sy = cy + Math.sin(ang) * radius;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(sx, sy, width * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
