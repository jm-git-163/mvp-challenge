/**
 * engine/composition/layers/face_sticker.ts
 *
 * Phase 5e — **얼굴 스티커 (AR)**.
 *
 *   state.faceAnchor 에 있는 랜드마크 좌표에 이미지 또는 이모지 스티커를 붙인다.
 *   랜드마크 없으면 화면 중앙 상단 폴백 위치.
 *
 *   props:
 *     - asset : string     — URL 또는 이모지 문자. '/stickers/...' 이면 이미지 로드.
 *     - sizePx : number    (default 80)
 *     - offsetX, offsetY : number (default 0)
 *
 *   reactive.track.landmark 는 상위 reactiveBinding 에서 이미 해석되어
 *   state.__trackedPoint[layer.id] = {x,y,rot,scale} 로 전달될 수 있음.
 *   해당 값이 있으면 우선 사용, 없으면 face_anchor 기본 랜드마크 매핑.
 */
import type { BaseLayer } from '../../templates/schema';

// 이미지 캐시: URL → HTMLImageElement
const _imgCache = new Map<string, { img: HTMLImageElement; ok: boolean; failed: boolean }>();

function getImage(url: string): { img: HTMLImageElement; ok: boolean; failed: boolean } | null {
  if (typeof Image === 'undefined') return null;
  let entry = _imgCache.get(url);
  if (!entry) {
    const img = new Image();
    const e = { img, ok: false, failed: false };
    img.onload = () => { e.ok = true; };
    img.onerror = () => { e.failed = true; };
    try { img.src = url; } catch { e.failed = true; }
    _imgCache.set(url, e);
    entry = e;
  }
  return entry;
}

function resolvePoint(layer: BaseLayer, state: any, W: number, H: number): { x: number; y: number; rot: number; scale: number } {
  const tracked = state?.__trackedPoint?.[layer.id];
  if (tracked && Number.isFinite(tracked.x) && Number.isFinite(tracked.y)) {
    return {
      x: tracked.x, y: tracked.y,
      rot: Number.isFinite(tracked.rot) ? tracked.rot : 0,
      scale: Number.isFinite(tracked.scale) ? tracked.scale : 1,
    };
  }
  // faceAnchor 랜드마크 직접 조회
  const anchor = state?.faceAnchor;
  const lm = (layer as any).reactive?.track?.landmark;
  if (anchor && lm && anchor[lm] && Number.isFinite(anchor[lm].x)) {
    return { x: anchor[lm].x, y: anchor[lm].y, rot: anchor.roll ?? 0, scale: anchor.size ?? 1 };
  }
  // 폴백: 상단 중앙
  return { x: W / 2, y: H * 0.25, rot: 0, scale: 1 };
}

function isEmojiLike(s: string): boolean {
  // URL 경로 감지 (/ 또는 http)
  if (!s) return true;
  if (s.startsWith('/') || s.startsWith('http') || s.startsWith('.')) return false;
  // 길이 짧고 / 없으면 이모지로 간주
  return s.length <= 6;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const asset = String(props.asset ?? '😎');
  const sizePx = Math.max(8, (props.sizePx as number) ?? 80);
  const offX = (props.offsetX as number) ?? 0;
  const offY = (props.offsetY as number) ?? 0;

  const { width: W, height: H } = ctx.canvas;
  const { x, y, rot, scale } = resolvePoint(layer, state, W, H);

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.translate(x + offX, y + offY);
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);

  if (isEmojiLike(asset)) {
    // 이모지 폴백
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.fillText(asset, 0, 0); } catch { /* 이모지 렌더 실패 조용 무시 */ }
  } else {
    const entry = getImage(asset);
    if (entry && entry.ok) {
      try {
        ctx.drawImage(entry.img, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
      } catch {
        // drawImage 실패 → 이모지 폴백
        ctx.font = `${sizePx}px "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('😎', 0, 0);
      }
    } else if (entry && entry.failed) {
      ctx.font = `${sizePx}px "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('😎', 0, 0);
    }
    // 로딩 중이면 아무것도 안 그림
  }

  ctx.restore();
}

/** 테스트 전용 — 이미지 캐시 초기화. */
export function _resetFaceStickerCache(): void {
  _imgCache.clear();
}
