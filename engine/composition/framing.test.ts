import { describe, it, expect, vi } from 'vitest';
import { buildFramingPath, framingBox, isPointInsideFraming, computeCoverDrawArgs, type PathBuilder } from './framing';

function makeStub(): PathBuilder & { ops: Array<{ op: string; args: number[] }> } {
  const ops: Array<{ op: string; args: number[] }> = [];
  const record = (op: string) => (...args: number[]) => { ops.push({ op, args }); };
  return {
    ops,
    beginPath: vi.fn(record('beginPath')) as unknown as () => void,
    closePath: vi.fn(record('closePath')) as unknown as () => void,
    moveTo: record('moveTo') as (x: number, y: number) => void,
    lineTo: record('lineTo') as (x: number, y: number) => void,
    arc: record('arc') as (x: number, y: number, r: number, s: number, e: number) => void,
    quadraticCurveTo: record('quadraticCurveTo') as (cpx: number, cpy: number, x: number, y: number) => void,
    bezierCurveTo: record('bezierCurveTo') as (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => void,
    rect: record('rect') as (x: number, y: number, w: number, h: number) => void,
  };
}

describe('buildFramingPath', () => {
  it('fullscreen은 rect 한 번', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'fullscreen' }, pb, 1080, 1920);
    expect(pb.ops.filter((o) => o.op === 'rect')).toHaveLength(1);
    expect(pb.ops[0].op).toBe('beginPath');
    expect(pb.ops.at(-1)?.op).toBe('closePath');
  });

  it('circle은 arc 1회 + begin/close', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'circle', centerX: 540, centerY: 960, radius: 300 }, pb, 1080, 1920);
    const arcs = pb.ops.filter((o) => o.op === 'arc');
    expect(arcs).toHaveLength(1);
    expect(arcs[0].args.slice(0, 3)).toEqual([540, 960, 300]);
  });

  it('hexagon은 moveTo 1 + lineTo 5 + closePath', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }, pb, 1080, 1920);
    expect(pb.ops.filter((o) => o.op === 'moveTo')).toHaveLength(1);
    expect(pb.ops.filter((o) => o.op === 'lineTo')).toHaveLength(5);
  });

  it('rounded_rect는 arc 4 + lineTo 4', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'rounded_rect', x: 120, y: 260, w: 840, h: 1120, radius: 16 }, pb, 1080, 1920);
    expect(pb.ops.filter((o) => o.op === 'arc')).toHaveLength(4);
    expect(pb.ops.filter((o) => o.op === 'lineTo')).toHaveLength(4);
  });

  it('heart는 bezier 2회', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'heart', centerX: 540, centerY: 960, size: 420 }, pb, 1080, 1920);
    expect(pb.ops.filter((o) => o.op === 'bezierCurveTo')).toHaveLength(2);
  });

  it('tv_frame은 inset rect', () => {
    const pb = makeStub();
    buildFramingPath({ kind: 'tv_frame', framePath: '/frames/tv.png' }, pb, 1000, 2000);
    const rect = pb.ops.find((o) => o.op === 'rect')!;
    expect(rect.args).toEqual([50, 160, 900, 1680]);
  });
});

describe('framingBox', () => {
  it('circle AABB는 중심±반지름', () => {
    const b = framingBox({ kind: 'circle', centerX: 100, centerY: 200, radius: 50 }, 500, 500);
    expect(b).toEqual({ x: 50, y: 150, w: 100, h: 100 });
  });
  it('hexagon AABB는 size*√3 × 2*size', () => {
    const b = framingBox({ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }, 1080, 1920);
    expect(b.w).toBeCloseTo(380 * Math.sqrt(3), 5);
    expect(b.h).toBe(760);
    expect(b.x).toBeCloseTo(540 - (380 * Math.sqrt(3)) / 2, 5);
  });
  it('fullscreen AABB = 캔버스 전체', () => {
    expect(framingBox({ kind: 'fullscreen' }, 1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });
});

describe('isPointInsideFraming', () => {
  it('원 내부/외부 정확 판정', () => {
    const f = { kind: 'circle' as const, centerX: 100, centerY: 100, radius: 50 };
    expect(isPointInsideFraming(f, 100, 100, 500, 500)).toBe(true);
    expect(isPointInsideFraming(f, 100, 160, 500, 500)).toBe(false);
  });
  it('rounded_rect AABB 판정', () => {
    const f = { kind: 'rounded_rect' as const, x: 10, y: 20, w: 100, h: 200, radius: 8 };
    expect(isPointInsideFraming(f, 50, 50, 500, 500)).toBe(true);
    expect(isPointInsideFraming(f, 200, 50, 500, 500)).toBe(false);
  });
});

describe('computeCoverDrawArgs', () => {
  it('src 720x1280 → hexagon AABB (약 658×760)에 cover', () => {
    const box = framingBox({ kind: 'hexagon', centerX: 540, centerY: 960, size: 380 }, 1080, 1920);
    const a = computeCoverDrawArgs(720, 1280, box);
    // src aspect 0.5625, dst aspect ~0.866 → src가 더 좁음 → 상하 크롭
    expect(a.sx).toBe(0);
    expect(a.sw).toBe(720);
    expect(a.sh).toBeLessThan(1280);
    expect(a.dw).toBeCloseTo(box.w, 5);
    expect(a.dh).toBe(box.h);
  });

  it('src가 더 넓으면 좌우 크롭', () => {
    const a = computeCoverDrawArgs(1920, 1080, { x: 0, y: 0, w: 100, h: 100 });
    expect(a.sy).toBe(0);
    expect(a.sh).toBe(1080);
    expect(a.sw).toBe(1080); // square destination → 정사각 크롭
    expect(a.sx).toBeCloseTo((1920 - 1080) / 2, 5);
  });
});
