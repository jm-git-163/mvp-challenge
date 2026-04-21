/**
 * engine/composition/layers/counter_hud.ts
 *
 * Focused Session-2 Candidate B: **카운터 HUD** (스쿼트/제스처/포즈홀드 수치 표시).
 *
 * props:
 *   - target: number (목표치, default 10)
 *   - format: '{n} / {target}' 또는 '{n}회' 등, {n}/{target} 치환
 *   - fontSize, fontFamily, color, strokeColor, strokeWidth
 *   - position: 'center' | 'top-center' | 'bottom-center' | {x, y}
 *   - glassBg: boolean (반투명 배경 박스)
 *
 * state 에서 읽는 값(호환 필드 전부 시도):
 *   - state.missionState?.repCount
 *   - state.squatCount
 *   - state.counter ?? state.count ?? 0
 *
 * 변경 감지 시 scale 1.0 → 1.12 → 1.0 (220ms) 펄스 애니메이션.
 * 내부 마지막 값 캐시는 state.__counterHudMemo[layer.id] 에 저장.
 */
import type { BaseLayer } from '../../templates/schema';

const PULSE_MS = 220;
const PULSE_PEAK = 1.12;

function readCount(state: any): number {
  if (!state) return 0;
  const m = state.missionState;
  if (m && Number.isFinite(m.repCount)) return m.repCount;
  if (Number.isFinite(state.squatCount)) return state.squatCount;
  if (Number.isFinite(state.counter)) return state.counter;
  if (Number.isFinite(state.count)) return state.count;
  return 0;
}

function resolvePosition(
  pos: any, width: number, height: number,
): { x: number; y: number } {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return { x: pos.x, y: pos.y };
  switch (pos) {
    case 'top-center':    return { x: width / 2, y: height * 0.14 };
    case 'bottom-center': return { x: width / 2, y: height * 0.86 };
    case 'center':
    default:              return { x: width / 2, y: height * 0.5 };
  }
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const props = layer.props || {};
  const { width, height } = ctx.canvas;

  const target   = Number.isFinite(props.target as number) ? (props.target as number) : 10;
  const fontSize = (props.fontSize as number) || 72;
  const fontFamily = (props.fontFamily as string) || '"JetBrains Mono", ui-monospace, monospace';
  const color       = (props.color as string) || '#FFFFFF';
  const strokeColor = (props.strokeColor as string) || 'rgba(0,0,0,0.6)';
  const strokeWidth = (props.strokeWidth as number) || 6;
  const format      = (props.format as string) || '{n} / {target}';
  const glassBg     = (props.glassBg as boolean) ?? true;

  const count = readCount(state);
  const text = format.replace('{n}', String(count)).replace('{target}', String(target));

  // 펄스 애니메이션: 이전 값 대비 변경된 순간부터 경과
  const memoKey = '__counterHudMemo';
  if (!state[memoKey]) state[memoKey] = {};
  const memo = state[memoKey];
  const prev = memo[layer.id];
  if (!prev || prev.value !== count) {
    memo[layer.id] = { value: count, pulseStart: timeMs };
  }
  const elapsed = Math.max(0, timeMs - (memo[layer.id]?.pulseStart ?? timeMs));
  let scale = 1;
  if (elapsed < PULSE_MS) {
    const t = elapsed / PULSE_MS;         // 0→1
    const bump = Math.sin(t * Math.PI);   // 0→1→0
    scale = 1 + (PULSE_PEAK - 1) * bump;
  }

  const { x, y } = resolvePosition(props.position, width, height);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);

  if (glassBg) {
    // 간이 glassmorphism 박스
    const padX = fontSize * 0.6;
    const padY = fontSize * 0.25;
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const m = ctx.measureText(text);
    const bw = m.width + padX * 2;
    const bh = fontSize * 1.35 + padY * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px ${fontFamily}`;

  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}
