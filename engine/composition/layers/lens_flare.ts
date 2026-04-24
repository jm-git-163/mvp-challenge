/**
 * engine/composition/layers/lens_flare.ts
 *
 * Phase 5c — **렌즈 플레어 레이어**.
 *
 *   화면 대각선을 따라 여러 원형 글로우(주광 + 고스트)를 'lighter' 합성으로 그림.
 *   시간에 따라 메인 소스가 천천히 움직여 입체감 부여.
 *
 *   props:
 *     - sourceX, sourceY : number (0~1 비율, default 0.85, 0.15 — 우상단)
 *     - color : string           (default '#FFE8B0')
 *     - intensity : number (0~1) (default 0.7)
 *     - ghostCount : number      (default 5)
 */
import type { BaseLayer } from '../../templates/schema';

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  _state: any,
): void {
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;
  const t = timeMs / 1000;

  const srcXR = (props.sourceX as number) ?? 0.85;
  const srcYR = (props.sourceY as number) ?? 0.15;
  // 천천히 움직이는 오프셋
  const sx = W * srcXR + Math.sin(t * 0.2) * 30;
  const sy = H * srcYR + Math.cos(t * 0.17) * 20;
  const color = (props.color as string) || '#FFE8B0';
  const intensity = Math.max(0, Math.min(1, (props.intensity as number) ?? 0.7));
  const ghostCount = Math.max(1, Math.min(10, (props.ghostCount as number) ?? 5));

  ctx.save();
  ctx.globalAlpha = (layer.opacity ?? 1) * intensity;
  ctx.globalCompositeOperation = 'lighter';

  // 메인 소스 (큰 글로우)
  const mainR = Math.max(W, H) * 0.35;
  const mainGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, mainR);
  mainGrad.addColorStop(0, color);
  mainGrad.addColorStop(0.35, `${color}80`);
  mainGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mainGrad;
  ctx.fillRect(0, 0, W, H);

  // 고스트 플레어들 (소스에서 화면 중앙 반대 방향으로)
  const cx = W / 2;
  const cy = H / 2;
  const dx = cx - sx;
  const dy = cy - sy;

  for (let i = 1; i <= ghostCount; i++) {
    const pos = i / (ghostCount + 1);
    // 반대쪽 대각선 방향으로 확장
    const gx = sx + dx * pos * 2.2;
    const gy = sy + dy * pos * 2.2;
    const radius = 30 + (i % 3) * 24;
    const alpha = 0.5 - i * 0.06;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    // 고스트별 색상 변조
    const hueShift = [color, '#B0E0FF', '#FFB0E0', '#E0FFB0', '#E0B0FF'][i % 5];
    g.addColorStop(0, hueShift);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (layer.opacity ?? 1) * intensity * Math.max(0.1, alpha);
    ctx.fillStyle = g;
    ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
  }

  ctx.restore();
}
