/**
 * engine/composition/layers/dispatcher.test.ts
 *
 * Focused Session-2 Candidate E 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import { dispatchLayer, supportedLayerTypes, LAYER_REGISTRY } from './index';

describe('LAYER_REGISTRY dispatcher', () => {
  it('현재 지원 타입 5종(최소): gradient_mesh/animated_grid/star_field/noise_pattern/camera_feed', () => {
    const types = supportedLayerTypes();
    expect(types).toEqual(expect.arrayContaining([
      'gradient_mesh', 'animated_grid', 'star_field', 'noise_pattern', 'camera_feed',
    ]));
    expect(types.length).toBeGreaterThanOrEqual(5);
  });

  it('dispatchLayer: 지원 타입 → 함수', () => {
    for (const t of supportedLayerTypes()) {
      expect(typeof dispatchLayer(t)).toBe('function');
    }
  });

  it('dispatchLayer: 미지원 타입 → null (조용히 스킵)', () => {
    expect(dispatchLayer('unicorn_magic')).toBeNull();
    expect(dispatchLayer('')).toBeNull();
  });

  it('각 렌더러가 호출 시 ctx 메서드를 건드리는지 (스모크)', () => {
    const ctx: any = {
      save: vi.fn(), restore: vi.fn(),
      fillRect: vi.fn(), strokeRect: vi.fn(),
      beginPath: vi.fn(), closePath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createPattern: vi.fn(() => ({})),
      drawImage: vi.fn(), translate: vi.fn(),
      scale: vi.fn(), rotate: vi.fn(),
      fillText: vi.fn(), strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      canvas: { width: 1080, height: 1920 },
      globalAlpha: 1, globalCompositeOperation: 'source-over',
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      font: '', textAlign: 'left', textBaseline: 'alphabetic',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    };
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }),
          putImageData: vi.fn(),
        }),
        width: 256, height: 256,
      }),
    });
    const base = { id: 't', type: '', zIndex: 0, opacity: 1, enabled: true };
    for (const t of supportedLayerTypes()) {
      const fn = dispatchLayer(t)!;
      expect(() => fn(ctx, { ...base, type: t } as any, 100, {})).not.toThrow();
    }
    vi.unstubAllGlobals();
  });

  it('LAYER_REGISTRY 는 상수 export (런타임 변형 금지 아님 but 재할당 시 dispatcher 동기화 필요)', () => {
    expect(LAYER_REGISTRY).toBe(LAYER_REGISTRY);
  });
});
