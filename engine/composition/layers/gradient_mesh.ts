/**
 * engine/composition/layers/gradient_mesh.ts
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
  const colors = (props.colors as string[]) || ['#000', '#333'];
  const rotatePeriodSec = (props.rotatePeriodSec as number) || 60;
  
  const rotation = (timeMs / 1000 / rotatePeriodSec) * Math.PI * 2;
  
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  
  // Use multiple radial gradients for a mesh effect
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, width, height);
  
  colors.slice(1).forEach((color, i) => {
    const angle = rotation + (i * Math.PI * 2) / (colors.length - 1);
    const x = width / 2 + Math.cos(angle) * (width / 3);
    const y = height / 2 + Math.sin(angle) * (height / 3);
    
    const grad = ctx.createRadialGradient(x, y, 0, x, y, width);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = grad;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, width, height);
  });
  
  ctx.restore();
}
