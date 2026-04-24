import { describe, it, expect, vi } from 'vitest';
import { LayerEngine, type LayerRenderer, type FrameContext } from './layerEngine';
import type { BaseLayer } from '../templates/schema';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as string,
  };
}

function spec(overrides: Partial<BaseLayer> & { id: string; zIndex: number }): BaseLayer {
  return {
    type: 'gradient_mesh',
    opacity: 1,
    enabled: true,
    ...overrides,
  } as BaseLayer;
}

function mkRenderer(): LayerRenderer & { calls: { enter: number; render: number; exit: number }; lastFc: FrameContext | null } {
  const calls = { enter: 0, render: 0, exit: 0 };
  let lastFc: FrameContext | null = null;
  return {
    calls,
    lastFc,
    onEnter: vi.fn(() => { calls.enter++; }),
    onExit: vi.fn(() => { calls.exit++; }),
    render: vi.fn((fc: FrameContext) => { calls.render++; lastFc = fc; }),
    get lastFc() { return lastFc; },
  } as LayerRenderer & { calls: { enter: number; render: number; exit: number }; lastFc: FrameContext | null };
}

describe('LayerEngine: 등록/삭제', () => {
  it('addLayer 후 layerCount 증가', () => {
    const eng = new LayerEngine(makeCtx(), 1080, 1920);
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), mkRenderer());
    expect(eng.layerCount()).toBe(1);
  });
  it('중복 id throw', () => {
    const eng = new LayerEngine(makeCtx(), 1080, 1920);
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), mkRenderer());
    expect(() => eng.addLayer(spec({ id: 'a', zIndex: 2 }), mkRenderer())).toThrow(/중복/);
  });
  it('removeLayer로 제거', () => {
    const eng = new LayerEngine(makeCtx(), 1080, 1920);
    const off = eng.addLayer(spec({ id: 'a', zIndex: 1 }), mkRenderer());
    off();
    expect(eng.layerCount()).toBe(0);
  });
});

describe('LayerEngine: zIndex 정렬', () => {
  it('추가 순서와 무관하게 zIndex 오름차순', () => {
    const eng = new LayerEngine(makeCtx(), 1080, 1920);
    eng.addLayer(spec({ id: 'c', zIndex: 30 }), mkRenderer());
    eng.addLayer(spec({ id: 'a', zIndex: 10 }), mkRenderer());
    eng.addLayer(spec({ id: 'b', zIndex: 20 }), mkRenderer());
    expect(eng.getLayerOrder()).toEqual(['a', 'b', 'c']);
  });
});

describe('LayerEngine: 렌더 사이클', () => {
  it('enabled=true면 render 호출, ctx.save/restore 감싸짐', () => {
    const ctx = makeCtx();
    const eng = new LayerEngine(ctx, 100, 100);
    const r = mkRenderer();
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), r);
    eng.renderFrame(0);
    expect(r.calls.render).toBe(1);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('enabled=false면 render 호출 안 함', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const r = mkRenderer();
    eng.addLayer(spec({ id: 'a', zIndex: 1, enabled: false }), r);
    eng.renderFrame(0);
    expect(r.calls.render).toBe(0);
  });

  it('activeRange 밖은 skip, 안은 render', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const r = mkRenderer();
    eng.addLayer(spec({ id: 'a', zIndex: 1, activeRange: { startSec: 2, endSec: 5 } }), r);
    eng.renderFrame(1000);  // 1초 — skip
    eng.renderFrame(3000);  // 3초 — render
    eng.renderFrame(6000);  // 6초 — skip
    expect(r.calls.render).toBe(1);
  });

  it('전이 시 onEnter/onExit 1회씩', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const r = mkRenderer();
    eng.addLayer(spec({ id: 'a', zIndex: 1, activeRange: { startSec: 2, endSec: 4 } }), r);
    eng.renderFrame(1000); // inactive
    eng.renderFrame(3000); // active (enter)
    eng.renderFrame(3500); // active (계속)
    eng.renderFrame(5000); // inactive (exit)
    expect(r.calls.enter).toBe(1);
    expect(r.calls.exit).toBe(1);
    expect(r.calls.render).toBe(2);
  });

  it('globalAlpha가 spec.opacity로 세팅된 채 render 됨', () => {
    const ctx = makeCtx();
    const eng = new LayerEngine(ctx, 100, 100);
    let seen = -1;
    const r: LayerRenderer = { render: () => { seen = ctx.globalAlpha; } };
    eng.addLayer(spec({ id: 'a', zIndex: 1, opacity: 0.4 }), r);
    eng.renderFrame(0);
    expect(seen).toBeCloseTo(0.4);
  });

  it('blendMode가 설정되면 globalCompositeOperation 반영', () => {
    const ctx = makeCtx();
    const eng = new LayerEngine(ctx, 100, 100);
    let seen = '';
    const r: LayerRenderer = { render: () => { seen = ctx.globalCompositeOperation; } };
    eng.addLayer(spec({ id: 'a', zIndex: 1, blendMode: 'screen' }), r);
    eng.renderFrame(0);
    expect(seen).toBe('screen');
  });

  it('render 예외는 격리 + onError 호출', () => {
    const errors: string[] = [];
    const eng = new LayerEngine(makeCtx(), 100, 100, { onError: (id, e) => errors.push(`${id}:${e.message}`) });
    const bad: LayerRenderer = { render: () => { throw new Error('boom'); } };
    const good = mkRenderer();
    eng.addLayer(spec({ id: 'bad', zIndex: 1 }), bad);
    eng.addLayer(spec({ id: 'good', zIndex: 2 }), good);
    eng.renderFrame(0);
    expect(errors).toEqual(['bad:boom']);
    expect(good.calls.render).toBe(1);
  });

  it('deltaMs 두 번째 프레임부터 계산', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const deltas: number[] = [];
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), { render: (fc) => deltas.push(fc.deltaMs) });
    eng.renderFrame(0);
    eng.renderFrame(33);
    eng.renderFrame(66);
    expect(deltas).toEqual([0, 33, 33]);
  });

  it('reset() 후 frameIndex/deltaMs 초기화', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const idxs: number[] = [];
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), { render: (fc) => idxs.push(fc.frameIndex) });
    eng.renderFrame(0);
    eng.renderFrame(33);
    eng.reset();
    eng.renderFrame(500);
    expect(idxs).toEqual([0, 1, 0]);
  });
});

describe('LayerEngine: 기타', () => {
  it('setEnabled로 동적 on/off', () => {
    const eng = new LayerEngine(makeCtx(), 100, 100);
    const r = mkRenderer();
    eng.addLayer(spec({ id: 'a', zIndex: 1 }), r);
    eng.setEnabled('a', false);
    eng.renderFrame(0);
    expect(r.calls.render).toBe(0);
    eng.setEnabled('a', true);
    eng.renderFrame(16);
    expect(r.calls.render).toBe(1);
  });
});
