/**
 * engine/composition/layers/cameraFrame.ts
 *
 * Phase 5c — **camera_frame** 레이어 렌더러.
 * 
 * 카메라 프레이밍 외곽에 보더(선)와 글로우(빛)를 그린다.
 */

import { LayerRenderer, FrameContext } from '../layerEngine';
import { CameraFraming, BaseLayer } from '../../types/template';
import { buildFramingPath, PathBuilder } from '../framing';

export interface CameraFrameOptions {
  framing: CameraFraming;
  spec: BaseLayer;
}

export function createCameraFrameRenderer(opts: CameraFrameOptions): LayerRenderer {
  const { props } = opts.spec;
  const color = (props?.color as string) ?? '#ffffff';
  const thickness = (props?.thickness as number) ?? 2;
  const glowRadius = (props?.glowRadius as number) ?? 0;

  return {
    render: (fc: FrameContext) => {
      const ctx = fc.ctx as CanvasRenderingContext2D;
      
      ctx.save();
      
      // 1. 글로우 효과 (Shadow API 활용)
      if (glowRadius > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glowRadius;
      }

      // 2. 프레임 경로 생성
      buildFramingPath(opts.framing, ctx as unknown as PathBuilder, fc.width, fc.height);

      // 3. 선 그리기
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();

      ctx.restore();
    }
  };
}
