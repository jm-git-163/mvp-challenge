/**
 * engine/composition/layers/camera_reflection.ts
 *
 * Phase 5a — **카메라 피드 반사(Y 반전) 레이어**.
 *
 *   camera_feed 레이어 바로 아래(zIndex +1) 에 배치하여 바닥 반사 효과.
 *   state.videoEl (HTMLVideoElement) 을 drawImage 로 Y 축 반전 + 알파 그라디언트.
 *
 *   props:
 *     - heightRatio : number (0~1, default 0.35) — 캔버스 높이 대비 반사 영역
 *     - fadeFrom : number (0~1, default 0.4) — 상단 알파 시작값
 *     - fadeTo : number (0~1, default 0, 하단)
 *     - blurPx : number (default 6) — filter blur
 */
import type { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const video = state?.videoEl as HTMLVideoElement | undefined;
  if (!video || !video.videoWidth || video.readyState < 2) return;

  const props = (layer.props as any) || {};
  const heightRatio = Math.max(0.05, Math.min(0.6, (props.heightRatio as number) ?? 0.35));
  const fadeFrom = Math.max(0, Math.min(1, (props.fadeFrom as number) ?? 0.4));
  const fadeTo = Math.max(0, Math.min(1, (props.fadeTo as number) ?? 0));
  const blurPx = (props.blurPx as number) ?? 6;

  const { width: W, height: H } = ctx.canvas;
  const reflectH = H * heightRatio;
  const yStart = H - reflectH;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  // 클리핑 영역 (반사 구역)
  ctx.beginPath();
  ctx.rect(0, yStart, W, reflectH);
  ctx.clip();

  // Y 반전 + 블러
  ctx.translate(0, H);
  ctx.scale(1, -1);
  // 반전 후에는 원래 좌표계에서 viewport 가 아래에서 위로 뒤집힘 → yStart 재계산
  // 반사 영역은 원래 캔버스 상단 reflectH 만큼을 그려서 바닥에 나타나게
  try {
    (ctx as any).filter = `blur(${blurPx}px)`;
    ctx.drawImage(video, 0, 0, W, reflectH);
    (ctx as any).filter = 'none';
  } catch {
    // 일부 브라우저 filter 미지원 → 블러 생략
    try { ctx.drawImage(video, 0, 0, W, reflectH); } catch { /* 무시 */ }
  }

  ctx.restore();

  // 페이드 오버레이 (원래 좌표계에서)
  ctx.save();
  const grad = ctx.createLinearGradient(0, yStart, 0, H);
  // 상단이 덜 투명, 하단이 완전 투명(위→아래로 사라짐)
  grad.addColorStop(0, `rgba(0,0,0,${1 - fadeFrom})`);
  grad.addColorStop(1, `rgba(0,0,0,${1 - fadeTo})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, yStart, W, reflectH);
  ctx.restore();
}
