import { describe, it, expect, vi } from 'vitest';
import counter_hud from './counter_hud';
import type { BaseLayer } from '../../templates/schema';

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), scale: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(), strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 180 })),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, fillStyle: '', strokeStyle: '',
    lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
  } as any;
}

const base: BaseLayer = { id: 'cnt', type: 'counter_hud', zIndex: 60, opacity: 1, enabled: true };

describe('counter_hud renderer', () => {
  it('기본 format \"{n} / {target}\" 치환', () => {
    const ctx = makeCtx();
    counter_hud(ctx, { ...base, props: { target: 10 } }, 0, { squatCount: 7 });
    expect(ctx.fillText).toHaveBeenCalledWith('7 / 10', 0, 0);
  });

  it('format 커스텀 \"{n}회\" 지원', () => {
    const ctx = makeCtx();
    counter_hud(ctx, { ...base, props: { format: '{n}회' } }, 0, { counter: 3 });
    expect(ctx.fillText).toHaveBeenCalledWith('3회', 0, 0);
  });

  it('missionState.repCount 우선, 없으면 squatCount, 없으면 0', () => {
    const ctx1 = makeCtx();
    counter_hud(ctx1, base, 0, { missionState: { repCount: 5 }, squatCount: 99 });
    expect(ctx1.fillText).toHaveBeenCalledWith('5 / 10', 0, 0);

    const ctx2 = makeCtx();
    counter_hud(ctx2, base, 0, {});
    expect(ctx2.fillText).toHaveBeenCalledWith('0 / 10', 0, 0);
  });

  it('값 변경 시 scale 펄스 (첫 프레임 100ms 에서 scale>1)', () => {
    const ctx = makeCtx();
    const state: any = { squatCount: 1 };
    counter_hud(ctx, base, 0, state);       // 첫 호출: pulseStart=0
    counter_hud(ctx, base, 100, state);     // 100ms 경과 → sin(π/2.2) ≈ peak
    // translate + scale 이 최소 1회는 호출 (scale != 1 일 때만 호출)
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('값 안 바뀌면 펄스 없음 (220ms 후 scale 호출 없음)', () => {
    const ctx = makeCtx();
    const state: any = { squatCount: 2 };
    counter_hud(ctx, base, 0, state);
    counter_hud(ctx, base, 300, state);
    // 두 번째 호출에서는 elapsed=300 > 220 이라 scale 호출 안됨
    // (첫 호출 0ms 에서 elapsed=0 → bump=0 → scale=1 → scale 미호출)
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('position top-center: y ≈ height*0.14', () => {
    const ctx = makeCtx();
    counter_hud(ctx, { ...base, props: { position: 'top-center' } }, 0, { counter: 1 });
    const [, y] = ctx.translate.mock.calls[0];
    expect(y).toBeCloseTo(1920 * 0.14, 0);
  });

  it('glassBg=true 기본: fillRect + strokeRect 호출', () => {
    const ctx = makeCtx();
    counter_hud(ctx, base, 0, { counter: 1 });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('glassBg=false: 배경 박스 생략', () => {
    const ctx = makeCtx();
    counter_hud(ctx, { ...base, props: { glassBg: false } }, 0, { counter: 1 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});
