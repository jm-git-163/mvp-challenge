/**
 * engine/composition/layers/camera_feed.ts
 *
 * FIX-SHARE-CAMERA-FINAL (2026-04-24): 사용자 피드백 "셀피 시 얼굴이 화면을
 *   꽉 채워 너무 가까워 보인다" → 기본 프레이밍에 중앙 정렬 padding 적용.
 *
 *   layer.props.scale  (0.60 ~ 1.00, 기본 0.90)
 *     - 1.00: 풀스크린 (기존 동작). 스쿼트·피트니스처럼 전신 담으려면 1.0.
 *     - 0.90: 상하좌우 ~5% 여백. 얼굴 미디엄 샷.
 *     - 0.80: 상하좌우 ~10% 여백. 얼굴 클로즈업 방지.
 *   layer.props.bgColor (선택): 여백 배경색. 지정 안 되면 투명 (뒤 배경 레이어
 *     가 보이도록).
 *
 *   dest rect 는 canvas 중앙. AR 스티커/손 이모지는 동일 dest rect 를 참조하도록
 *   state.cameraRect 에 기록한다 → MediaPipe normalized 좌표를 dest rect 로
 *   매핑하는 레이어들이 축소된 카메라 위에서도 정확히 정렬됨.
 */
import { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any
): void {
  const { width, height } = ctx.canvas;
  const video = state.videoEl as HTMLVideoElement | undefined;

  const propsAny = (layer.props ?? {}) as Record<string, unknown>;
  const rawScale = typeof propsAny.scale === 'number' ? (propsAny.scale as number) : 0.90;
  const scale = Math.min(1, Math.max(0.6, rawScale));
  const dw = Math.round(width * scale);
  const dh = Math.round(height * scale);
  const dx = Math.round((width - dw) / 2);
  const dy = Math.round((height - dh) / 2);

  // Expose dest rect so AR layers (face_sticker, hand_emoji) can align to it.
  try { state.cameraRect = { x: dx, y: dy, w: dw, h: dh }; } catch {}

  ctx.save();
  ctx.globalAlpha = layer.opacity;

  if (video && video.readyState >= 2) {
    const sAspect = video.videoWidth / video.videoHeight;
    const dAspect = dw / dh;
    let sw: number, sh: number, sx: number, sy: number;

    if (sAspect > dAspect) {
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

    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    // Fallback fill only on the camera rect, leave padding transparent.
    ctx.fillStyle = '#000';
    ctx.fillRect(dx, dy, dw, dh);
  }

  ctx.restore();
}
