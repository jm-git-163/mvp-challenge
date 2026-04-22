/**
 * engine/composition/layers/floating_shapes.ts
 *
 * Phase 5c — **부유 3D 도형 레이어** (2D projection 간이 렌더).
 *
 *   props.shapes 에 지정된 도형들이 천천히 회전·이동하며 배경에 떠있음.
 *   각 도형은 sin/cos 기반 부유 패턴 (결정론적, 모듈 상태 없음).
 *
 *   props.orbit 이 있으면 모든 요소는 하나의 이모지로 궤도를 돈다(emoji-explosion 용):
 *     { emoji: string, orbit: { radiusPx, periodSec, phaseDeg } }
 *
 *   shapes 각 요소: 'cube' | 'pyramid' | 'sphere' | 'cloud' | 'star' | 'heart'
 */
import type { BaseLayer } from '../../templates/schema';

function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  // 정면 사각형 + 대각선 깊이 (axonometric)
  const d = s * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  // 상단 면
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y - s / 2);
  ctx.lineTo(x - s / 2 + d, y - s / 2 - d);
  ctx.lineTo(x + s / 2 + d, y - s / 2 - d);
  ctx.lineTo(x + s / 2, y - s / 2);
  ctx.closePath();
  ctx.globalAlpha *= 0.75;
  ctx.fill();
  ctx.globalAlpha /= 0.75;
  // 측면
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y - s / 2);
  ctx.lineTo(x + s / 2 + d, y - s / 2 - d);
  ctx.lineTo(x + s / 2 + d, y + s / 2 - d);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.closePath();
  ctx.globalAlpha *= 0.55;
  ctx.fill();
  ctx.globalAlpha /= 0.55;
}

function drawPyramid(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s / 2);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.lineTo(x - s / 2, y + s / 2);
  ctx.closePath();
  ctx.fill();
  // 어두운 우측 면
  ctx.beginPath();
  ctx.moveTo(x, y - s / 2);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.lineTo(x + s * 0.25, y + s / 2);
  ctx.closePath();
  ctx.globalAlpha *= 0.55;
  ctx.fill();
  ctx.globalAlpha /= 0.55;
}

function drawSphere(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const r = s / 2;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - s * 0.3, y, s * 0.35, 0, Math.PI * 2);
  ctx.arc(x, y - s * 0.15, s * 0.45, 0, Math.PI * 2);
  ctx.arc(x + s * 0.3, y, s * 0.35, 0, Math.PI * 2);
  ctx.arc(x + s * 0.1, y + s * 0.1, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? s / 2 : s / 4;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  const k = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + k * 0.35);
  ctx.bezierCurveTo(x + k, y - k * 0.5, x + k * 1.4, y + k * 0.2, x, y + k);
  ctx.bezierCurveTo(x - k * 1.4, y + k * 0.2, x - k, y - k * 0.5, x, y + k * 0.35);
  ctx.fill();
}

type ShapeKind = 'cube' | 'pyramid' | 'sphere' | 'cloud' | 'star' | 'heart';

function drawShape(ctx: CanvasRenderingContext2D, kind: ShapeKind, x: number, y: number, s: number, color: string): void {
  switch (kind) {
    case 'cube':    return drawCube(ctx, x, y, s, color);
    case 'pyramid': return drawPyramid(ctx, x, y, s, color);
    case 'sphere':  return drawSphere(ctx, x, y, s, color);
    case 'cloud':   return drawCloud(ctx, x, y, s, color);
    case 'star':    return drawStar(ctx, x, y, s, color);
    case 'heart':   return drawHeart(ctx, x, y, s, color);
  }
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  _state: any,
): void {
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;
  const t = timeMs / 1000;

  // ── 궤도 이모지 모드 (emoji-explosion) ───────────────────
  if (props.orbit && typeof props.emoji === 'string') {
    const orbit = props.orbit as { radiusPx?: number; periodSec?: number; phaseDeg?: number };
    const r = (orbit.radiusPx as number) ?? 260;
    const period = (orbit.periodSec as number) ?? 6;
    const phase = ((orbit.phaseDeg as number) ?? 0) * Math.PI / 180;
    const angle = (t * Math.PI * 2) / Math.max(0.01, period) + phase;
    const cx = W / 2 + Math.cos(angle) * r;
    const cy = H / 2 + Math.sin(angle) * r * 0.7; // y 궤도 압축
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.fillText(String(props.emoji), cx, cy); } catch { /* 일부 환경에서 이모지 미지원 */ }
    ctx.restore();
    return;
  }

  // ── 일반 부유 도형 모드 ───────────────────────────────────
  const shapes: ShapeKind[] = Array.isArray(props.shapes)
    ? (props.shapes.filter((s: any) => typeof s === 'string') as ShapeKind[])
    : ['cube', 'pyramid', 'sphere'];
  const palette: string[] = Array.isArray(props.colors) && props.colors.length > 0
    ? props.colors
    : ['#FF2D95', '#00E0FF', '#39FF7D', '#FFD700', '#B5E3D8'];

  ctx.save();
  const baseOpacity = layer.opacity ?? 1;

  shapes.forEach((kind, i) => {
    const seedX = ((i * 9301 + 49297) % 233280) / 233280;
    const seedY = ((i * 73973 + 1013) % 139968) / 139968;
    const seedSize = ((i * 7919) % 100) / 100;
    const phase = i * 0.9;

    const baseX = W * 0.1 + seedX * W * 0.8;
    const baseY = H * 0.15 + seedY * H * 0.7;
    const x = baseX + Math.sin(t * 0.5 + phase) * 40;
    const y = baseY + Math.cos(t * 0.4 + phase) * 50;
    const size = 60 + seedSize * 80;
    const color = palette[i % palette.length];

    ctx.globalAlpha = baseOpacity * (0.6 + 0.4 * Math.sin(t * 0.6 + phase));
    drawShape(ctx, kind, x, y, size, color);
  });

  ctx.restore();
}
