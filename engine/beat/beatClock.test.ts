import { describe, it, expect } from 'vitest';
import { BeatClock, synthesizeBeats, validateBeatData, type TimeSource, type BeatData } from './beatClock';

class FakeSource implements TimeSource {
  t = 0;
  playing = true;
  getCurrentTime() { return this.t; }
  isPlaying() { return this.playing; }
}

describe('synthesizeBeats', () => {
  it('120bpm 5초 → 10 비트 (0.5s 간격)', () => {
    const d = synthesizeBeats(120, 5);
    expect(d.beats.length).toBe(10);
    expect(d.beats[1]).toBeCloseTo(0.5, 3);
    // 4비트마다 downbeat
    expect(d.downbeats.length).toBe(3);
  });
});

describe('validateBeatData', () => {
  it('bpm <= 0 throw', () => {
    expect(() => validateBeatData({ bpm: 0, beats: [], onsets: [], downbeats: [] })).toThrow();
  });
  it('역순 beats throw', () => {
    expect(() => validateBeatData({ bpm: 120, beats: [1, 0.5], onsets: [], downbeats: [] })).toThrow();
  });
});

describe('BeatClock 콜백', () => {
  it('tick 시점까지 지난 비트 모두 emit', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10));  // 0.5s 간격
    const seen: number[] = [];
    bc.onBeat((i) => seen.push(i));
    src.t = 1.2;
    bc.tick();
    // 0, 0.5, 1.0 비트 지남
    expect(seen).toEqual([0, 1, 2]);
  });

  it('정지 상태면 tick 무시', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10));
    src.playing = false;
    src.t = 5;
    const seen: number[] = [];
    bc.onBeat((i) => seen.push(i));
    bc.tick();
    expect(seen).toEqual([]);
  });

  it('downbeat은 4비트마다 (기본)', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10));
    const seen: number[] = [];
    bc.onDownbeat((i) => seen.push(i));
    src.t = 2.1; // 0, 2.0 다운비트 지남
    bc.tick();
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });

  it('unsubscribe 작동', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10));
    let count = 0;
    const off = bc.onBeat(() => { count++; });
    src.t = 0.6; bc.tick();
    const first = count;
    off();
    src.t = 1.2; bc.tick();
    expect(count).toBe(first); // 증가하지 않음
  });

  it('reset(tSec)로 이전 비트는 스킵, 이후 비트부터 emit', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10)); // 0.5s 간격, idx 0=0.0, 6=3.0, 7=3.5
    bc.reset(3.0); // nextBeatIdx = "> 3.0"인 첫 인덱스 → 7 (3.5)
    const seen: number[] = [];
    bc.onBeat((i) => seen.push(i));
    src.t = 3.6;
    bc.tick();
    expect(seen).toEqual([7]); // 3.5 비트만 fire
  });
});

describe('BeatClock phase', () => {
  it('비트 중간에서 getBeatPhase ≈ 0.5', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10)); // 0.5s period
    src.t = 0.25;
    expect(bc.getBeatPhase()).toBeCloseTo(0.5, 2);
  });

  it('소절 초반 getBarPhase < 0.5', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    bc.start(src, synthesizeBeats(120, 10));
    src.t = 0.4; // 소절이 2초이므로 20%
    expect(bc.getBarPhase()).toBeLessThan(0.5);
  });
});

describe('BeatClock 데이터 검증 실패', () => {
  it('잘못된 BeatData start 거부', () => {
    const bc = new BeatClock();
    const src = new FakeSource();
    const bad: BeatData = { bpm: -1, beats: [], onsets: [], downbeats: [] };
    expect(() => bc.start(src, bad)).toThrow();
  });
});
