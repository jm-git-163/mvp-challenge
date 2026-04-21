import { describe, it, expect, vi } from 'vitest';
import subtitle_track from './subtitle_track';
import type { BaseLayer } from '../../templates/schema';

function makeCtx(measureWidth = 200) {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(), strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: measureWidth })),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, fillStyle: '', strokeStyle: '',
    lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
  } as any;
}

const base: BaseLayer = { id: 'sub', type: 'subtitle_track', zIndex: 80, opacity: 1, enabled: true };

describe('subtitle_track renderer', () => {
  it('자막 없으면 아무 것도 안 그림 (save 호출 없음)', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, base, 0, {});
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('state.speechTranscript 우선 사용 + fillText 호출', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, base, 0, { speechTranscript: '안녕하세요 스쿼트 10회 시작합니다.' });
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('state.subtitle 폴백', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, base, 0, { subtitle: '다시 시작!' });
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('style=broadcast 기본: 하단 풀폭 바 fillRect 2회 이상 (배경+컬러바)', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, base, 0, { speechTranscript: '테스트' });
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('style=bubble: rounded rect path (quadraticCurveTo 4회)', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, { ...base, props: { style: 'bubble' } }, 0, { speechTranscript: '버블 자막' });
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('style=minimal: 배경 fillRect 없이 텍스트만', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, { ...base, props: { style: 'minimal' } }, 0, { speechTranscript: '미니멀' });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('maxSentences=1: 마지막 문장만 사용', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, { ...base, props: { maxSentences: 1, style: 'minimal' } }, 0, {
      speechTranscript: '첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다.',
    });
    // 마지막 호출된 fillText 의 인자에 "셋째" 만 포함
    const lastCall = ctx.fillText.mock.calls[ctx.fillText.mock.calls.length - 1];
    expect(lastCall[0]).toContain('셋째');
    expect(lastCall[0]).not.toContain('첫 문장');
  });

  it('maxChars 초과 시 말줄임 prefix(…)', () => {
    const ctx = makeCtx();
    const long = 'ㄱ'.repeat(200);
    subtitle_track(ctx, { ...base, props: { maxChars: 20, style: 'minimal' } }, 0, {
      speechTranscript: long,
    });
    const firstCall = ctx.fillText.mock.calls[0];
    expect(firstCall[0].startsWith('…')).toBe(true);
  });

  it('missionState.lastUtterance 폴백 (speechTranscript/subtitle 없을 때)', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, base, 0, { missionState: { lastUtterance: '미션 발화' } });
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('position custom {x,y} 적용 — translate 안 쓰지만 textAlign center 유지', () => {
    const ctx = makeCtx();
    subtitle_track(ctx, { ...base, props: { position: { x: 500, y: 300 }, style: 'minimal' } }, 0, {
      speechTranscript: '커스텀 위치',
    });
    expect(ctx.fillText).toHaveBeenCalled();
    // fillText 의 x 인자 = 500
    const call = ctx.fillText.mock.calls[0];
    expect(call[1]).toBe(500);
  });
});
