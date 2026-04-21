/**
 * engine/composition/layers/kinetic_text.ts
 *
 * Focused Session-2 Candidate D: **키네틱 타이포 렌더러**.
 *
 * 인트로/아웃트로/이벤트 순간에 글자 하나씩 튀어나오며 등장하는 타이포.
 *
 * props:
 *   - text: string                            (필수)
 *   - startMs: number                         (애니메이션 시작 시각, default 0)
 *   - staggerMs: number                       (글자당 지연, default 60)
 *   - charDurationMs: number                  (글자당 애니 지속, default 420)
 *   - fontSize, fontFamily, color, strokeColor, strokeWidth
 *   - position: 'center' | 'top-center' | 'bottom-center' | {x,y}
 *   - mode: 'pop' | 'drop' | 'spin'           (default 'pop')
 *     · pop: scale 0.2→1.1→1.0 + alpha
 *     · drop: y -60 → 0
 *     · spin: rotate -15deg → 0 + scale
 *   - letterSpacingPx: number                 (default 0)
 *   - holdAfterMs: number                     (default Infinity — 끝까지 유지)
 *
 * 레이어 전체가 애니메이션 끝난 후엔 정적 렌더(scale=1, alpha=1)로 유지된다.
 * activeRange 로 자연스러운 퇴장 제어.
 */
import type { BaseLayer } from '../../templates/schema';

function resolvePosition(
  pos: any, width: number, height: number,
): { x: number; y: number } {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return { x: pos.x, y: pos.y };
  switch (pos) {
    case 'top-center':    return { x: width / 2, y: height * 0.22 };
    case 'bottom-center': return { x: width / 2, y: height * 0.78 };
    case 'center':
    default:              return { x: width / 2, y: height * 0.5 };
  }
}

/** easeOutBack (scale pop 용). t: 0~1 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  _state: any,
): void {
  const props = layer.props || {};
  const text = String(props.text ?? '');
  if (!text) return;

  const { width, height } = ctx.canvas;
  const startMs        = (props.startMs as number) || 0;
  const staggerMs      = (props.staggerMs as number) || 60;
  const charDur        = (props.charDurationMs as number) || 420;
  const fontSize       = (props.fontSize as number) || 96;
  const fontFamily     = (props.fontFamily as string) || 'Pretendard, system-ui, sans-serif';
  const color          = (props.color as string) || '#FFFFFF';
  const strokeColor    = (props.strokeColor as string) || 'rgba(0,0,0,0.7)';
  const strokeWidth    = (props.strokeWidth as number) || 6;
  const mode           = (props.mode as string) || 'pop';
  const letterSpacing  = (props.letterSpacingPx as number) || 0;

  const chars = Array.from(text); // 서로게이트 페어/이모지 안전
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.font = `800 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 총 너비 계산 (letterSpacing 포함)
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * Math.max(0, chars.length - 1);

  const { x: cx, y: cy } = resolvePosition(props.position, width, height);
  let x = cx - total / 2;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const w = widths[i];
    const charStart = startMs + i * staggerMs;
    const local = timeMs - charStart;

    let t = 1;
    if (local < 0) {
      // 아직 시작 전 — 스킵 (완전히 안 그림)
      x += w + letterSpacing;
      continue;
    } else if (local < charDur) {
      t = local / charDur; // 0→1
    }

    // mode 별 변형
    let scale = 1;
    let dy = 0;
    let rot = 0;
    let alpha = 1;

    if (mode === 'drop') {
      const e = easeOutCubic(t);
      dy = -60 * (1 - e);
      alpha = e;
    } else if (mode === 'spin') {
      const e = easeOutBack(t);
      rot = (-15 * Math.PI / 180) * (1 - t);
      scale = 0.3 + 0.7 * e;
      alpha = Math.min(1, t * 2);
    } else {
      // pop
      const e = easeOutBack(t);
      scale = 0.2 + 0.8 * e;
      alpha = Math.min(1, t * 2.2);
    }

    const charCenterX = x + w / 2;
    ctx.save();
    ctx.globalAlpha = layer.opacity * Math.max(0, Math.min(1, alpha));
    ctx.translate(charCenterX, cy + dy);
    if (rot !== 0) ctx.rotate(rot);
    if (scale !== 1) ctx.scale(scale, scale);

    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.fillText(ch, 0, 0);
    ctx.restore();

    x += w + letterSpacing;
  }

  ctx.restore();
}
