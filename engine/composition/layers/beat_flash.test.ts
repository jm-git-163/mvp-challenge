/**
 * engine/composition/layers/beat_flash.test.ts
 *
 * Focused Session-5 Candidate V 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import beatFlash from './beat_flash';

function makeCtx(W = 640, H = 360) {
  const grad = { addColorStop: vi.fn() };
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => grad),
    canvas: { width: W, height: H },
    globalAlpha: 1, fillStyle: '', globalCompositeOperation: 'source-over',
  } as any;
}

function makeLayer(props: any = {}) {
  return {
    id: 'bf-1', type: 'beat_flash', zIndex: 50, visible: true,
    opacity: 1, blendMode: 'source-over', props,
  } as any;
}

describe('beat_flash — Session-5 V', () => {
  it('beatIntensity=0 → no-op', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer(), 0, { beatIntensity: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('beatIntensity=1, curve=linear → alpha = maxAlpha', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ curve: 'linear', maxAlpha: 0.5 }), 0, { beatIntensity: 1 });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 360);
    // globalAlpha 는 ctx 객체 속성 — save 후 할당됨. mock 은 최종 값만 보유
    expect(ctx.globalAlpha).toBeCloseTo(0.5, 3);
  });

  it('curve=quad 기본: alpha = intensity^2 * maxAlpha', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ maxAlpha: 1 }), 0, { beatIntensity: 0.5 });
    expect(ctx.globalAlpha).toBeCloseTo(0.25, 3); // 0.5^2
  });

  it('curve=cubic: alpha = intensity^3 * maxAlpha', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ curve: 'cubic', maxAlpha: 1 }), 0, { beatIntensity: 0.5 });
    expect(ctx.globalAlpha).toBeCloseTo(0.125, 3);
  });

  it('mode=radial → createRadialGradient 사용', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ mode: 'radial' }), 0, { beatIntensity: 1 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('mode=fill 기본: createRadialGradient 미호출', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer(), 0, { beatIntensity: 1 });
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it('threshold 이하 intensity → no-op', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ threshold: 0.2 }), 0, { beatIntensity: 0.1 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('manualIntensity 가 state.beatIntensity 를 오버라이드', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ manualIntensity: 0.8, curve: 'linear', maxAlpha: 1 }), 0, {
      beatIntensity: 0,
    });
    expect(ctx.globalAlpha).toBeCloseTo(0.8, 3);
  });

  it('missionState.beatIntensity 폴백 경로', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ curve: 'linear', maxAlpha: 1 }), 0, {
      missionState: { beatIntensity: 0.7 },
    });
    expect(ctx.globalAlpha).toBeCloseTo(0.7, 3);
  });

  it('blend 기본 screen: globalCompositeOperation 설정', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer(), 0, { beatIntensity: 1 });
    expect(ctx.globalCompositeOperation).toBe('screen');
  });

  it('intensity > 1 은 내부에서 clamp → alpha > maxAlpha 안됨', () => {
    const ctx = makeCtx();
    beatFlash(ctx, makeLayer({ curve: 'linear', maxAlpha: 0.3 }), 0, { beatIntensity: 5 });
    expect(ctx.globalAlpha).toBeLessThanOrEqual(0.3 + 1e-6);
  });
});
