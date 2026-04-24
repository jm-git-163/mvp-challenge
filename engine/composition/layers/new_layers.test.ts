/**
 * engine/composition/layers/new_layers.test.ts
 *
 * 2026-04-22 신규 11개 레이어 스모크 테스트.
 *   - throw 없이 그리는지
 *   - opacity 가 globalAlpha 에 반영되는지
 *   - 필수 ctx 메서드 호출 1건 이상
 */
import { describe, it, expect, vi } from 'vitest';
import type { BaseLayer } from '../../templates/schema';

import particle_ambient  from './particle_ambient';
import floating_shapes   from './floating_shapes';
import orbiting_ring     from './orbiting_ring';
import face_sticker      from './face_sticker';
import hand_emoji        from './hand_emoji';
import camera_reflection from './camera_reflection';
import timer_ring        from './timer_ring';
import score_hud         from './score_hud';
import mission_prompt    from './mission_prompt';
import lens_flare        from './lens_flare';
import chromatic_pulse   from './chromatic_pulse';

function makeCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(),
    stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(),
    clip: vi.fn(), rect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createPattern: vi.fn(() => ({})),
    drawImage: vi.fn(),
    translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    fillText: vi.fn(), strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 180 })),
    canvas: { width: 1080, height: 1920 },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0,
    lineCap: 'butt',
    filter: 'none',
  } as any;
}

const base: BaseLayer = { id: 'x', type: 'particle_ambient', zIndex: 1, opacity: 1, enabled: true };

describe('particle_ambient', () => {
  it('throw 없이 렌더 + fill 호출', () => {
    const ctx = makeCtx();
    expect(() => particle_ambient(ctx, { ...base, props: { count: 10 } }, 500, {})).not.toThrow();
    expect(ctx.fill).toHaveBeenCalled();
  });
  it('preset glitter_down 동작', () => {
    const ctx = makeCtx();
    expect(() => particle_ambient(ctx, { ...base, props: { preset: 'glitter_down', count: 5 } }, 1000, {})).not.toThrow();
  });
});

describe('floating_shapes', () => {
  it('shapes 배열 렌더 throw 없음', () => {
    const ctx = makeCtx();
    expect(() => floating_shapes(ctx, { ...base, props: { shapes: ['cube', 'pyramid', 'sphere'] } }, 100, {})).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled(); // cube 는 fillRect 씀
  });
  it('orbit+emoji 모드: fillText 호출', () => {
    const ctx = makeCtx();
    floating_shapes(ctx, { ...base, props: { emoji: '💖', orbit: { radiusPx: 260, periodSec: 6, phaseDeg: 0 } } }, 500, {});
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('orbiting_ring', () => {
  it('링 + 위성 그림', () => {
    const ctx = makeCtx();
    expect(() => orbiting_ring(ctx, { ...base, props: { radiusPx: 300, periodSec: 6 } }, 200, {})).not.toThrow();
    expect(ctx.arc).toHaveBeenCalled();
  });
});

describe('face_sticker', () => {
  it('이모지 asset → fillText', () => {
    const ctx = makeCtx();
    face_sticker(ctx, { ...base, props: { asset: '😎', sizePx: 80 } }, 0, {});
    expect(ctx.fillText).toHaveBeenCalledWith('😎', 0, 0);
  });
  it('faceAnchor 좌표 우선 사용', () => {
    const ctx = makeCtx();
    face_sticker(ctx, { ...base, id: 'sticker1', props: { asset: '⭐' } }, 0, { faceAnchor: { nose: { x: 500, y: 300 } }, __trackedPoint: { sticker1: { x: 200, y: 100 } } });
    expect(ctx.translate).toHaveBeenCalledWith(200, 100);
  });
});

describe('hand_emoji', () => {
  it('handAnchors 없으면 그리지 않음', () => {
    const ctx = makeCtx();
    hand_emoji(ctx, { ...base, props: { particle: 'electric_spark' } }, 0, {});
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
  it('handAnchors.left 있으면 이모지 그림', () => {
    const ctx = makeCtx();
    hand_emoji(ctx, { ...base, props: { particle: 'electric_spark' } }, 0, { handAnchors: { left: { x: 100, y: 200 } } });
    expect(ctx.fillText).toHaveBeenCalledWith('⚡', expect.any(Number), expect.any(Number));
  });
});

describe('camera_reflection', () => {
  it('videoEl 없으면 조용히 리턴', () => {
    const ctx = makeCtx();
    expect(() => camera_reflection(ctx, base, 0, {})).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
  it('videoEl 있으면 drawImage', () => {
    const ctx = makeCtx();
    const video = { readyState: 4, videoWidth: 100, videoHeight: 100 } as any;
    camera_reflection(ctx, base, 0, { videoEl: video });
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});

describe('timer_ring', () => {
  it('arc 호출 + 숫자 텍스트', () => {
    const ctx = makeCtx();
    timer_ring(ctx, { ...base, props: { position: 'top-left', durationSec: 20 } }, 5000, { missionState: { timerProgress: 0.25 } });
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('score_hud', () => {
  it('score 텍스트 출력', () => {
    const ctx = makeCtx();
    score_hud(ctx, { ...base, props: { position: 'top-right' } }, 0, { missionState: { score: 87 } });
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('87'), expect.any(Number), expect.any(Number));
  });
  it('glass=false 면 배경 박스 없음', () => {
    const ctx = makeCtx();
    score_hud(ctx, { ...base, props: { glass: false } }, 0, { score: 10 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe('mission_prompt', () => {
  it('text 렌더 throw 없음', () => {
    const ctx = makeCtx();
    mission_prompt(ctx, { ...base, props: { text: '스쿼트 10회', neonAccent: '#FF2D95' } }, 0, {});
    expect(ctx.fillText).toHaveBeenCalledWith('스쿼트 10회', expect.any(Number), expect.any(Number));
  });
});

describe('lens_flare', () => {
  it('lighter 합성 + fillRect', () => {
    const ctx = makeCtx();
    lens_flare(ctx, base, 0, {});
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });
});

describe('chromatic_pulse', () => {
  it('beatIntensity 낮으면 건너뜀', () => {
    const ctx = makeCtx();
    chromatic_pulse(ctx, { ...base, props: { peakPx: 8 } }, 0, { beatIntensity: 0 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
  it('beatIntensity 높으면 8 box 그림', () => {
    const ctx = makeCtx();
    chromatic_pulse(ctx, { ...base, props: { peakPx: 8 } }, 0, { beatIntensity: 0.9 });
    // 2 채널 × 4 변 = 8회
    expect(ctx.fillRect).toHaveBeenCalledTimes(8);
  });
});
