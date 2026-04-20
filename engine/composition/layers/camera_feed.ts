/**
 * engine/composition/layers/camera_feed.ts
 */
import { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any
): void {
  const { width, height } = ctx.canvas;
  const video = state.videoEl as HTMLVideoElement | undefined;
  
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  
  if (video && video.readyState >= 2) {
    // Fill cover logic
    const sAspect = video.videoWidth / video.videoHeight;
    const dAspect = width / height;
    let sw, sh, sx, sy;
    
    if (sAspect > dAspect) {
      sh = video.videoHeight;
      sw = sh * dAspect;
      sx = (video.videoWidth - sw) / 2;
      sy = 0;
    } else {
      sw = video.videoWidth;
      sh = sw / dAspect;
      sx = 0;
      sy = (video.videoHeight - sh) / 2;
    }
    
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  } else {
    // Fallback
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }
  
  ctx.restore();
}
