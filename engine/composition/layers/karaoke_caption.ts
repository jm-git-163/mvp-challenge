/**
 * engine/composition/layers/karaoke_caption.ts
 *
 * Phase 5 wave1 — **노래방(karaoke) 스타일 자막 레이어**.
 *
 * 자막 읽기/스크립트 미션에서 글자별로 "지금 읽어야 하는 글자" 가 컬러로
 * 진행되는 효과. 단순 자막(`subtitle_track`) 과 달리:
 *   - 전체 문장이 한 번에 보이고,
 *   - 진행도(0..1) 에 따라 글자 단위로 fillStyle 이 baseColor → activeColor 로 전환된다.
 *   - 활성 글자는 살짝 위로 떠오르며 글로우.
 *
 * 진행도 소스 우선순위:
 *   1) props.progress (0..1)                — 명시적 외부 컨트롤
 *   2) state.scriptProgress / state.karaokeProgress
 *   3) activeRange + timeMs 기반 자동 진행 (linear)
 *
 * props:
 *   - text         : string                  — 출력할 한 줄 또는 여러 줄
 *   - fontSize     : number   default 56
 *   - fontFamily   : string   default 'Pretendard, system-ui, sans-serif'
 *   - baseColor    : string   default 'rgba(255,255,255,0.55)'
 *   - activeColor  : string   default '#FFD23F'
 *   - strokeColor  : string   default 'rgba(0,0,0,0.85)'
 *   - strokeWidth  : number   default 5
 *   - position     : 'top-center' | 'center' | 'bottom-center' | {x,y}
 *   - lineHeight   : number   default fontSize * 1.35
 *   - glow         : boolean  default true
 */
import type { BaseLayer } from '../../templates/schema';

function readProgress(layer: BaseLayer, state: any, timeMs: number): number {
  const p = (layer.props as any)?.progress;
  if (typeof p === 'number') return clamp01(p);
  if (state?.scriptProgress !== undefined && Number.isFinite(state.scriptProgress)) {
    return clamp01(state.scriptProgress);
  }
  if (state?.karaokeProgress !== undefined && Number.isFinite(state.karaokeProgress)) {
    return clamp01(state.karaokeProgress);
  }
  // activeRange linear fallback
  const ar = layer.activeRange;
  if (ar && timeMs / 1000 >= ar.startSec && timeMs / 1000 <= ar.endSec) {
    const span = Math.max(0.01, ar.endSec - ar.startSec);
    return clamp01((timeMs / 1000 - ar.startSec) / span);
  }
  return 0;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function resolvePosition(pos: any, w: number, h: number): { x: number; y: number } {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return { x: pos.x, y: pos.y };
  switch (pos) {
    case 'top-center':    return { x: w / 2, y: h * 0.18 };
    case 'center':        return { x: w / 2, y: h * 0.5 };
    case 'bottom-center':
    default:              return { x: w / 2, y: h * 0.78 };
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const tokens = para.split(/(\s+)/);
    let cur = '';
    for (const tok of tokens) {
      const cand = cur + tok;
      if (ctx.measureText(cand).width > maxWidth && cur.trim().length > 0) {
        out.push(cur.trim());
        cur = tok.trimStart();
      } else {
        cur = cand;
      }
    }
    if (cur.trim().length > 0) out.push(cur.trim());
  }
  return out;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const text = (props.text as string) || (state?.scriptText as string) || '';
  if (!text) return;

  const { width: W, height: H } = ctx.canvas;
  const fontSize    = (props.fontSize as number)    || 56;
  const fontFamily  = (props.fontFamily as string)  || 'Pretendard, system-ui, sans-serif';
  const baseColor   = (props.baseColor as string)   || 'rgba(255,255,255,0.55)';
  const activeColor = (props.activeColor as string) || '#FFD23F';
  const strokeColor = (props.strokeColor as string) || 'rgba(0,0,0,0.85)';
  const strokeWidth = (props.strokeWidth as number) ?? 5;
  const lineHeight  = (props.lineHeight as number)  || fontSize * 1.35;
  const glow        = props.glow !== false;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const maxBoxWidth = W * 0.86;
  const lines = wrapLines(ctx, text, maxBoxWidth);
  if (lines.length === 0) { ctx.restore(); return; }

  // 진행도 → 활성 글자 인덱스 (전체 글자수 기준).
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const progress = readProgress(layer, state, timeMs);
  const activeChars = Math.round(progress * totalChars);

  const { x: cx, y: cy } = resolvePosition(props.position, W, H);
  const blockH = lines.length * lineHeight;
  let drawn = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWidth = ctx.measureText(line).width;
    const startX = cx - lineWidth / 2;
    const y = cy - blockH / 2 + lineHeight / 2 + i * lineHeight;

    let pen = startX;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const idx = drawn + j;
      const isActive = idx < activeChars;
      const isCurrent = idx === activeChars - 1;

      // 스트로크 (가독성)
      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(ch, pen, y + (isCurrent ? -2 : 0));
      }

      // 활성 글로우
      if (glow && isCurrent) {
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = fontSize * 0.5;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = isActive ? activeColor : baseColor;
      ctx.fillText(ch, pen, y + (isCurrent ? -2 : 0));
      pen += ctx.measureText(ch).width;
    }
    drawn += line.length;
  }

  ctx.restore();
}
