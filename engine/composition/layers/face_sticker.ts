/**
 * engine/composition/layers/face_sticker.ts
 *
 * Phase 5e — **얼굴 스티커 (AR) — 정밀 트래킹**.
 *
 * Phase 5 wave2 (2026-05-01): OneEuroFilter 적용 + blendshapes 반응.
 *   - 키 포인트(이마/양 볼/입꼬리/코끝) 좌표에 OneEuroFilter 적용 (지터 < 2px @ 30fps)
 *   - blendshapes(mouthSmile/eyeBlink) 로 스티커 변형:
 *       smile > 0.5 → scale 1.2 + 노란 글로우
 *       blink > 0.7 → 가로 0.3 squash 100ms
 *   - face roll: 양 볼 좌표로 계산 (faceAnchor.roll 우선, 없으면 cheeks 로 직접)
 *
 *   props:
 *     - asset : string     — URL 또는 이모지 문자.
 *     - sizePx : number    (default 80)
 *     - offsetX, offsetY : number (default 0)
 *     - anchorPoint : 'forehead' | 'nose' | 'left_cheek' | 'right_cheek' |
 *                     'mouth_left' | 'mouth_right' (default 'forehead')
 *     - reactToBlendshapes : boolean (default true)
 *
 *   state.faceAnchor: { nose, leftCheek, rightCheek, mouth, forehead, ..., roll, blendshapes }
 *   state.__trackedPoint[layer.id]: 상위 reactiveBinding 결과 (있으면 우선 사용).
 */
import type { BaseLayer } from '../../templates/schema';
import { OneEuroFilter } from '../../ar/oneEuroFilter';

// 이미지 캐시: URL → HTMLImageElement
const _imgCache = new Map<string, { img: HTMLImageElement; ok: boolean; failed: boolean }>();

// 레이어별 OneEuroFilter (x, y 독립).
// docs/PERFORMANCE §4 권장값: minCutoff=1.0, beta=0.007, dCutoff=1.0
interface FilterPair { x: OneEuroFilter; y: OneEuroFilter; lastBlinkMs: number; }
const _filters = new Map<string, FilterPair>();

function getFilters(layerId: string): FilterPair {
  let f = _filters.get(layerId);
  if (!f) {
    f = {
      x: new OneEuroFilter({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 }),
      y: new OneEuroFilter({ minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 }),
      lastBlinkMs: -Infinity,
    };
    _filters.set(layerId, f);
  }
  return f;
}

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

interface AnchorPick { x: number; y: number; }

function pickAnchorPoint(anchor: any, name: string): AnchorPick | null {
  if (!anchor) return null;
  switch (name) {
    case 'forehead':    return anchor.forehead ?? null;
    case 'nose':        return anchor.nose ?? null;
    case 'left_cheek':  return anchor.leftCheek ?? null;
    case 'right_cheek': return anchor.rightCheek ?? null;
    case 'mouth_left':  return anchor.mouthLeft ?? anchor.mouth ?? null;
    case 'mouth_right': return anchor.mouthRight ?? anchor.mouth ?? null;
    default:            return anchor.forehead ?? anchor.nose ?? null;
  }
}

function computeRoll(anchor: any): number {
  if (anchor && Number.isFinite(anchor.roll)) return anchor.roll;
  // cheeks 로 fallback 계산
  const lc = anchor?.leftCheek, rc = anchor?.rightCheek;
  if (lc && rc && Number.isFinite(lc.x) && Number.isFinite(rc.x)) {
    return Math.atan2(rc.y - lc.y, rc.x - lc.x);
  }
  return 0;
}

