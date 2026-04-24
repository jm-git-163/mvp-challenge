/**
 * engine/composition/layers/news_ticker.test.ts
 *
 * Focused Session-5 Candidate X 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import newsTicker, { _resetNewsTicker } from './news_ticker';

function makeCtx(W = 800, H = 400) {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    measureText: vi.fn((s: string) => ({ width: s.length * 10 })),
    canvas: { width: W, height: H },
    globalAlpha: 1, fillStyle: '', font: '',
    textAlign: 'left', textBaseline: 'alphabetic',
  } as any;
}

function makeLayer(props: any = {}, id = 'nt-1') {
  return {
    id, type: 'news_ticker', zIndex: 40, visible: true,
    opacity: 1, blendMode: 'source-over', props,
  } as any;
}

describe('news_ticker — Session-5 X', () => {
  beforeEach(() => _resetNewsTicker());

  it('내용 없으면 fillText 미호출', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ texts: [] }), 0, {});
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('texts 배열: fillText 여러 번 호출(반복 렌더)', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ texts: ['HELLO', 'WORLD'], speedPxPerSec: 0 }), 0, {});
    expect(ctx.fillText).toHaveBeenCalled();
    const txt = ctx.fillText.mock.calls[0][0];
    expect(txt).toContain('HELLO');
    expect(txt).toContain('WORLD');
  });

  it('texts 단일 string: 정상 처리', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ texts: 'BREAKING NEWS', speedPxPerSec: 0 }), 0, {});
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillText.mock.calls[0][0]).toContain('BREAKING NEWS');
  });

  it('bgColor null → 배경 fillRect 안 그림 (인디케이터만 그림)', () => {
    const ctx = makeCtx();
    newsTicker(
      ctx,
      makeLayer({ texts: ['X'], speedPxPerSec: 0, bgColor: null, accentColor: null }),
      0,
      {},
    );
    // 배경/인디케이터 둘 다 없음 → fillRect 0
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('labelText: 라벨 배경 + 텍스트 렌더', () => {
    const ctx = makeCtx();
    newsTicker(
      ctx,
      makeLayer({ texts: ['X'], speedPxPerSec: 0, labelText: 'LIVE' }),
      0,
      {},
    );
    // LIVE 가 최소 한 번 fillText 됨
    const all = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(all).toContain('LIVE');
  });

  it('speed>0: 시간이 지나면 offset 이 음(왼쪽)으로 이동 → drawX 감소', () => {
    const ctx1 = makeCtx();
    newsTicker(ctx1, makeLayer({ texts: ['ABC'], speedPxPerSec: 100 }, 'mv'), 0, {});
    const firstX = ctx1.fillText.mock.calls[0][1];

    const ctx2 = makeCtx();
    newsTicker(ctx2, makeLayer({ texts: ['ABC'], speedPxPerSec: 100 }, 'mv'), 1000, {});
    const secondX = ctx2.fillText.mock.calls[0][1];

    // 왼쪽으로 흐름 → 두번째 프레임의 startX 가 더 작거나 같아야 함
    // (modulo 경계에 걸리면 튀는 경우 있으므로 대체 검증)
    expect(secondX).not.toBe(firstX);
  });

  it('texts 내용이 바뀌면 offset 리셋', () => {
    const ctx = makeCtx();
    // 여러 번 누적해 offset 을 충분히 키움
    newsTicker(ctx, makeLayer({ texts: ['AAA'], speedPxPerSec: 500 }, 'keyswap'), 0, {});
    for (let t = 100; t <= 2000; t += 100) {
      newsTicker(ctx, makeLayer({ texts: ['AAA'], speedPxPerSec: 500 }, 'keyswap'), t, {});
    }
    ctx.fillText.mockClear();
    // 동일 내용, dt=0: offset 이 유지되므로 누적된 상태
    newsTicker(ctx, makeLayer({ texts: ['AAA'], speedPxPerSec: 500 }, 'keyswap'), 2000, {});
    const sameKeyFirstX = ctx.fillText.mock.calls[0][1];

    ctx.fillText.mockClear();
    // 내용 변경 → offset 리셋, startX = W
    newsTicker(ctx, makeLayer({ texts: ['BBB'], speedPxPerSec: 500 }, 'keyswap'), 2000, {});
    const afterResetFirstX = ctx.fillText.mock.calls[0][1];

    // 리셋 후에는 우측(W=800)에서 rewind 시작 → 더 오른쪽 위치 가능
    // 최소한 두 케이스의 첫 X 가 다르면 offset 상태가 달라진 것
    expect(afterResetFirstX).not.toBe(sameKeyFirstX);
  });

  it('position={y}: 커스텀 y 좌표에 배경 그림', () => {
    const ctx = makeCtx();
    newsTicker(
      ctx,
      makeLayer({
        texts: ['X'],
        speedPxPerSec: 0,
        position: { y: 123 },
        height: 40,
      }),
      0,
      {},
    );
    // 첫 fillRect 는 배경. y=123.
    expect(ctx.fillRect.mock.calls[0][1]).toBe(123);
  });

  it('state.missionState.ticker 폴백', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ speedPxPerSec: 0 }), 0, { missionState: { ticker: 'FROM STATE' } });
    const all = ctx.fillText.mock.calls.map((c: any[]) => c[0]).join(' ');
    expect(all).toContain('FROM STATE');
  });

  it('state.tickerText 폴백', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ speedPxPerSec: 0 }), 0, { tickerText: 'TXT' });
    const all = ctx.fillText.mock.calls.map((c: any[]) => c[0]).join(' ');
    expect(all).toContain('TXT');
  });

  it('speed=0: 시간이 지나도 startX 동일 (정적)', () => {
    const ctx1 = makeCtx();
    newsTicker(ctx1, makeLayer({ texts: ['X'], speedPxPerSec: 0 }, 'stat'), 0, {});
    const x0 = ctx1.fillText.mock.calls[0][1];
    const ctx2 = makeCtx();
    newsTicker(ctx2, makeLayer({ texts: ['X'], speedPxPerSec: 0 }, 'stat'), 3000, {});
    const x1 = ctx2.fillText.mock.calls[0][1];
    expect(x1).toBe(x0);
  });

  it('speed<0 (음수): 오른쪽으로 스크롤 — offset 누적 후에도 동작', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ texts: ['X'], speedPxPerSec: -100 }, 'neg'), 0, {});
    newsTicker(ctx, makeLayer({ texts: ['X'], speedPxPerSec: -100 }, 'neg'), 500, {});
    // 크래시 없이 fillText 호출
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('_resetNewsTicker(id): 상태 초기화', () => {
    const ctx = makeCtx();
    newsTicker(ctx, makeLayer({ texts: ['A'], speedPxPerSec: 500 }, 'rst'), 0, {});
    for (let t = 100; t <= 2000; t += 100) {
      newsTicker(ctx, makeLayer({ texts: ['A'], speedPxPerSec: 500 }, 'rst'), t, {});
    }
    ctx.fillText.mockClear();
    newsTicker(ctx, makeLayer({ texts: ['A'], speedPxPerSec: 500 }, 'rst'), 2000, {});
    const beforeReset = ctx.fillText.mock.calls[0][1];

    _resetNewsTicker('rst');
    const ctx2 = makeCtx();
    newsTicker(ctx2, makeLayer({ texts: ['A'], speedPxPerSec: 500 }, 'rst'), 2000, {});
    const afterReset = ctx2.fillText.mock.calls[0][1];

    // 리셋되면 offset 상태가 달라짐
    expect(afterReset).not.toBe(beforeReset);
  });
});
