/**
 * engine/composition/layers/video_bg.ts
 *
 * PIXABAY-VIDEO 2026-05-02 — 무빙 배경 비디오 레이어.
 *
 * 동작:
 *  - HTMLVideoElement 를 동적으로 1회 생성·캐시 (모듈 레벨 Map<src, video>).
 *  - loop, muted, playsInline, autoplay 로 무한 백그라운드 루프.
 *  - 매 프레임 ctx.drawImage 로 캔버스에 합성. cover 핏(짧은 변 기준 확대).
 *  - readyState < 2 일 때 검은 배경 폴백 (gradient_mesh 등 아래 레이어가 보이도록 transparent 도 옵션).
 *  - Platform.OS !== 'web' 또는 document 미존재 환경에서 no-op.
 *
 * props:
 *  - src       (string, required)   비디오 경로 (예: '/templates/squat-master/bg-loop.mp4').
 *  - blur      (number, default 0)  canvas filter blur(px).
 *  - blendMode (string, optional)   ctx.globalCompositeOperation 값.
 *  - fit       ('cover'|'contain', default 'cover').
 *
 * dispose:
 *  - 본 모듈은 페이지 라이프타임 동안 비디오 element 를 유지한다 (재사용 시 자동 폴백).
 *    챌린지 종료 시 명시적으로 disposeVideoBgCache() 호출 권장.
 */
import { BaseLayer } from '../../templates/schema';

// ── 모듈 레벨 캐시 ──────────────────────────────────────────
const VIDEO_CACHE = new Map<string, HTMLVideoElement>();

function getOrCreateVideo(src: string): HTMLVideoElement | null {
  // SSR / non-web 가드
  if (typeof document === 'undefined') return null;
  const cached = VIDEO_CACHE.get(src);
  if (cached) return cached;
  try {
    const el = document.createElement('video');
    el.src = src;
    el.loop = true;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    // off-DOM, but try to play (autoplay policies allow muted+inline).
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* will retry on next frame */ });
    VIDEO_CACHE.set(src, el);
    return el;
  } catch {
    return null;
  }
}

/**
 * 챌린지 종료/언마운트 시 호출하여 video element 메모리 해제.
 */
export function disposeVideoBgCache(): void {
  for (const v of VIDEO_CACHE.values()) {
    try { v.pause(); } catch {}
    try { v.removeAttribute('src'); v.load(); } catch {}
  }
  VIDEO_CACHE.clear();
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  _state: any
): void {
  const { width, height } = ctx.canvas;
  const props = (layer.props ?? {}) as Record<string, unknown>;
  const src = typeof props.src === 'string' ? (props.src as string) : '';
  const blur = typeof props.blur === 'number' ? (props.blur as number) : 0;
  const blendMode = typeof props.blendMode === 'string' ? (props.blendMode as string) : undefined;
  const fit = props.fit === 'contain' ? 'contain' : 'cover';

  if (!src) return;

  const video = getOrCreateVideo(src);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  if (blendMode) ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
  if (blur > 0) ctx.filter = `blur(${blur}px)`;

  if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    // Auto-resume if paused (autoplay policy may pause briefly).
    if (video.paused) { try { video.play().catch(() => {}); } catch {} }

    const sAspect = video.videoWidth / video.videoHeight;
    const dAspect = width / height;
    let sw: number, sh: number, sx: number, sy: number;

    if (fit === 'cover') {
      if (sAspect > dAspect) {
        // Source wider — crop sides
        sh = video.videoHeight;
        sw = sh * dAspect;
        sx = (video.videoWidth - sw) / 2;
        sy = 0;
      } else {
        sw = video.videoWidth;
        sh = sw / dAspect;
        sx = 0;
        sy = (video.videoHeight - sh) / 2;
      }
      try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height); } catch { /* video not ready */ }
    } else {
      // contain — letterbox
      let dw: number, dh: number, dx: number, dy: number;
      if (sAspect > dAspect) {
        dw = width; dh = width / sAspect; dx = 0; dy = (height - dh) / 2;
      } else {
        dh = height; dw = height * sAspect; dy = 0; dx = (width - dw) / 2;
      }
      try { ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, dx, dy, dw, dh); } catch {}
    }
  } else {
    // Fallback: black fill (so post-fx still has signal). Underlying layers may show through with opacity < 1.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}
