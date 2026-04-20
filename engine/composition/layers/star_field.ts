/**
 * engine/composition/layers/star_field.ts
 */
import { BaseLayer } from '../../templates/schema';

// Simple seeded random helper
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any
): void {
  const { width, height } = ctx.canvas;
  const props = layer.props || {};
  const count = (props.count as number) || 100;
  const driftPxPerSec = (props.driftPxPerSec as number) || 10;
  
  const drift = (timeMs / 1000) * driftPxPerSec;
  
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.fillStyle = '#fff';
  
  for (let i = 0; i < count; i++) {
    // Deterministic positions based on index
    const x = (seededRandom(i * 123.456) * width);
    let y = (seededRandom(i * 789.012) * height + drift) % height;
    
    const size = seededRandom(i * 456.789) * 3;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}
