/**
 * engine/composition/layers/subtitle_track.ts
 *
 * Focused Session-2 Candidate C: **자막 트랙 렌더러**.
 *
 * 실시간 음성 인식(`state.speechTranscript` 또는 `state.subtitle`)의
 * 마지막 1~2 문장을 하단 중앙에 표시한다.
 *
 * props:
 *   - style: 'bubble' | 'broadcast' | 'minimal'   (default 'broadcast')
 *   - maxChars: number   (default 80, 초과 시 말줄임)
 *   - maxSentences: number (default 2)
 *   - fontSize, fontFamily, color, strokeColor, strokeWidth
 *   - position: 'bottom-center' | 'top-center' | 'center' | {x,y}  (default 'bottom-center')
 *   - paddingX, paddingY
 *
 * state 우선순위:
 *   - state.speechTranscript (string)  ← 공식 인식 결과
 *   - state.subtitle (string)          ← 수동/테스트
 *   - state.missionState?.lastUtterance
 */
import type { BaseLayer } from '../../templates/schema';

function readTranscript(state: any): string {
  if (!state) return '';
  if (typeof state.speechTranscript === 'string') return state.speechTranscript;
  if (typeof state.subtitle === 'string') return state.subtitle;
  const lu = state.missionState?.lastUtterance;
  if (typeof lu === 'string') return lu;
  return '';
}

function lastSentences(text: string, maxSentences: number, maxChars: number): string {
  if (!text) return '';
  // 한국어 문장 구분 (. ! ? 。 또는 개행). 공백 구분은 제외.
  const parts = text.split(/(?<=[\.!\?。])\s+|\n+/).filter((s) => s.trim().length > 0);
  const picked = parts.slice(-Math.max(1, maxSentences)).join(' ');
  if (picked.length <= maxChars) return picked;
  return '…' + picked.slice(picked.length - maxChars + 1);
}

function resolvePosition(
  pos: any, width: number, height: number,
): { x: number; y: number } {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return { x: pos.x, y: pos.y };
  switch (pos) {
    case 'top-center':    return { x: width / 2, y: height * 0.12 };
    case 'center':        return { x: width / 2, y: height * 0.5 };
    case 'bottom-center':
    default:              return { x: width / 2, y: height * 0.84 };
  }
}

/** 자연스러운 word-wrap. Canvas measureText 기반. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const tokens = text.split(/(\s+)/); // 공백 포함 토큰 유지
  const lines: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    const cand = cur + tok;
    const w = ctx.measureText(cand).width;
    if (w > maxWidth && cur.trim().length > 0) {
      lines.push(cur.trim());
      cur = tok.trimStart();
    } else {
      cur = cand;
    }
  }
  if (cur.trim().length > 0) lines.push(cur.trim());
  return lines;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = layer.props || {};
  const { width, height } = ctx.canvas;

  const raw = readTranscript(state);
  if (!raw) return; // 자막 없으면 완전히 스킵 (박스도 안 그림)

  const style       = (props.style as string) || 'broadcast';
  const maxChars    = (props.maxChars as number) || 80;
  const maxSent     = (props.maxSentences as number) || 2;
  const fontSize    = (props.fontSize as number) || 44;
  const fontFamily  = (props.fontFamily as string) || 'Pretendard, system-ui, sans-serif';
  const color       = (props.color as string) || '#FFFFFF';
  const strokeColor = (props.strokeColor as string) || 'rgba(0,0,0,0.75)';
  const strokeWidth = (props.strokeWidth as number) || 4;
  const paddingX    = (props.paddingX as number) || fontSize * 0.9;
  const paddingY    = (props.paddingY as number) || fontSize * 0.45;

  const text = lastSentences(raw, maxSent, maxChars);
  if (!text) return;

  const { x, y } = resolvePosition(props.position, width, height);
  const maxBoxWidth = width * 0.82;

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapLines(ctx, text, maxBoxWidth - paddingX * 2);
  const lineHeight = fontSize * 1.3;
  const blockH = lines.length * lineHeight;

  // 스타일별 배경
  if (style === 'bubble') {
    const longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
    const bw = Math.min(maxBoxWidth, longest + paddingX * 2);
    const bh = blockH + paddingY * 2;
    const bx = x - bw / 2;
    const by = y - bh / 2;
    const r = Math.min(bh / 2, 28);
    ctx.fillStyle = 'rgba(20,22,30,0.75)';
    roundedRect(ctx, bx, by, bw, bh, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (style === 'broadcast') {
    // 하단 풀폭 바 + 좌측 컬러 인디케이터
    const barY = y - blockH / 2 - paddingY;
    const barH = blockH + paddingY * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, barY, width, barH);
    ctx.fillStyle = '#FF2D95';
    ctx.fillRect(0, barY, 8, barH);
  }
  // minimal: 배경 없음, 스트로크만

  // 텍스트
  let ty = y - blockH / 2 + lineHeight / 2;
  for (const line of lines) {
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(line, x, ty);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, x, ty);
    ty += lineHeight;
  }

  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
