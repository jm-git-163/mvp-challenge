import { describe, it, expect } from 'vitest';
import { kineticCharStates, karaokeState, beatTextScale, newsTickerOffset, interpolatedPosition } from './text';

describe('kineticCharStates', () => {
  it('시작 시 모든 글자 alpha=0', () => {
    const s = kineticCharStates('ABC', 0);
    expect(s[0].alpha).toBe(0);
    expect(s[2].alpha).toBe(0);
  });
  it('전부 경과 후 모든 글자 alpha=1, scale=1', () => {
    const s = kineticCharStates('ABC', 10000);
    for (const c of s) {
      expect(c.alpha).toBe(1);
      expect(c.scale).toBe(1);
      expect(c.translateY).toBe(0);
    }
  });
  it('첫 글자가 두 번째 글자보다 먼저 등장', () => {
    const s = kineticCharStates('AB', 100);
    expect(s[0].alpha).toBeGreaterThan(s[1].alpha);
  });
});

describe('karaokeState', () => {
  it('아무 말도 안 하면 모두 pending', () => {
    const s = karaokeState('안녕 세상 좋은 날', '');
    expect(s.every((w) => w.state === 'pending')).toBe(true);
  });
  it('첫 어절 발화 중 → spoken, 나머지 pending', () => {
    const s = karaokeState('안녕 세상 좋은 날', '안');
    expect(s[0].state).toBe('spoken');
    expect(s[1].state).toBe('pending');
  });
  it('앞 두 어절 완료 + 셋째 진행 중', () => {
    const s = karaokeState('안녕 세상 좋은 날', '안녕 세상 좋');
    expect(s[0].state).toBe('matched');
    expect(s[1].state).toBe('matched');
    expect(s[2].state).toBe('spoken');
    expect(s[3].state).toBe('pending');
  });
});

describe('beatTextScale', () => {
  it('비트 직후 1, 중간에 피크, 200ms 후 1', () => {
    expect(beatTextScale(0, 500)).toBe(1);
    expect(beatTextScale(100, 500)).toBeGreaterThan(1.1);
    expect(beatTextScale(200, 500)).toBe(1);
  });
});

describe('newsTickerOffset', () => {
  it('시작 시 canvasW 위치', () => {
    expect(newsTickerOffset(0, 100, 500, 1080)).toBeCloseTo(1080, 5);
  });
  it('시간 경과 시 왼쪽으로', () => {
    const a = newsTickerOffset(1000, 200, 500, 1080);
    expect(a).toBeLessThan(1080);
  });
  it('한 사이클 지나면 반복', () => {
    const cycle = 500 + 1080;
    const a = newsTickerOffset((cycle / 200) * 1000, 200, 500, 1080);
    expect(a).toBeCloseTo(1080, 1);
  });
});

describe('interpolatedPosition', () => {
  it('0ms → from', () => {
    const p = interpolatedPosition(0, 0, 100, 200, 0, 500);
    expect(p).toEqual({ x: 0, y: 0 });
  });
  it('종료 → to', () => {
    const p = interpolatedPosition(0, 0, 100, 200, 500, 500);
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });
});
