/**
 * engine/composition/layers/hand_emoji.ts
 *
 * Phase 5e — **손 위치 이모지 + 트레일 (AR 정밀)**.
 *
 * Phase 5 wave2 (2026-05-01):
 *   - 손가락 끝 5개 (thumb_tip, index_tip, middle_tip, ring_tip, pinky_tip) 각각 OneEuroFilter
 *     (minCutoff 0.6, beta 0.01, dCutoff 1.0 — 손은 빠른 움직임 → 더 빠른 응답)
 *   - GestureRecognizer categories(Thumb_Up, Victory, Pointing_Up 등) 매핑.
 *   - 손바닥 중심 트레일 (이전 5프레임 잔상, alpha 페이드).
 *
 *   props:
 *     - particle : 'electric_spark' | 'star' | 'heart' | ...
 *     - emoji : string (직접 지정)
 *     - sizePx : number (default 56)
 *     - dynamicEmojiBy : 'gesture' — state.gesture 또는 categoryName 으로 이모지 교체
 *     - trail : boolean (default true) — 손바닥 중심 잔상
 *     - trailLength : number (default 5)
 *     - perFingertip : boolean (default false) — true면 손가락 끝 5개에 작은 이모지 부착
 *
 *   state.handAnchors: array | { left, right }, 각 항목은 { x, y, fingertips?: [{x,y} x5], category? }
 *   state.gesture: 단일 카테고리 (호환성).
 */
import type { BaseLayer } from '../../templates/schema';
import { OneEuroFilter } from '../../ar/oneEuroFilter';

const PARTICLE_EMOJI: Record<string, string> = {
  electric_spark: '⚡',
  star: '⭐',
  heart: '💖',
  fire: '🔥',
  sparkle: '✨',
};

// MediaPipe GestureRecognizer 표준 카테고리 + 호환성.
const GESTURE_EMOJI: Record<string, string> = {
  // 표준 카테고리 (MediaPipe Tasks Gesture Recognizer)
  Thumb_Up: '👍',
  Thumb_Down: '👎',
  Victory: '✌️',
  Pointing_Up: '👆',
  Open_Palm: '🖐️',
  Closed_Fist: '✊',
  ILoveYou: '🤟',
  // 소문자/언더스코어 호환
  peace: '✌️',
  thumbs_up: '👍',
  thumbs_down: '👎',
  open_palm: '🖐️',
  fist: '✊',
  point_up: '👆',
  victory: '✌️',
  wave: '👋',
};

function pickEmoji(props: any, state: any, perHandCategory?: string): string {
  if (typeof props.emoji === 'string' && props.emoji.length > 0) return props.emoji;
  if (props.dynamicEmojiBy === 'gesture') {
    const cat = perHandCategory ?? state?.gesture ?? state?.missionState?.gesture ?? '';
    if (cat && GESTURE_EMOJI[cat]) return GESTURE_EMOJI[cat];
    const lower = String(cat).toLowerCase();
    if (GESTURE_EMOJI[lower]) return GESTURE_EMOJI[lower];
  }
  const p = String(props.particle ?? '').toLowerCase();
  if (PARTICLE_EMOJI[p]) return PARTICLE_EMOJI[p];
  return '✨';
}

// ── 레이어/손별 OneEuroFilter + 트레일 버퍼 ─────────────────
interface HandFilterSet {
  palm: { x: OneEuroFilter; y: OneEuroFilter };
  fingertips: Array<{ x: OneEuroFilter; y: OneEuroFilter }>;
  trail: Array<{ x: number; y: number }>;
}
const _filters = new Map<string, Map<string, HandFilterSet>>();

function getHandFilters(layerId: string, handKey: string): HandFilterSet {
  let m = _filters.get(layerId);
  if (!m) { m = new Map(); _filters.set(layerId, m); }
  let s = m.get(handKey);
  if (!s) {
    const mk = () => ({
      x: new OneEuroFilter({ minCutoff: 0.6, beta: 0.01, dCutoff: 1.0 }),
      y: new OneEuroFilter({ minCutoff: 0.6, beta: 0.01, dCutoff: 1.0 }),
    });
    s = {
      palm: mk(),
      fingertips: [mk(), mk(), mk(), mk(), mk()],
      trail: [],
    };
    m.set(handKey, s);
  }
  return s;
}

interface NormalizedHand {
  key: string;            // 'left' | 'right' | 'h0' | ...
  palm: { x: number; y: number };
  fingertips?: Array<{ x: number; y: number }>;
  category?: string;
}

