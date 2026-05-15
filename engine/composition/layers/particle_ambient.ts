/**
 * engine/composition/layers/particle_ambient.ts
 *
 * Phase 5c — **앰비언트 파티클 레이어**.
 *
 *   화면 전체에 지속적으로 떠다니는 작은 입자들. 반복 순환하는 결정론적
 *   sin/cos drift 로 위치 계산 → 모듈 스코프 상태 없이 매 프레임 timeMs 에서
 *   재구성. StrictMode 더블 마운트에도 안전.
 *
 *   props:
 *     - count : number       (default 40)
 *     - preset : string      — 'electric_blue_rise' | 'glitter_down' | 'small_hearts_up' 등
 *     - colors : string[]    (preset 미지정 시 폴백)
 *     - sizeMin, sizeMax : number (px)
 *     - riseSpeedPx : number (초당 상승 속도, 음수면 하강)
 *     - driftAmpPx : number  (좌우 흔들림 진폭)
 */
import type { BaseLayer } from '../../templates/schema';

interface Preset {
  colors: string[];
  riseSpeedPx: number;
  driftAmpPx: number;
  sizeMin: number;
  sizeMax: number;
  shape: 'circle' | 'heart' | 'sparkle';
}

const PRESETS: Record<string, Preset> = {
  electric_blue_rise: { colors: ['#00E0FF', '#60a5fa', '#FF2D95'], riseSpeedPx: 40, driftAmpPx: 28, sizeMin: 2, sizeMax: 5, shape: 'circle' },
  glitter_down:       { colors: ['#FFD700', '#FFB6C1', '#FFFFFF'], riseSpeedPx: -30, driftAmpPx: 22, sizeMin: 2, sizeMax: 4, shape: 'sparkle' },
  small_hearts_up:    { colors: ['#FF2D95', '#FFB6C1', '#FF6FA4'], riseSpeedPx: 36, driftAmpPx: 18, sizeMin: 6, sizeMax: 12, shape: 'heart' },
};

function drawParticle(
  ctx: CanvasRenderingContext2D,
  shape: string, x: number, y: number, size: number,
): void {
  if (shape === 'heart') {
    // 작은 하트: 두 원 + 삼각형
    const s = size;
    ctx.beginPath();
    ctx.arc(x - s * 0.25, y - s * 0.1, s * 0.3, 0, Math.PI * 2);
    ctx.arc(x + s * 0.25, y - s * 0.1, s * 0.3, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.55, y);
    ctx.lineTo(x, y + s * 0.7);
    ctx.lineTo(x + s * 0.55, y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (shape === 'sparkle') {
    // 4-pointed sparkle (십자)
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.25, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.25, y + size * 0.25);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.25, y + size * 0.25);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.25, 0 + y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  _state: any,
): void {
  const props = (layer.props as any) || {};
  const count = Math.max(1, Math.min(200, (props.count as number) ?? 40));
  const presetName = (props.preset as string) || '';
  const preset = PRESETS[presetName] || PRESETS.electric_blue_rise;
  const colors: string[] = Array.isArray(props.colors) && props.colors.length > 0
    ? props.colors
    : preset.colors;
  const sizeMin = (props.sizeMin as number) ?? preset.sizeMin;
  const sizeMax = (props.sizeMax as number) ?? preset.sizeMax;
  const riseSpeed = (props.riseSpeedPx as number) ?? preset.riseSpeedPx;
  const driftAmp  = (props.driftAmpPx as number) ?? preset.driftAmpPx;

  const { width: W, height: H } = ctx.canvas;
  const t = timeMs / 1000;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  for (let i = 0; i < count; i++) {
    // 결정론적 pseudo-random 시드 (i 기반)
    const seedX = ((i * 9301 + 49297) % 233280) / 233280;
    const seedY = ((i * 73973 + 1013) % 139968) / 139968;
    const seedPhase = ((i * 31) % 100) / 100;
    const seedSize = ((i * 7919) % 100) / 100;

    // Y: 시간에 따라 H 높이를 순환
    const travel = H + 120;
    const yProgress = ((seedY * travel) + t * riseSpeed) % travel;
    const y = riseSpeed >= 0 ? H + 60 - yProgress : -60 + Math.abs(yProgress);
    // X: 초기 위치 + 좌우 sin drift
    const baseX = seedX * W;
    const x = baseX + Math.sin(t * 0.8 + seedPhase * Math.PI * 2) * driftAmp;

    const size = sizeMin + seedSize * (sizeMax - sizeMin);
    const color = colors[i % colors.length];

    // 약간의 반짝임: 사인 기반 알파 변조
    const twinkle = 0.7 + 0.3 * Math.sin(t * 2 + seedPhase * 6.28);
    ctx.globalAlpha = (layer.opacity ?? 1) * twinkle;
    ctx.fillStyle = color;
    drawParticle(ctx, preset.shape, x, y, size);
  }

  ctx.restore();
}
