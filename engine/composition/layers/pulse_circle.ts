/**
 * engine/composition/layers/pulse_circle.ts
 *
 * Phase 5 wave1 — 비트 싱크 원형 펄스 레이어.
 *   - squat-master 등 다수 템플릿이 `pulse_circle` 타입을 사용하지만
 *     dispatcher 레지스트리에 누락되어 조용히 스킵되고 있던 것을 보강.
 *   - reactiveBinding 이 layer.props._reactive.scale 를 주입하면
 *     baseRadius * (1 + scaleBoost) 로 반경을 부풀린다.
 *
 *   props:
 *     - cx, cy        : number          원 중심 (default 캔버스 중앙)
 *     - baseRadius    : number          기본 반경 (default 300)
 *     - color         : string          채움색 (default 'rgba(255,255,255,1)')
 *     - ringWidth     : number | null   null 이면 solid fill, 아니면 stroke 링만
 *     - glowBlur      : number          shadowBlur (default 40)
 *     - useBeat       : boolean         state.beatIntensity 로 반경 펄스 (default true)
 */
import type { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const reactive = (layer as any)._reactive || {};
  const { width: W, height: H } = ctx.canvas;
  const cx = (props.cx as number) ?? W / 2;
  const cy = (props.cy as number) ?? H / 2;
  const baseR = (props.baseRadius as number) ?? 300;
  const color = (props.color as string) || 'rgba(255,255,255,1)';
  const ringWidth = props.ringWidth as number | null | undefined;
  const glowBlur = (props.glowBlur as number) ?? 40;
  const useBeat = props.useBeat !== false;

  let scaleBoost = (reactive.scale as number) ?? 0;
  if (useBeat) {
    const intensity = Math.max(
      typeof state?.beatIntensity === 'number' ? state.beatIntensity : 0,
      typeof state?.missionState?.beatIntensity === 'number' ? state.missionState.beatIntensity : 0,
    );
    scaleBoost = Math.max(scaleBoost, intensity * 0.15);
  }
  const r = Math.max(1, baseR * (1 + scaleBoost));

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowColor = color;
  ctx.shadowBlur = glowBlur;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (ringWidth && ringWidth > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = ringWidth;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}
