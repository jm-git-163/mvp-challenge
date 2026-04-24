/**
 * engine/composition/layers/missionPrompt.ts
 *
 * Phase 5g — **mission_prompt** 레이어 렌더러.
 */

import { LayerRenderer, FrameContext } from '../layerEngine';
import { BaseLayer } from '../../types/template';
import { missionPromptAlpha, missionPromptPosition } from '../../layers/hud';

export interface MissionPromptOptions {
  spec: BaseLayer;
  /** 현재 미션 지시문 획득 함수 */
  getPrompt: () => string;
}

export function createMissionPromptRenderer(opts: MissionPromptOptions): LayerRenderer {
  let lastPrompt = '';
  let promptStartMs = 0;

  return {
    render: (fc: FrameContext) => {
      const currentPrompt = opts.getPrompt();
      if (currentPrompt !== lastPrompt) {
        lastPrompt = currentPrompt;
        promptStartMs = fc.tMs;
      }
      if (!currentPrompt) return;

      const alpha = missionPromptAlpha(fc.tMs - promptStartMs);
      if (alpha <= 0) return;

      const ctx = fc.ctx as CanvasRenderingContext2D;
      const pos = missionPromptPosition(fc.width, fc.height);
      const color = (opts.spec.props?.color as string) ?? '#ffffff';

      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.font = 'bold 54px Pretendard, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText(currentPrompt, pos.x, pos.y);
      ctx.restore();
    }
  };
}
