/**
 * engine/composition/layers/index.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import gradient_mesh from './gradient_mesh';
import animated_grid from './animated_grid';
import star_field from './star_field';
import noise_pattern from './noise_pattern';
import camera_feed from './camera_feed';
import { BaseLayer } from '../../templates/schema';

function makeCtx() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createPattern: vi.fn(() => ({})),
    drawImage: vi.fn(),
    translate: vi.fn(),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as any;
  return ctx;
}

const baseLayer: BaseLayer = {
  id: 'test',
  type: 'gradient_mesh',
  zIndex: 1,
  opacity: 1,
  enabled: true,
};

describe('Layer Renderers', () => {
  it('gradient_mesh: 렌더 시 fillRect 호출 확인', () => {
    const ctx = makeCtx();
    gradient_mesh(ctx, { ...baseLayer, props: { colors: ['#f00', '#0f0'] } }, 0, {});
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('gradient_mesh: rotatePeriodSec 에 따라 회전 값이 변화해도 에러 없음', () => {
    const ctx = makeCtx();
    expect(() => gradient_mesh(ctx, baseLayer, 1000, {})).not.toThrow();
  });

  it('animated_grid: perspective 모드에서 라인 그리기 확인', () => {
    const ctx = makeCtx();
    animated_grid(ctx, { ...baseLayer, props: { perspective: true } }, 0, {});
    expect(ctx.lineTo).toHaveBeenCalled();
  });

  it('animated_grid: 2D 모드에서도 정상 동작', () => {
    const ctx = makeCtx();
    animated_grid(ctx, { ...baseLayer, props: { perspective: false } }, 0, {});
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('star_field: count 만큼 별 그리기 시도', () => {
    const ctx = makeCtx();
    star_field(ctx, { ...baseLayer, props: { count: 50 } }, 0, {});
    expect(ctx.fill).toHaveBeenCalledTimes(50);
  });

  it('star_field: driftPxPerSec 에 따라 위치 변화 확인 (에러 없음)', () => {
    const ctx = makeCtx();
    expect(() => star_field(ctx, baseLayer, 1000, {})).not.toThrow();
  });

  it('noise_pattern: 패턴 생성 및 렌더링 확인', () => {
    // jsdom 환경이 아니므로 document.createElement mock 필요할 수 있음
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }),
          putImageData: vi.fn(),
        }),
        width: 256,
        height: 256,
      })
    });
    const ctx = makeCtx();
    noise_pattern(ctx, baseLayer, 0, {});
    expect(ctx.createPattern).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('noise_pattern: opacity 반영 확인', () => {
    const ctx = makeCtx();
    noise_pattern(ctx, { ...baseLayer, opacity: 0.5 }, 0, {});
    expect(ctx.globalAlpha).toBe(0.5);
  });

  it('camera_feed: 비디오 엘리먼트 없을 때 검은 화면 폴백', () => {
    const ctx = makeCtx();
    camera_feed(ctx, baseLayer, 0, {});
    expect(ctx.fillStyle).toBe('#000');
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('camera_feed: 비디오 엘리먼트 있을 때 drawImage 호출', () => {
    const ctx = makeCtx();
    const video = { readyState: 4, videoWidth: 100, videoHeight: 100 } as any;
    camera_feed(ctx, baseLayer, 0, { videoEl: video });
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});
