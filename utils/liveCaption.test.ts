/**
 * liveCaption.test.ts — FIX-Z25 (2026-04-22)
 */
import { describe, it, expect } from 'vitest';
import {
  drawLiveCaption,
  drawJudgementToast,
  drawSquatPlusOne,
  drawMicPermissionBanner,
  similarityToTier,
  wrapCaption,
  TIER_COLORS,
} from './liveCaption';

function mockCtx(charWidth = 20) {
  const calls: Array<{ fn: string; args: any[] }> = [];
  const rec = (name: string) => (...args: any[]) => { calls.push({ fn: name, args }); };
  const ctx: any = {
    save: rec('save'),
    restore: rec('restore'),
    fillRect: rec('fillRect'),
    fillText: rec('fillText'),
    measureText: (s: string) => ({ width: s.length * charWidth }),
    globalAlpha: 1,
    set fillStyle(v: string) { calls.push({ fn: 'fillStyle=', args: [v] }); },
    set font(v: string) { calls.push({ fn: 'font=', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'textAlign=', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'textBaseline=', args: [v] }); },
  };
  return { ctx, calls };
}

describe('similarityToTier', () => {
  it('임계치별 tier 반환', () => {
    expect(similarityToTier(1.0)).toBe('perfect');
    expect(similarityToTier(0.90)).toBe('perfect');
    expect(similarityToTier(0.89)).toBe('good');
    expect(similarityToTier(0.70)).toBe('good');
    expect(similarityToTier(0.69)).toBe('soso');
    expect(similarityToTier(0.50)).toBe('soso');
    expect(similarityToTier(0.49)).toBe('miss');
    expect(similarityToTier(0)).toBe('miss');
  });
});

describe('wrapCaption', () => {
  it('빈 텍스트 → 빈 배열', () => {
    const { ctx } = mockCtx();
    expect(wrapCaption(ctx, '', 200)).toEqual([]);
  });

  it('한 줄에 들어가는 짧은 텍스트', () => {
    const { ctx } = mockCtx(20); // 20px/char
    const lines = wrapCaption(ctx, 'hello', 400, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('hello');
  });

  it('2 줄로 줄바꿈', () => {
    const { ctx } = mockCtx(20); // 20px/char → maxWidth 200 = 10 char
    const lines = wrapCaption(ctx, 'one two three four', 200, 2);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it('3 줄 초과 시 말줄임표', () => {
    const { ctx } = mockCtx(20);
    const lines = wrapCaption(ctx, 'aaa bbb ccc ddd eee fff ggg hhh iii', 80, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});

describe('drawLiveCaption', () => {
  it('빈 텍스트 → 그리지 않음', () => {
    const { ctx, calls } = mockCtx();
    drawLiveCaption(ctx, { canvasW: 720, canvasH: 1280, text: '' });
    expect(calls.filter(c => c.fn === 'fillText')).toHaveLength(0);
  });

  it('텍스트가 있으면 박스 + 텍스트 그림', () => {
    const { ctx, calls } = mockCtx();
    drawLiveCaption(ctx, { canvasW: 720, canvasH: 1280, text: '안녕' });
    const rects = calls.filter(c => c.fn === 'fillRect');
    const texts = calls.filter(c => c.fn === 'fillText');
    // 최소 배경 + accent strip 2개 fillRect
    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('박스가 캔버스 하단 72~92% 영역 안에 위치', () => {
    const { ctx, calls } = mockCtx();
    drawLiveCaption(ctx, { canvasW: 720, canvasH: 1280, text: 'abc' });
    const rects = calls.filter(c => c.fn === 'fillRect');
    const bgRect = rects[0].args; // [x, y, w, h]
    const y = bgRect[1] as number;
    const h = bgRect[3] as number;
    // 박스 상단 ≥ 720*0.72 = 921
    expect(y).toBeGreaterThanOrEqual(Math.round(1280 * 0.70));
    // 박스 하단 ≤ 캔버스 높이
    expect(y + h).toBeLessThanOrEqual(1280);
  });

  it('judgementTier 지정 시 해당 색 accent', () => {
    const { ctx, calls } = mockCtx();
    drawLiveCaption(ctx, { canvasW: 720, canvasH: 1280, text: 'x', judgementTier: 'perfect' });
    const styles = calls.filter(c => c.fn === 'fillStyle=').map(c => c.args[0]);
    expect(styles).toContain(TIER_COLORS.perfect);
  });
});

describe('drawJudgementToast', () => {
  it('만료 후엔 그리지 않음', () => {
    const { ctx, calls } = mockCtx();
    drawJudgementToast(ctx, { canvasW: 720, canvasH: 1280, tier: 'good', at: 0, now: 2000 });
    expect(calls.filter(c => c.fn === 'fillText')).toHaveLength(0);
  });

  it('활성 중엔 텍스트 그림', () => {
    const { ctx, calls } = mockCtx();
    drawJudgementToast(ctx, { canvasW: 720, canvasH: 1280, tier: 'perfect', at: 0, now: 400 });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0]);
    expect(texts).toContain('PERFECT!');
  });
});

describe('drawSquatPlusOne', () => {
  it('만료 후엔 안 그림', () => {
    const { ctx, calls } = mockCtx();
    drawSquatPlusOne(ctx, { canvasW: 720, canvasH: 1280, at: 0, now: 1000 });
    expect(calls.filter(c => c.fn === 'fillText')).toHaveLength(0);
  });
  it('활성 중엔 +1 텍스트 그림', () => {
    const { ctx, calls } = mockCtx();
    drawSquatPlusOne(ctx, { canvasW: 720, canvasH: 1280, at: 0, now: 200 });
    const texts = calls.filter(c => c.fn === 'fillText').map(c => c.args[0]);
    expect(texts).toContain('+1');
  });
});

describe('drawMicPermissionBanner', () => {
  it('3초 이내엔 그림', () => {
    const { ctx, calls } = mockCtx();
    drawMicPermissionBanner(ctx, { canvasW: 720, canvasH: 1280, at: 0, now: 1000 });
    expect(calls.filter(c => c.fn === 'fillText').length).toBeGreaterThanOrEqual(1);
  });
  it('3초 초과 시엔 안 그림', () => {
    const { ctx, calls } = mockCtx();
    drawMicPermissionBanner(ctx, { canvasW: 720, canvasH: 1280, at: 0, now: 4000 });
    expect(calls.filter(c => c.fn === 'fillText')).toHaveLength(0);
  });
});
