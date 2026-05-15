/**
 * engine/composition/layers/cameraFeed.ts
 *
 * Phase 5c — **camera_feed** 레이어 렌더러.
 * 
 * 카메라 영상을 지정된 프레이밍(clip path) 내부에 cover 방식으로 그린다.
 * 비디오 엘리먼트는 외부(global 또는 context)에서 주입받는다.
 */

import { LayerRenderer, FrameContext } from '../layerEngine';
import { CameraFraming } from '../../types/template';
import { buildFramingPath, framingBox, computeCoverDrawArgs, PathBuilder } from '../framing';

export interface CameraFeedOptions {
  framing: CameraFraming;
  /** 비디오 엘리먼트 획득 함수. (window.__poseVideoEl 등) */
  getVideo: () => HTMLVideoElement | undefined;
}

export function createCameraFeedRenderer(opts: CameraFeedOptions): LayerRenderer {
  return {
    render: (fc: FrameContext) => {
      const video = opts.getVideo();
      if (!video || video.readyState < 2) return;

      const ctx = fc.ctx as CanvasRenderingContext2D;
      const box = framingBox(opts.framing, fc.width, fc.height);
      const args = computeCoverDrawArgs(video.videoWidth, video.videoHeight, box);

      ctx.save();
      // 1. 프레이밍 클립 적용
      buildFramingPath(opts.framing, ctx as unknown as PathBuilder, fc.width, fc.height);
      ctx.clip();

      // 2. 비디오 그리기
      ctx.drawImage(
        video,
        args.sx, args.sy, args.sw, args.sh,
        args.dx, args.dy, args.dw, args.dh
      );

      ctx.restore();
    }
  };
}
