/**
 * engine/composition/layers/timerRing.ts
 *
 * Phase 5g — **timer_ring** 레이어 렌더러.
 */

import { LayerRenderer, FrameContext } from '../layerEngine';
import { BaseLayer } from '../../types/template';
import { timerRingAngle } from '../../layers/hud';

export interface TimerRingOptions {
  spec: BaseLayer;
  totalSec: number;
}

export function createTimerRingRenderer(opts: TimerRingOptions): LayerRenderer {
  return {
    render: (fc: FrameContext) => {
      const angle = timerRingAngle({ elapsedSec: fc.tSec, totalSec: opts.totalSec });
      const ctx = fc.ctx as CanvasRenderingContext2D;
      
      const props = opts.spec.props;
      const x = (props?.x as number) ?? 100;
      const y = (props?.y as number) ?? 100;
      const radius = (props?.radius as number) ?? 40;
      const color = (props?.color as string) ?? '#ffffff';

      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 6;
      ctx.strokeStyle = color;
      // 12시 방향에서 시작하도록 -PI/2
      ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + angle, false);
      ctx.stroke();
      ctx.restore();
    }
  };
}
