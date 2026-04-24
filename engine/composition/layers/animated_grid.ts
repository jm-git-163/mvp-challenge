/**
 * engine/composition/layers/animated_grid.ts
 */
import { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any
): void {
  const { width, height } = ctx.canvas;
  const props = layer.props || {};
  const color = (props.color as string) || '#fff';
  const perspective = props.perspective !== false;
  const scrollPerBarPx = (props.scrollPerBarPx as number) || 64;
  
  // Simple time-based scroll
  const scrollY = (timeMs / 2000) * scrollPerBarPx % scrollPerBarPx;
  
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  
  if (perspective) {
    const horizon = height * 0.4;
    const gridSize = 60;
    const numLines = Math.ceil(width / gridSize) + 2;
    
    // Vertical lines (perspective)
    for (let i = -numLines; i <= numLines; i++) {
      const x = width / 2 + i * gridSize;
      ctx.beginPath();
      ctx.moveTo(width / 2, horizon);
      ctx.lineTo(x * 5 - (width * 2), height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= height - horizon; y += gridSize) {
      const currentY = horizon + ((y + scrollY) % (height - horizon));
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(width, currentY);
      ctx.stroke();
    }
  } else {
    // 2D Flat grid
    const size = 50;
    for (let x = 0; x <= width; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += size) {
      const cy = (y + scrollY) % height;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(width, cy); ctx.stroke();
    }
  }
  
  ctx.restore();
}
