/**
 * engine/composition/layers/mission_prompt.ts
 *
 * Phase 5g — **미션 지시문 프롬프트**.
 *
 *   상단 중앙의 반투명 pill + 네온 글로우 텍스트.
 *   activeRange 필터링은 상위 렌더 루프에서 이미 수행되므로 여기선 무조건 그린다.
 *
 *   props:
 *     - text : string             (필수, default '미션을 수행하세요')
 *     - color : string            (default '#FFFFFF')
 *     - neonAccent : string       (default props.color — 글로우 색)
 *     - size : number (font px)   (default 34)
 *     - position : 'top' | 'center' | 'bottom' | {x,y}  (default 'top')
 *     - pill : boolean            (default true)
 *     - pillBg : string           (default 'rgba(0,0,0,0.55)')
 */
import type { BaseLayer } from '../../templates/schema';

function resolveAnchor(
  pos: any, W: number, H: number,
): { x: number; y: number } {
  if (pos && typeof pos === 'object' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    return { x: pos.x, y: pos.y };
  }
  switch (pos) {
    case 'center': return { x: W / 2, y: H * 0.5 };
    case 'bottom': return { x: W / 2, y: H * 0.88 };
    case 'top':
    default:       return { x: W / 2, y: H * 0.12 };
  }
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  _state: any,
): void {
  const props = (layer.props as any) || {};
  const text = String(props.text ?? '미션을 수행하세요');
  if (!text) return;

  const color = (props.color as string) || '#FFFFFF';
  const neon = (props.neonAccent as string) || color;
  const size = (props.size as number) ?? 34;
  const pill = (props.pill as boolean) ?? true;
  const pillBg = (props.pillBg as string) || 'rgba(0,0,0,0.55)';

  const { width: W, height: H } = ctx.canvas;
  const { x, y } = resolveAnchor(props.position, W, H);

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  ctx.font = `700 ${size}px "Pretendard", "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // pill 배경
  if (pill) {
    const m = ctx.measureText(text);
    const padX = size * 0.8;
    const padY = size * 0.45;
    const bw = m.width + padX * 2;
    const bh = size + padY * 2;
    ctx.fillStyle = pillBg;
    // 둥근 사각형 (호환 위해 수동 path)
    const r = bh / 2;
    const bx = x - bw / 2;
    const by = y - bh / 2;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.arc(bx + bw - r, by + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bx + r, by + bh);
    ctx.arc(bx + r, by + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `${neon}80`; // 약 50% 네온 테두리
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 네온 글로우 텍스트
  ctx.shadowColor = neon;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  // 두 번 그려 글로우 강조
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);

  ctx.restore();
}
