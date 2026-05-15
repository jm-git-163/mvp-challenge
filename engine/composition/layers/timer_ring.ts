/**
 * engine/composition/layers/timer_ring.ts
 *
 * Phase 5g — **원형 타이머 링 HUD**.
 *
 *   남은 시간 또는 경과 시간을 원호(arc)로 표시. 12시 방향에서 시작해
 *   시계 방향 감소(또는 증가).
 *
 *   진행도 소스 우선순위:
 *     1) state.missionState.timerProgress  (0~1)
 *     2) props.durationSec + activeRange.startSec 기반 계산
 *     3) timeMs / 20s 루프 (폴백)
 *
 *   props:
 *     - position : 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | {x,y}
 *     - radius : number (px, default 44)
 *     - lineWidth : number (default 6)
 *     - color : string (default '#00E0FF')
 *     - trackColor : string (default 'rgba(255,255,255,0.15)')
 *     - direction : 'down' | 'up' (default 'down' — 시간이 줄어드는 표시)
 *     - durationSec : number (폴백용, default 20)
 */
import type { BaseLayer } from '../../templates/schema';

function resolveCorner(
  pos: any, W: number, H: number, margin: number,
): { x: number; y: number } {
  if (pos && typeof pos === 'object' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    return { x: pos.x, y: pos.y };
  }
  switch (pos) {
    case 'top-right':    return { x: W - margin, y: margin };
    case 'bottom-left':  return { x: margin, y: H - margin };
    case 'bottom-right': return { x: W - margin, y: H - margin };
    case 'top-left':
    default:             return { x: margin, y: margin };
  }
}

function readProgress(state: any, timeMs: number, durationSec: number): number {
  const p = state?.missionState?.timerProgress;
  if (Number.isFinite(p)) return Math.max(0, Math.min(1, p));
  // 폴백: timeMs 기반 주기
  const cycled = (timeMs / 1000) % Math.max(0.5, durationSec);
  return cycled / Math.max(0.5, durationSec);
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;
  const radius = Math.max(10, (props.radius as number) ?? 44);
  const lineWidth = Math.max(1, (props.lineWidth as number) ?? 6);
  const color = (props.color as string) || '#00E0FF';
  const trackColor = (props.trackColor as string) || 'rgba(255,255,255,0.15)';
  const direction = (props.direction as string) || 'down';
  const durationSec = (props.durationSec as number) ?? 20;

  const margin = radius + lineWidth + 24;
  const { x, y } = resolveCorner(props.position, W, H, margin);

  const progress = readProgress(state, timeMs, durationSec);
  // direction: 'down' 이면 남은 양(1-progress) 을 호로 그림
  const arcFraction = direction === 'up' ? progress : (1 - progress);
  const sweep = Math.max(0, Math.min(1, arcFraction)) * Math.PI * 2;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  // 배경 트랙
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 전경 진행 호 (12시 방향에서 시작)
  if (sweep > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + sweep, false);
    ctx.stroke();
  }

  // 중앙 숫자 (남은 초)
  const remainSec = Math.max(0, Math.round(durationSec * (1 - progress)));
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(radius * 0.75)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(remainSec), x, y);

  ctx.restore();
}
