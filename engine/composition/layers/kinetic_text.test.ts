import { describe, it, expect, vi } from 'vitest';
import kinetic_text from './kinetic_text';
import type { BaseLayer } from '../../templates/schema';

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    fillText: vi.fn(), strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, fillStyle: '', strokeStyle: '',
    lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
  } as any;
}

const base: BaseLayer = { id: 'kt', type: 'kinetic_text', zIndex: 90, opacity: 1, enabled: true };

describe('kinetic_text renderer', () => {
  it('text 없으면 아무 것도 안 그림', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, base, 0, {});
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('애니메이션 완료 후(= stagger*N + charDur 경과) 모든 글자 그려짐', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'ABC' } }, 10_000, {});
    expect(ctx.fillText).toHaveBeenCalledTimes(3);
  });

  it('시작 전(timeMs < startMs): 아무 것도 안 그림', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'HI', startMs: 1000 } }, 500, {});
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('부분 애니메이션(첫 글자만 시작): fillText 1회', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'AB', staggerMs: 100, charDurationMs: 400 } }, 50, {});
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('mode=drop: 등장 중 translate 호출됨', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'X', mode: 'drop' } }, 100, {});
    expect(ctx.translate).toHaveBeenCalled();
  });

  it('mode=spin: 애니메이션 중 rotate 호출', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'X', mode: 'spin' } }, 100, {});
    expect(ctx.rotate).toHaveBeenCalled();
  });

  it('mode=pop(default): scale 호출', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'X' } }, 100, {});
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('letterSpacing 적용: 긴 문자열도 정상 처리 (throw 없음)', () => {
    const ctx = makeCtx();
    expect(() => kinetic_text(
      ctx, { ...base, props: { text: '안녕하세요', letterSpacingPx: 8 } }, 5000, {},
    )).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledTimes(5);
  });

  it('position top-center: translate y < height/2', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: 'A', position: 'top-center' } }, 5000, {});
    const call = ctx.translate.mock.calls[0];
    expect(call[1]).toBeLessThan(1920 / 2);
  });

  it('이모지/서로게이트 페어 안전 처리', () => {
    const ctx = makeCtx();
    kinetic_text(ctx, { ...base, props: { text: '🎉🔥' } }, 5000, {});
    // Array.from 로 그래프임 단위 분해 → 2 글자
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });
});
