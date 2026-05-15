/**
 * engine/composition/layers/scoreHud.ts
 *
 * Phase 5g — **score_hud** 레이어 렌더러.
 */

import { LayerRenderer, FrameContext } from '../layerEngine';
import { BaseLayer } from '../../types/template';
import { scoreCountUp } from '../../layers/hud';

export interface ScoreHudOptions {
  spec: BaseLayer;
  /** 현재 점수 획득 함수 */
  getScore: () => number;
}

export function createScoreHudRenderer(opts: ScoreHudOptions): LayerRenderer {
  let lastScore = 0;
  let targetScore = 0;
  let animStartMs = 0;
  const durationMs = 600;

  return {
    render: (fc: FrameContext) => {
      const currentTarget = opts.getScore();
      if (currentTarget !== targetScore) {
        lastScore = targetScore;
        targetScore = currentTarget;
        animStartMs = fc.tMs;
      }

      const displayScore = scoreCountUp(lastScore, targetScore, fc.tMs - animStartMs, durationMs);
      const ctx = fc.ctx as CanvasRenderingContext2D;
      
      const props = opts.spec.props;
      const x = (props?.x as number) ?? fc.width - 150;
      const y = (props?.y as number) ?? 80;
      const color = (props?.color as string) ?? '#ffffff';

      ctx.save();
      ctx.font = 'bold 48px JetBrains Mono, monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(`SCORE ${displayScore}`, x, y);
      ctx.restore();
    }
  };
}
