/**
 * engine/composition/layers/particle_burst.test.ts
 *
 * Focused Session-5 Candidate W 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import particleBurst, {
  triggerParticleBurst, _resetParticleBurst,
} from './particle_burst';

function makeCtx(W = 640, H = 360) {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    fillRect: vi.fn(),
    canvas: { width: W, height: H },
    globalAlpha: 1, fillStyle: '',
  } as any;
}

function makeLayer(props: any = {}, id = 'pb-1') {
  return {
    id, type: 'particle_burst', zIndex: 20, visible: true,
    opacity: 1, blendMode: 'source-over', props,
  } as any;
}

describe('particle_burst — Session-5 W', () => {
  beforeEach(() => _resetParticleBurst());

  it('첫 마운트 (pulseSeq 첫 관측) 에는 방출 안함', () => {
    const ctx = makeCtx();
    particleBurst(ctx, makeLayer(), 0, { missionState: { pulseSeq: 0 } });
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('pulseSeq 가 증가하면 방출 (burstCount 개 파티클)', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 5, shape: 'circle' });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    // 16ms 시점에 5개 파티클 — arc 5회
    expect(ctx.arc).toHaveBeenCalledTimes(5);
  });

  it('수명 초과 후에는 파티클이 사라짐', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 4, lifeMs: 100 });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 10, { missionState: { pulseSeq: 1 } });
    ctx.arc.mockClear();
    particleBurst(ctx, layer, 200, { missionState: { pulseSeq: 1 } });
    // lifeMs=100 → 190ms 경과하면 전부 죽음
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('shape=square: fillRect 로 그림', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 3, shape: 'square' });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('shape=star: moveTo/lineTo 다수 호출', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 2, shape: 'star' });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThanOrEqual(2 * 4); // 최소 4 lineTo/별
  });

  it('triggerOn=beat: beatIntensity 가 threshold 를 넘으면 방출', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ triggerOn: 'beat', beatThreshold: 0.7, burstCount: 3 });
    particleBurst(ctx, layer, 0, { beatIntensity: 0.3 });
    expect(ctx.arc).not.toHaveBeenCalled();
    particleBurst(ctx, layer, 16, { beatIntensity: 0.9 });
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  it('triggerOn=beat: threshold 를 넘어도 같은 윈도우 유지하면 재방출 안함', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ triggerOn: 'beat', beatThreshold: 0.7, burstCount: 3, lifeMs: 5000 });
    particleBurst(ctx, layer, 0, { beatIntensity: 0.9 });
    const after1 = ctx.arc.mock.calls.length;
    particleBurst(ctx, layer, 16, { beatIntensity: 0.95 });
    // 기존 파티클만 렌더, 추가 방출 없음 → arc 호출 수 동일
    expect(ctx.arc.mock.calls.length).toBe(after1 * 2);
  });

  it('triggerOn=manual + triggerParticleBurst(id) 호출 → 방출', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ triggerOn: 'manual', burstCount: 4 }, 'manual-pb');
    particleBurst(ctx, layer, 0, {});
    expect(ctx.arc).not.toHaveBeenCalled();
    triggerParticleBurst('manual-pb');
    particleBurst(ctx, layer, 16, {});
    expect(ctx.arc).toHaveBeenCalledTimes(4);
  });

  it('gravity>0: vy 누적되어 파티클이 아래로 휨 (y 증가)', () => {
    const ctx = makeCtx(200, 400);
    // origin=center → y≈200 으로 시작
    const layer = makeLayer({
      burstCount: 1, lifeMs: 2000, gravity: 500,
      speedMin: 0, speedMax: 0, // 초기 속도 0 → 순수 중력만
      shape: 'square',
    }, 'grav');
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    const y0 = ctx.fillRect.mock.calls.at(-1)![1];
    ctx.fillRect.mockClear();
    particleBurst(ctx, layer, 500, { missionState: { pulseSeq: 1 } });
    const y1 = ctx.fillRect.mock.calls.at(-1)![1];
    expect(y1).toBeGreaterThan(y0);
  });

  it('_resetParticleBurst(id): 상태 초기화', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 3 }, 'rst-1');
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    expect(ctx.arc).toHaveBeenCalledTimes(3);
    _resetParticleBurst('rst-1');
    ctx.arc.mockClear();
    // 리셋 후 pulseSeq=1 이 다시 "첫 관측" 처럼 취급 → 방출 안함
    particleBurst(ctx, layer, 32, { missionState: { pulseSeq: 1 } });
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('burstCount clamp: [1, 200]', () => {
    const ctx = makeCtx();
    const layer = makeLayer({ burstCount: 500 });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 16, { missionState: { pulseSeq: 1 } });
    expect(ctx.arc.mock.calls.length).toBeLessThanOrEqual(200);
  });

  it('origin={x,y} 커스텀 좌표: 파티클 초기 위치 = origin 근처', () => {
    const ctx = makeCtx(200, 200);
    const layer = makeLayer({
      burstCount: 1, origin: { x: 50, y: 50 },
      speedMin: 0, speedMax: 0,
      shape: 'square',
    });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 0 } });
    particleBurst(ctx, layer, 0, { missionState: { pulseSeq: 1 } });
    // dt=0 → 아직 안 움직임. square 센터 좌표 복원
    const [rx, ry, rw] = ctx.fillRect.mock.calls[0];
    expect(rx + rw / 2).toBeCloseTo(50, 0);
    expect(ry + rw / 2).toBeCloseTo(50, 0);
  });
});
