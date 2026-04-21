/**
 * engine/composition/layers/camera_frame.ts
 *
 * Focused Session-2 Candidate A: 카메라 영역 주위에 그리는 **장식 프레임**.
 *
 * 종류:
 *   - rectangle : 둥근 사각형(cornerRadius)
 *   - hexagon   : 정육각형 (사이버펑크 K-POP 기본)
 *   - circle    : 원형 (하트 계열/감성)
 *   - polaroid  : 하단 여백 큰 사각 (레트로)
 *   - letterbox : 상·하 검은 바 (시네마틱)
 *
 * 본 레이어는 **프레임 자체(테두리·글로우)만 그리고** 카메라 피드 마스킹은 하지 않는다.
 * (카메라 피드 클리핑은 `camera_feed` 레이어 또는 글로벌 canvas clip 으로 분리.)
 *
 * Reactive:
 *   state.beatIntensity (0~1) 가 있으면 테두리 opacity·글로우 반경이 일시 증폭.
 */
import { BaseLayer } from '../../templates/schema';

export type FrameKind =
  | 'rectangle'
  | 'hexagon'
  | 'circle'
  | 'polaroid'
  | 'letterbox';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const { width, height } = ctx.canvas;
  const props = layer.props || {};
  const kind: FrameKind = (props.kind as FrameKind) || 'rectangle';

  const cx = (props.centerX as number) ?? width / 2;
  const cy = (props.centerY as number) ?? height / 2;
  const size = (props.size as number) ?? Math.min(width, height) * 0.4;

  const ringColor = (props.ringColor as string) || '#FFFFFF';
  const ringWidth = (props.ringWidth as number) || 2;
  const glowBlurBase = (props.glowBlur as number) || 0;
  const cornerRadius = (props.cornerRadius as number) ?? 24;

  const beat = Number.isFinite(state?.beatIntensity) ? Math.max(0, Math.min(1, state.beatIntensity)) : 0;
  const glowBlur = glowBlurBase * (1 + beat * 0.6);
  const alpha = layer.opacity * (1 + beat * 0.15);

  // 미묘한 브리딩 (시간 기반 1.0±4%) — 정적 느낌 방지
  const breath = 1 + Math.sin(timeMs / 1800) * 0.04;
  const effSize = size * breath;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = ringWidth;
  if (glowBlur > 0) {
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = glowBlur;
  }

  switch (kind) {
    case 'hexagon':
      drawHexagon(ctx, cx, cy, effSize);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, effSize, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'polaroid':
      drawPolaroid(ctx, cx, cy, effSize, ringColor);
      break;
    case 'letterbox':
      drawLetterbox(ctx, width, height, (props.barHeightPct as number) ?? 0.12, ringColor);
      break;
    case 'rectangle':
    default:
      drawRoundedRect(ctx, cx - effSize, cy - effSize * 1.5, effSize * 2, effSize * 3, cornerRadius);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, color: string,
): void {
  // 메인 프레임 (세로로 긴 사각)
  const fw = size * 2;
  const fh = size * 2.4;
  const x = cx - fw / 2;
  const y = cy - size;
  ctx.strokeRect(x, y, fw, fh);
  // 하단 여백선 (폴라로이드 느낌)
  ctx.beginPath();
  ctx.moveTo(x, y + size * 2);
  ctx.lineTo(x + fw, y + size * 2);
  ctx.stroke();
  // 모서리 점 4개 (사진 고정 핀 느낌)
  ctx.fillStyle = color;
  const pinR = 4;
  [[x + 16, y + 16], [x + fw - 16, y + 16], [x + 16, y + fh - 16], [x + fw - 16, y + fh - 16]]
    .forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, pinR, 0, Math.PI * 2);
      ctx.fill();
    });
}

function drawLetterbox(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  barPct: number, color: string,
): void {
  const bar = height * Math.max(0.05, Math.min(0.3, barPct));
  ctx.fillStyle = color === '#FFFFFF' ? '#000000' : color; // 화이트면 검은 바
  ctx.fillRect(0, 0, width, bar);
  ctx.fillRect(0, height - bar, width, bar);
}
