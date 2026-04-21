/**
 * engine/composition/postProcessHook.test.ts
 *
 * Focused Session-2 Candidate F 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  applyTemplatePostProcess,
  applyChromaticAberration2d,
  _resetChromaticOffscreen,
} from './postProcessHook';

function makeCtx() {
  const radial = { addColorStop: vi.fn() };
  return {
    save: vi.fn(), restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(), drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => radial),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', filter: 'none',
  } as any;
}

describe('applyTemplatePostProcess (Canvas 2D 폴백)', () => {
  it('빈/undefined 체인 → no-op', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, undefined, 0, {});
    applyTemplatePostProcess(ctx, [], 0, {});
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('bloom: filter blur + lighter 합성 + drawImage(self) 호출', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [{ kind: 'bloom', intensity: 0.8 }], 0, {});
    expect(ctx.drawImage).toHaveBeenCalled();
    // save/restore 쌍
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('vignette: createRadialGradient + fillRect', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [{ kind: 'vignette', intensity: 0.6 }], 0, {});
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('film_grain: fillRect 다수 호출 (픽셀 스프링클)', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [{ kind: 'film_grain', opacity: 0.15 }], 1234, {});
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(10);
  });

  it('미지원 kind (lut/bokeh 등) → 스킵만, throw 없음', () => {
    const ctx = makeCtx();
    expect(() => applyTemplatePostProcess(ctx, [
      { kind: 'crt_scanlines', opacity: 0.2 },
      { kind: 'lut', path: 'x' },
      { kind: 'bokeh', strength: 0.5 },
      { kind: 'pixelate', size: 4 },
      { kind: 'saturation', boost: 0.3 },
      { kind: 'unknown_kind', foo: 1 } as any,
    ], 0, {})).not.toThrow();
  });

  it('beatIntensity=1 일 때 bloom alpha 부스트 적용 (drawImage 여전히 호출)', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [{ kind: 'bloom', intensity: 0.5 }], 0, { beatIntensity: 1 });
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('체인 순서대로 여러 단계 처리 (bloom + vignette + film_grain)', () => {
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [
      { kind: 'bloom', intensity: 0.5 },
      { kind: 'vignette', intensity: 0.4 },
      { kind: 'film_grain', opacity: 0.1 },
    ], 500, {});
    expect(ctx.drawImage).toHaveBeenCalled();         // bloom
    expect(ctx.createRadialGradient).toHaveBeenCalled(); // vignette
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(5);  // grain + vignette
  });

  it('bloom drawImage 실패해도 throw 없음 (try/catch 내부)', () => {
    const ctx = makeCtx();
    ctx.drawImage = vi.fn(() => { throw new Error('no self-ref'); });
    expect(() => applyTemplatePostProcess(ctx, [{ kind: 'bloom', intensity: 0.5 }], 0, {})).not.toThrow();
  });
});

describe('applyChromaticAberration2d (Session-3 Candidate J)', () => {
  function stubDocument(offCtx: any) {
    const canvasStub = { width: 0, height: 0, getContext: vi.fn(() => offCtx) };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvasStub) });
    return canvasStub;
  }

  it('document 없음 (SSR) → false', () => {
    _resetChromaticOffscreen();
    vi.stubGlobal('document', undefined);
    const ctx = makeCtx();
    expect(applyChromaticAberration2d(ctx, 4)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('offsetPx ≈ 0 → no-op true', () => {
    _resetChromaticOffscreen();
    const offCtx: any = { clearRect: vi.fn(), drawImage: vi.fn() };
    stubDocument(offCtx);
    const ctx = makeCtx();
    expect(applyChromaticAberration2d(ctx, 0)).toBe(true);
    // 실제 작업 없음 — offCtx.drawImage 미호출
    expect(offCtx.drawImage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('정상: offscreen clearRect + drawImage 호출, 메인 ctx 도 clearRect + 3회 drawImage', () => {
    _resetChromaticOffscreen();
    const offCtx: any = { clearRect: vi.fn(), drawImage: vi.fn() };
    stubDocument(offCtx);
    const ctx = makeCtx();
    const ok = applyChromaticAberration2d(ctx, 6);
    expect(ok).toBe(true);
    expect(offCtx.clearRect).toHaveBeenCalled();
    expect(offCtx.drawImage).toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
    // main: base + left-shift + right-shift = 3 drawImage
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it('offscreen drawImage 실패 → false 반환 (폴백 안전)', () => {
    _resetChromaticOffscreen();
    const offCtx: any = {
      clearRect: vi.fn(),
      drawImage: vi.fn(() => { throw new Error('tainted'); }),
    };
    stubDocument(offCtx);
    const ctx = makeCtx();
    expect(applyChromaticAberration2d(ctx, 6)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('템플릿 체인 경로: chromatic kind 가 applyTemplatePostProcess 에서 처리됨', () => {
    _resetChromaticOffscreen();
    const offCtx: any = { clearRect: vi.fn(), drawImage: vi.fn() };
    stubDocument(offCtx);
    const ctx = makeCtx();
    applyTemplatePostProcess(ctx, [{ kind: 'chromatic', baseOffsetPx: 3, onOnsetPx: 4 }], 0, { beatIntensity: 1 });
    // base 3 + onset 4*1 = offset 7 — offscreen 복사 발생
    expect(offCtx.drawImage).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