function resolvePoint(layer: BaseLayer, state: any, W: number, H: number, timeMs: number, anchorName: string): { x: number; y: number; rot: number; scale: number; rawSrc: 'tracked' | 'anchor' | 'fallback' } {
  const rect = state?.cameraRect;
  const rx = rect && Number.isFinite(rect.x) ? rect.x : 0;
  const ry = rect && Number.isFinite(rect.y) ? rect.y : 0;
  const rw = rect && Number.isFinite(rect.w) && rect.w > 0 ? rect.w : W;
  const rh = rect && Number.isFinite(rect.h) && rect.h > 0 ? rect.h : H;

  const tracked = state?.__trackedPoint?.[layer.id];
  if (tracked && Number.isFinite(tracked.x) && Number.isFinite(tracked.y)) {
    const isNorm = Math.abs(tracked.x) <= 1 && Math.abs(tracked.y) <= 1;
    const px = isNorm ? rx + tracked.x * rw : tracked.x;
    const py = isNorm ? ry + tracked.y * rh : tracked.y;
    return {
      x: px, y: py,
      rot: Number.isFinite(tracked.rot) ? tracked.rot : 0,
      scale: Number.isFinite(tracked.scale) ? tracked.scale : 1,
      rawSrc: 'tracked',
    };
  }
  const anchor = state?.faceAnchor;
  // anchorPoint prop 우선, 없으면 reactive.track.landmark, 없으면 forehead.
  const lm = anchorName ?? (layer as any).reactive?.track?.landmark ?? 'forehead';
  const pt = pickAnchorPoint(anchor, lm);
  if (anchor && pt && Number.isFinite(pt.x)) {
    const isNorm = Math.abs(pt.x) <= 1 && Math.abs(pt.y) <= 1;
    const px = isNorm ? rx + pt.x * rw : pt.x;
    const py = isNorm ? ry + pt.y * rh : pt.y;
    return { x: px, y: py, rot: computeRoll(anchor), scale: anchor.faceSize ? Math.max(0.5, Math.min(2, anchor.faceSize * 4)) : 1, rawSrc: 'anchor' };
  }
  return { x: rx + rw / 2, y: ry + rh * 0.25, rot: 0, scale: 1, rawSrc: 'fallback' };
}

function isEmojiLike(s: string): boolean {
  if (!s) return true;
  if (s.startsWith('/') || s.startsWith('http') || s.startsWith('.')) return false;
  return s.length <= 6;
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const props = (layer.props as any) || {};
  const asset = String(props.asset ?? '😎');
  const sizePx = Math.max(8, (props.sizePx as number) ?? 80);
  const offX = (props.offsetX as number) ?? 0;
  const offY = (props.offsetY as number) ?? 0;
  const anchorName = String(props.anchorPoint ?? 'forehead');
  const reactBs = props.reactToBlendshapes !== false;

  const { width: W, height: H } = ctx.canvas;
  const raw = resolvePoint(layer, state, W, H, timeMs, anchorName);

  // OneEuroFilter — 키 포인트 좌표 스무딩 (지터 제거).
  // tracked source 는 이미 외부에서 스무딩됐다고 가정, anchor source 만 적용.
  const f = getFilters(layer.id);
  const x = raw.rawSrc === 'anchor' ? f.x.filter(raw.x, timeMs) : raw.x;
  const y = raw.rawSrc === 'anchor' ? f.y.filter(raw.y, timeMs) : raw.y;
  const rot = raw.rot;
  let scale = raw.scale;

  // ── Blendshapes 반응 ───────────────────────────────────────
  let glowYellow = false;
  let squashX = 1;
  if (reactBs) {
    const bs = state?.faceAnchor?.blendshapes ?? state?.blendshapes;
    if (bs) {
      const smileL = Number(bs.mouthSmileLeft ?? 0);
      const smileR = Number(bs.mouthSmileRight ?? 0);
      const smile = Math.max(smileL, smileR);
      if (smile > 0.5) {
        scale *= 1.2;
        glowYellow = true;
      }
      const blinkL = Number(bs.eyeBlinkLeft ?? 0);
      const blinkR = Number(bs.eyeBlinkRight ?? 0);
      const blink = Math.max(blinkL, blinkR);
      if (blink > 0.7) {
        f.lastBlinkMs = timeMs;
      }
      const sinceBlink = timeMs - f.lastBlinkMs;
      if (sinceBlink >= 0 && sinceBlink < 100) {
        // squash to 0.3 over 100ms (linear ease: peak at start, recover linearly)
        const t = sinceBlink / 100;
        const minSquash = 0.3;
        squashX = minSquash + (1 - minSquash) * t;
      }
    }
  }

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.translate(x + offX, y + offY);
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);
  if (squashX !== 1) ctx.scale(squashX, 1);

  if (glowYellow) {
    ctx.shadowColor = '#FFD23F';
    ctx.shadowBlur = sizePx * 0.4;
  }

  if (isEmojiLike(asset)) {
    ctx.font = `${sizePx}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.fillText(asset, 0, 0); } catch { /* ignore */ }
  } else {
    const entry = getImage(asset);
    if (entry && entry.ok) {
      try {
        ctx.drawImage(entry.img, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
      } catch {
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
  }

  ctx.restore();
}

/** 테스트 전용 — 캐시 + 필터 초기화. */
export function _resetFaceStickerCache(): void {
  _imgCache.clear();
  _filters.clear();
}
