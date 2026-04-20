/**
 * engine/composition/layers/noise_pattern.ts
 */
import { BaseLayer } from '../../templates/schema';

let noiseCanvas: HTMLCanvasElement | null = null;

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any
): void {
  const { width, height } = ctx.canvas;
  
  // Pre-render a noise tile for performance
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 256;
    noiseCanvas.height = 256;
    const nctx = noiseCanvas.getContext('2d')!;
    const idata = nctx.createImageData(256, 256);
    for (let i = 0; i < idata.data.length; i += 4) {
      const v = Math.random() * 255;
      idata.data[i] = v;
      idata.data[i+1] = v;
      idata.data[i+2] = v;
      idata.data[i+3] = 255;
    }
    nctx.putImageData(idata, 0, 0);
  }
  
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = 'overlay';
  
  // Offset the pattern every frame for "living" noise
  const ox = (Math.sin(timeMs * 0.01) * 100) % 256;
  const oy = (Math.cos(timeMs * 0.01) * 100) % 256;
  
  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  if (pattern) {
    ctx.translate(ox, oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(-ox, -oy, width, height);
  }
  
  ctx.restore();
}
