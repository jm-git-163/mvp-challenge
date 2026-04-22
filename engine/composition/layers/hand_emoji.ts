/**
 * engine/composition/layers/hand_emoji.ts
 *
 * Phase 5e — **손 위치 이모지/스파크**.
 *
 *   state.handAnchors = [{x,y}, {x,y}] (왼손/오른손 또는 감지된 순서대로).
 *   각 손 위치에 이모지를 그린다. 없으면 그리지 않음.
 *
 *   props:
 *     - particle : 'electric_spark' | 'star' | 'heart' 등 (기본 이모지 매핑)
 *     - emoji : string (직접 지정)
 *     - sizePx : number (default 56)
 *     - dynamicEmojiBy : 'gesture' — state.gesture 에 따라 이모지 교체
 *
 *   reactive.track.landmark = 'left_hand' | 'right_hand' 인 경우 단일 손만 표시.
 */
import type { BaseLayer } from '../../templates/schema';

const PARTICLE_EMOJI: Record<string, string> = {
  electric_spark: '⚡',
  star: '⭐',
  heart: '💖',
  fire: '🔥',
  sparkle: '✨',
};

const GESTURE_EMOJI: Record<string, string> = {
  peace: '✌️',
  thumbs_up: '👍',
  open_palm: '🖐️',
  fist: '✊',
  point_up: '👆',
  victory: '✌️',
  wave: '👋',
};

function pickEmoji(props: any, state: any): string {
  if (typeof props.emoji === 'string' && props.emoji.length > 0) return props.emoji;
  if (props.dynamicEmojiBy === 'gesture') {
    const g = String(state?.gesture ?? state?.missionState?.gesture ?? '').toLowerCase();
    if (GESTURE_EMOJI[g]) return GESTURE_EMOJI[g];
  }
  const p = String(props.particle ?? '').toLowerCase();
  if (PARTICLE_EMOJI[p]) return PARTICLE_EMOJI[p];
  return '✨';
}

function resolveHands(layer: BaseLayer, state: any): Array<{ x: number; y: number }> {
  // reactive.track 이 특정 손을 지정한 경우 그 쪽만
  const lm = (layer as any).reactive?.track?.landmark;
  const anchors = state?.handAnchors;
  const tracked = state?.__trackedPoint?.[layer.id];

  if (tracked && Number.isFinite(tracked.x) && Number.isFinite(tracked.y)) {
    return [{ x: tracked.x, y: tracked.y }];
  }

  if (lm === 'left_hand' && anchors?.left && Number.isFinite(anchors.left.x)) {
    return [{ x: anchors.left.x, y: anchors.left.y }];
  }
  if (lm === 'right_hand' && anchors?.right && Number.isFinite(anchors.right.x)) {
    return [{ x: anchors.right.x, y: anchors.right.y }];
  }

  // 전체 손
  const out: Array<{ x: number; y: number }> = [];
  if (Array.isArray(anchors)) {
    for (const h of anchors) {
      if (h && Number.isFinite(h.x) && Number.isFinite(h.y)) out.push({ x: h.x, y: h.y });
    }
  } else if (anchors && typeof anchors === 'object') {
    if (anchors.left && Number.isFinite(anchors.left.x)) out.push(anchors.left);
    if (anchors.right && Number.isFinite(anchors.right.x)) out.push(anchors.right);
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
  const hands = resolveHands(layer, state);
  if (hands.length === 0) return;

  const emoji = pickEmoji(props, state);
  const sizePx = Math.max(8, (props.sizePx as number) ?? 56);

  const t = timeMs / 1000;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  hands.forEach((h, i) => {
    // 작은 부유 바운스
    const bounce = Math.sin(t * 3 + i) * 4;
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    try { ctx.fillText(emoji, h.x, h.y + bounce); } catch { /* 무시 */ }
  });

  ctx.restore();
}
