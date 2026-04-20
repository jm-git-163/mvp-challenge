import { describe, it, expect, vi } from 'vitest';
import {
  buildCssFilter,
  applyProceduralOverlays,
  drawVignette,
  drawScanlines,
  drawFilmGrain,
  makeSeededRng,
} from './postProcess2d';

function makeMockCtx(W = 100, H = 100) {
  const calls: string[] = [];
  const ctx = {
    filter: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.push(`fillRect(${x},${y},${w},${h})`);
    }),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls, W, H };
}

describe('buildCssFilter', () => {
  it('빈 배열 → 빈 문자열', () => {
    expect(buildCssFilter([])).toBe('');
  });
  it('bloom+saturation 포함', () => {
    const s = buildCssFilter([
      { kind: 'bloom', intensity: 0.5 },
      { kind: 'saturation', intensity: 0.3 },
    ]);
    expect(s).toContain('brightness');
    expect(s).toContain('blur');
    expect(s).toContain('saturate');
  });
  it('lut_mono → grayscale + contrast', () => {
    const s = buildCssFilter([{ kind: 'lut_mono', intensity: 0.8 }]);
    expect(s).toContain('grayscale(0.800)');
    expect(s).toContain('contrast');
  });
  it('절차적 kind 는 ctx.filter 에 포함 안 함', () => {
    const s = buildCssFilter([
      { kind: 'vignette', intensity: 0.5 },
      { kind: 'crt_scanlines', intensity: 0.2 },
      { kind: 'film_grain', intensity: 0.3 },
    ]);
    expect(s).toBe('');
  });
});

describe('drawVignette', () => {
  it('radial gradient + fillRect 호출', () => {
    const { ctx } = makeMockCtx();
    drawVignette(ctx, 100, 100, 0.5);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});

describe('drawScanlines', () => {
  it('fillRect 는 2px 간격으로 H/2 회 호출', () => {
    const { ctx, calls } = makeMockCtx();
    drawScanlines(ctx, 100, 10, 0.2);
    const fills = calls.filter((c) => c.startsWith('fillRect'));
    expect(fills).toHaveLength(5); // y=0,2,4,6,8
  });
});

describe('drawFilmGrain', () => {
  it('결정적 rng 주입 시 동일 결과', () => {
    const m1 = makeMockCtx();
    const m2 = makeMockCtx();
    const rng1 = makeSeededRng(42);
    const rng2 = makeSeededRng(42);
    drawFilmGrain({ ctx: m1.ctx, width: 100, height: 100, tMs: 0, rng: rng1 }, 0.1);
    drawFilmGrain({ ctx: m2.ctx, width: 100, height: 100, tMs: 0, rng: rng2 }, 0.1);
    expect(m1.calls).toEqual(m2.calls);
  });
});

describe('makeSeededRng', () => {
  it('결정적', () => {
    const a = makeSeededRng(1);
    const b = makeSeededRng(1);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('값 범위 [0,1)', () => {
    const r = makeSeededRng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('다른 seed → 다른 시퀀스', () => {
    const a = makeSeededRng(1)();
    const b = makeSeededRng(2)();
    expect(a).not.toBe(b);
  });
});

describe('applyProceduralOverlays', () => {
  it('vignette + scanlines 합성 호출', () => {
    const { ctx } = makeMockCtx();
    applyProceduralOverlays(
      { ctx, width: 100, height: 100, tMs: 0, rng: makeSeededRng(1) },
      [
        { kind: 'vignette', intensity: 0.3 },
        { kind: 'crt_scanlines', intensity: 0.2 },
      ],
    );
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('onset 부스트 반영 — onset=1, boost=2 → 유효 intensity 3배', () => {
    const { ctx } = makeMockCtx();
    const radialSpy = vi.spyOn(ctx, 'createRadialGradient');
    applyProceduralOverlays(
      { ctx, width: 100, height: 100, tMs: 0, onset: 1 },
      [{ kind: 'vignette', intensity: 0.2, onsetBoost: 2 }],
    );
    expect(radialSpy).toHaveBeenCalled();
  });
});
