/**
 * engine/composition/layers/chromatic_pulse.ts
 *
 * Phase 5c — **크로매틱 펄스 (RGB 채널 분리 에지 이펙트)**.
 *
 *   비트 온셋 또는 미션 이벤트 시점에 화면 에지에 RGB 채널이 분리된
 *   프레임 느낌의 보더를 그린다. 전체 프레임 copy 오버헤드를 피하기 위해
 *   4변 에지 박스에 빨강/파랑 오프셋 색 박스만 그림.
 *
 *   props:
 *     - peakPx : number           (default 8) — 최대 분리 픽셀
 *     - color : string            (default '#FF2D95') — 기본 펄스 색(여기선 에지 링)
 *     - onOnsetAmplify : number   (default 1) — state.beatIntensity 에 따른 증폭
 *     - edgeThickness : number    (default 60) — 에지 밴드 두께
 */
import type { BaseLayer } from '../../templates/schema';

function readIntensity(state: any): number {
  const a = state?.beatIntensity;
  if (Number.isFinite(a)) return Math.max(0, Math.min(1, a));
  const b = state?.missionState?.beatIntensity;
  if (Number.isFinite(b)) return Math.max(0, Math.min(1, b));
  return 0;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const peakPx = Math.max(0, (props.peakPx as number) ?? 8);
  const onOnsetAmp = (props.onOnsetAmplify as number) ?? 1;
  const edgeT = Math.max(10, (props.edgeThickness as number) ?? 60);

  const intensity = readIntensity(state) * onOnsetAmp;
  if (intensity <= 0.02 || peakPx <= 0) return;

  const { width: W, height: H } = ctx.canvas;
  const offset = peakPx * intensity;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (layer.opacity ?? 1) * 0.6 * intensity;

  // 빨강 채널: 좌/상 오프셋
  ctx.fillStyle = 'rgba(255,0,80,0.55)';
  ctx.fillRect(-offset, 0, edgeT, H);          // 좌
  ctx.fillRect(W - edgeT - offset, 0, edgeT, H); // 우(-오프셋)
  ctx.fillRect(0, -offset, W, edgeT);          // 상
  ctx.fillRect(0, H - edgeT - offset, W, edgeT); // 하

  // 파랑 채널: 우/하 오프셋
  ctx.fillStyle = 'rgba(0,220,255,0.55)';
  ctx.fillRect(offset, 0, edgeT, H);
  ctx.fillRect(W - edgeT + offset, 0, edgeT, H);
  ctx.fillRect(0, offset, W, edgeT);
  ctx.fillRect(0, H - edgeT + offset, W, edgeT);

  ctx.restore();
}