function resolveHands(layer: BaseLayer, state: any): NormalizedHand[] {
  const lm = (layer as any).reactive?.track?.landmark;
  const anchors = state?.handAnchors;
  const tracked = state?.__trackedPoint?.[layer.id];

  const rect = state?.cameraRect;
  const rx = rect && Number.isFinite(rect.x) ? rect.x : 0;
  const ry = rect && Number.isFinite(rect.y) ? rect.y : 0;
  const rw = rect && Number.isFinite(rect.w) && rect.w > 0 ? rect.w : null;
  const rh = rect && Number.isFinite(rect.h) && rect.h > 0 ? rect.h : null;
  const map = (p: { x: number; y: number }): { x: number; y: number } => {
    const isNorm = Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
    if (!isNorm || rw == null || rh == null) return { x: p.x, y: p.y };
    return { x: rx + p.x * rw, y: ry + p.y * rh };
  };
  const mapTips = (tips?: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> | undefined => {
    if (!tips) return undefined;
    return tips.map(map);
  };

  if (tracked && Number.isFinite(tracked.x) && Number.isFinite(tracked.y)) {
    return [{ key: 'tracked', palm: map({ x: tracked.x, y: tracked.y }) }];
  }

  if (lm === 'left_hand' && anchors?.left && Number.isFinite(anchors.left.x)) {
    return [{ key: 'left', palm: map(anchors.left), fingertips: mapTips(anchors.left.fingertips), category: anchors.left.category }];
  }
  if (lm === 'right_hand' && anchors?.right && Number.isFinite(anchors.right.x)) {
    return [{ key: 'right', palm: map(anchors.right), fingertips: mapTips(anchors.right.fingertips), category: anchors.right.category }];
  }

  const out: NormalizedHand[] = [];
  if (Array.isArray(anchors)) {
    anchors.forEach((h: any, i: number) => {
      if (h && Number.isFinite(h.x) && Number.isFinite(h.y)) {
        out.push({ key: `h${i}`, palm: map(h), fingertips: mapTips(h.fingertips), category: h.category });
      }
    });
  } else if (anchors && typeof anchors === 'object') {
    if (anchors.left && Number.isFinite(anchors.left.x)) {
      out.push({ key: 'left', palm: map(anchors.left), fingertips: mapTips(anchors.left.fingertips), category: anchors.left.category });
    }
    if (anchors.right && Number.isFinite(anchors.right.x)) {
      out.push({ key: 'right', palm: map(anchors.right), fingertips: mapTips(anchors.right.fingertips), category: anchors.right.category });
    }
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

  const sizePx = Math.max(8, (props.sizePx as number) ?? 56);
  const trailEnabled = props.trail !== false;
  const trailLength = Math.max(0, Math.min(20, (props.trailLength as number) ?? 5));
  const perFingertip = props.perFingertip === true;

  const t = timeMs / 1000;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  hands.forEach((h, i) => {
    const fset = getHandFilters(layer.id, h.key);
    const sx = fset.palm.x.filter(h.palm.x, timeMs);
    const sy = fset.palm.y.filter(h.palm.y, timeMs);

    // 트레일 버퍼 갱신.
    if (trailEnabled && trailLength > 0) {
      fset.trail.push({ x: sx, y: sy });
      while (fset.trail.length > trailLength) fset.trail.shift();
    }

    const emoji = pickEmoji(props, state, h.category);

    // 트레일 잔상 (오래된 것부터 → 현재).
    if (trailEnabled) {
      for (let k = 0; k < fset.trail.length - 1; k++) {
        const p = fset.trail[k];
        const a = (k + 1) / fset.trail.length; // 0..1
        ctx.save();
        ctx.globalAlpha = (layer.opacity ?? 1) * a * 0.4;
        ctx.font = `${sizePx * (0.5 + 0.5 * a)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        try { ctx.fillText(emoji, p.x, p.y); } catch { /* ignore */ }
        ctx.restore();
      }
    }

    // 메인 — 손바닥 중심.
    const bounce = Math.sin(t * 3 + i) * 4;
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    try { ctx.fillText(emoji, sx, sy + bounce); } catch { /* ignore */ }

    // 손가락 끝 5개 — perFingertip + 스무딩.
    if (perFingertip && h.fingertips && h.fingertips.length > 0) {
      const tipSize = sizePx * 0.45;
      ctx.font = `${tipSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      h.fingertips.slice(0, 5).forEach((tip, ti) => {
        const fx = fset.fingertips[ti].x.filter(tip.x, timeMs);
        const fy = fset.fingertips[ti].y.filter(tip.y, timeMs);
        try { ctx.fillText('✨', fx, fy); } catch { /* ignore */ }
      });
    }
  });

  ctx.restore();
}

/** 테스트 전용 — 필터 초기화. */
export function _resetHandEmojiFilters(): void {
  _filters.clear();
}
