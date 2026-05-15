/**
 * engine/composition/layers/camera_frame.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import camera_frame from './camera_frame';
import type { BaseLayer } from '../../templates/schema';

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    strokeRect: vi.fn(), fillRect: vi.fn(),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, strokeStyle: '', fillStyle: '',
    lineWidth: 1, shadowColor: '', shadowBlur: 0,
  } as any;
}

const base: BaseLayer = { id: 'f', type: 'camera_frame', zIndex: 21, opacity: 1, enabled: true };

describe('camera_frame renderer', () => {
  it('기본 rectangle: save/restore + stroke', () => {
    const ctx = makeCtx();
    camera_frame(ctx, base, 0, {});
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('hexagon: 6각형 lineTo 5회 + closePath', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'hexagon', size: 300 } }, 100, {});
    // 첫 moveTo 1 + lineTo 5 = 6 정점
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(5);
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it('circle: arc 호출', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'circle' } }, 0, {});
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('polaroid: strokeRect + 핀 fill 4회', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'polaroid' } }, 0, {});
    expect(ctx.strokeRect).toHaveBeenCalled();
    // 핀 4개 arc+fill
    expect(ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('letterbox: 상·하 bar 2회 fillRect', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'letterbox' } }, 0, {});
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  it('beatIntensity 반영: glow 반경 증폭 (글로우 활성시)', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'hexagon', glowBlur: 10 } }, 0, { beatIntensity: 1 });
    // shadowBlur 은 최종값이 save 이후 세팅되어 있어야 함
    expect(ctx.shadowBlur).toBeGreaterThan(10);
  });

  it('미지정 kind → rectangle 폴백', () => {
    const ctx = makeCtx();
    camera_frame(ctx, { ...base, props: { kind: 'invalid-kind' as any } }, 0, {});
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('breath 효과: timeMs 변해도 에러 없음', () => {
    const ctx = makeCtx();
    expect(() => camera_frame(ctx, { ...base, props: { kind: 'hexagon' } }, 5000, {})).not.toThrow();
  });
});
