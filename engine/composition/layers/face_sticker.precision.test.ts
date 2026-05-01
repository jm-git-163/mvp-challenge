/**
 * face_sticker precision test — Phase 5 wave2 (2026-05-01).
 *
 * 30fps 노이즈 입력 → OneEuroFilter 적용 후 출력 지터 < 2px 검증.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import render, { _resetFaceStickerCache } from './face_sticker';

// 가짜 ctx — 좌표 호출만 캡처.
function makeCtx(W = 360, H = 640) {
  const calls: any[] = [];
  const stack: Array<{ tx: number; ty: number; sx: number; sy: number; rot: number }> = [
    { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 },
  ];
  const top = () => stack[stack.length - 1];
  const ctx: any = {
    canvas: { width: W, height: H },
    save() { stack.push({ ...top() }); },
    restore() { if (stack.length > 1) stack.pop(); },
    translate(x: number, y: number) { const m = top(); m.tx += x; m.ty += y; },
    rotate(r: number) { top().rot += r; },
    scale(sx: number, sy: number) { const m = top(); m.sx *= sx; m.sy *= sy; },
    set globalAlpha(_v: number) {},
    set shadowColor(_v: string) {},
    set shadowBlur(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
    fillText(t: string, x: number, y: number) {
      const m = top();
      calls.push({ t, x: x + m.tx, y: y + m.ty });
    },
    drawImage() {},
  };
  return { ctx, calls };
}

const layer: any = {
  id: 'fs1',
  type: 'face_sticker',
  zIndex: 10,
  opacity: 1,
  enabled: true,
  props: { asset: '😎', sizePx: 80, anchorPoint: 'forehead' },
};

describe('face_sticker precision (OneEuroFilter)', () => {
  beforeEach(() => _resetFaceStickerCache());

  it('reduces jitter < 2px at 30fps for static face with noise', () => {
    const { ctx, calls } = makeCtx();
    // 정적 얼굴 좌표 (정규화 0.5,0.3) + ±1% 노이즈 (캔버스 360 → ±3.6px 입력 노이즈).
    const baseX = 0.5, baseY = 0.3;
    const W = 360, H = 640;
    const fps = 30;
    const dt = 1000 / fps;

    // 결정론 노이즈: 사인+코사인 합성
    const noise = (i: number) => ({
      x: Math.sin(i * 1.3) * 0.01,
      y: Math.cos(i * 1.7) * 0.01,
    });

    for (let i = 0; i < 60; i++) {
      const n = noise(i);
      const state = {
        faceAnchor: {
          forehead: { x: baseX + n.x, y: baseY + n.y },
          leftCheek: { x: 0.4, y: 0.35 },
          rightCheek: { x: 0.6, y: 0.35 },
          roll: 0,
          faceSize: 0.25,
        },
      };
      render(ctx, layer, i * dt, state);
    }

    // warm-up 첫 10프레임 제외, 나머지에서 인접 프레임 간 좌표 변동 측정.
    const tail = calls.slice(10);
    let maxDelta = 0;
    for (let i = 1; i < tail.length; i++) {
      const dx = Math.abs(tail[i].x - tail[i - 1].x);
      const dy = Math.abs(tail[i].y - tail[i - 1].y);
      const d = Math.max(dx, dy);
      if (d > maxDelta) maxDelta = d;
    }
    expect(maxDelta).toBeLessThan(2);
  });

  it('no faceAnchor → fallback to camera rect center top', () => {
    const { ctx, calls } = makeCtx(360, 640);
    render(ctx, layer, 0, {});
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].x).toBe(180);
    expect(calls[0].y).toBe(160);
  });
});
