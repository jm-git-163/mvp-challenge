/**
 * engine/composition/layers/audio_visualizer.test.ts
 *
 * Focused Session-5 Candidate U 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import audioVisualizer, { _resetAudioVizState } from './audio_visualizer';

function makeCtx(W = 640, H = 360) {
  const grad = { addColorStop: vi.fn() };
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => grad),
    canvas: { width: W, height: H },
    globalAlpha: 1, fillStyle: '',
  } as any;
}

function makeLayer(props: any = {}, id = 'viz-1') {
  return {
    id, type: 'audio_visualizer', zIndex: 10, visible: true,
    opacity: 1, blendMode: 'source-over', props,
  } as any;
}

function makeSpectrum(n: number, fill = 128): Uint8Array {
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = fill;
  return arr;
}

describe('audio_visualizer — Session-5 U', () => {
  beforeEach(() => _resetAudioVizState());

  it('스펙트럼 없으면 no-op (save 미호출)', () => {
    const ctx = makeCtx();
    audioVisualizer(ctx, makeLayer(), 0, {});
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('state.audioSpectrum 경로 읽기 → 막대 그림', () => {
    const ctx = makeCtx();
    audioVisualizer(ctx, makeLayer({ barCount: 16 }), 0, {
      audioSpectrum: makeSpectrum(256, 200),
    });
    expect(ctx.fillRect).toHaveBeenCalledTimes(16);
  });

  it('missionState.audioSpectrum 폴백 경로', () => {
    const ctx = makeCtx();
    audioVisualizer(ctx, makeLayer({ barCount: 8 }), 0, {
      missionState: { audioSpectrum: makeSpectrum(128, 180) },
    });
    expect(ctx.fillRect).toHaveBeenCalledTimes(8);
  });

  it('floorDb 이하 값은 전부 0 → 그라디언트만 세팅하고 막대는 크기 0', () => {
    const ctx = makeCtx();
    const spec = makeSpectrum(256, 5); // floorDb=10 기본이라 전부 cut
    audioVisualizer(ctx, makeLayer({ barCount: 10 }), 0, { audioSpectrum: spec });
    // fillRect 는 여전히 호출되지만 height=0
    // mock 이라 rect 차원 확인:
    const calls = ctx.fillRect.mock.calls;
    expect(calls.length).toBe(10);
    for (const c of calls) expect(c[3]).toBeCloseTo(0, 5); // height
  });

  it('beatIntensity=1 이면 height 가 > 기본 (35% 부스트)', () => {
    const ctx1 = makeCtx();
    const ctx2 = makeCtx();
    const spec = makeSpectrum(256, 200);
    audioVisualizer(ctx1, makeLayer({ barCount: 4, smoothing: 0 }, 'a'), 0, { audioSpectrum: spec });
    audioVisualizer(ctx2, makeLayer({ barCount: 4, smoothing: 0 }, 'b'), 0, {
      audioSpectrum: spec, beatIntensity: 1,
    });
    const h1 = ctx1.fillRect.mock.calls[0][3];
    const h2 = ctx2.fillRect.mock.calls[0][3];
    expect(h2).toBeGreaterThan(h1);
    // 약 1.35배
    expect(h2 / h1).toBeCloseTo(1.35, 1);
  });

  it('smoothing>0: 첫 프레임은 낮고, 여러 프레임 후 목표에 근접', () => {
    const ctx = makeCtx();
    const spec = makeSpectrum(256, 200);
    const layer = makeLayer({ barCount: 4, smoothing: 0.5 }, 'sm-1');
    audioVisualizer(ctx, layer, 0, { audioSpectrum: spec });
    const h1 = ctx.fillRect.mock.calls[0][3];
    for (let i = 0; i < 10; i++) {
      ctx.fillRect.mockClear();
      audioVisualizer(ctx, layer, i * 16, { audioSpectrum: spec });
    }
    const hN = ctx.fillRect.mock.calls[0][3];
    expect(hN).toBeGreaterThan(h1);
  });

  it('mirror=true → 막대가 anchor 기준 위아래 대칭 (y = anchor - h/2)', () => {
    const ctx = makeCtx(100, 200);
    audioVisualizer(ctx, makeLayer({
      barCount: 2, mirror: true, position: 'center', heightRatio: 0.5, smoothing: 0,
    }), 0, { audioSpectrum: makeSpectrum(64, 255) });
    const y0 = ctx.fillRect.mock.calls[0][1];
    const h0 = ctx.fillRect.mock.calls[0][3];
    // anchor = H/2 = 100; mirror → y = 100 - h/2
    expect(y0 + h0 / 2).toBeCloseTo(100, 1);
  });

  it('position bottom(기본) → 막대가 위로 자람 (y < H)', () => {
    const ctx = makeCtx(100, 200);
    audioVisualizer(ctx, makeLayer({
      barCount: 2, position: 'bottom', smoothing: 0,
    }), 0, { audioSpectrum: makeSpectrum(64, 255) });
    const y = ctx.fillRect.mock.calls[0][1];
    const h = ctx.fillRect.mock.calls[0][3];
    // bottom: y = anchor(H=200) - h
    expect(y + h).toBeCloseTo(200, 1);
  });

  it('barCount clamp: [4, 256]', () => {
    const ctx = makeCtx();
    audioVisualizer(ctx, makeLayer({ barCount: 2 }), 0, {
      audioSpectrum: makeSpectrum(64, 200),
    });
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
  });

  it('_resetAudioVizState: envelope 초기화 → 다시 첫 프레임처럼 동작', () => {
    const ctx = makeCtx();
    const spec = makeSpectrum(256, 200);
    const layer = makeLayer({ barCount: 4, smoothing: 0.8 }, 'reset-1');
    for (let i = 0; i < 10; i++) audioVisualizer(ctx, layer, i * 16, { audioSpectrum: spec });
    const beforeReset = ctx.fillRect.mock.calls.at(-1)![3];
    _resetAudioVizState();
    ctx.fillRect.mockClear();
    audioVisualizer(ctx, layer, 0, { audioSpectrum: spec });
    const afterReset = ctx.fillRect.mock.calls[0][3];
    expect(afterReset).toBeLessThan(beforeReset);
  });
});
