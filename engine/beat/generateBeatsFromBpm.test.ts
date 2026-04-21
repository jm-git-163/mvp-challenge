/**
 * engine/beat/generateBeatsFromBpm.test.ts
 *
 * Focused Session-3 Candidate K 검증.
 */
import { describe, it, expect } from 'vitest';
import {
  generateBeatsFromBpm,
  serializeBeatData,
} from './generateBeatsFromBpm';

describe('generateBeatsFromBpm', () => {
  it('120 BPM, 30초 → 60~61 비트', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 30 });
    expect(d.bpm).toBe(120);
    expect(d.beats.length).toBeGreaterThanOrEqual(60);
    expect(d.beats.length).toBeLessThanOrEqual(61);
  });

  it('beats 오름차순', () => {
    const d = generateBeatsFromBpm({ bpm: 128, durationSec: 20 });
    for (let i = 1; i < d.beats.length; i++) {
      expect(d.beats[i]).toBeGreaterThan(d.beats[i - 1]);
    }
  });

  it('downbeats ⊆ beats (4/4 기본, 매 4번째)', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 10 });
    // 120 BPM × 10s = 20 beats → 5 downbeats
    expect(d.downbeats.length).toBe(Math.ceil(d.beats.length / 4));
    for (const db of d.downbeats) {
      expect(d.beats).toContain(db);
    }
  });

  it('6/8 박자: beatsPerBar=6', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 10, beatsPerBar: 6 });
    expect(d.downbeats.length).toBe(Math.ceil(d.beats.length / 6));
  });

  it('모든 타임스탬프는 0..durationSec 범위', () => {
    const d = generateBeatsFromBpm({ bpm: 124, durationSec: 15 });
    for (const t of d.beats) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(15);
    }
  });

  it('startOffsetSec 적용: 첫 비트가 오프셋 이상', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 10, startOffsetSec: 1.5 });
    expect(d.beats[0]).toBeGreaterThanOrEqual(1.5);
  });

  it('결정적: 동일 옵션 → 동일 결과', () => {
    const a = generateBeatsFromBpm({ bpm: 90, durationSec: 30, beatsPerBar: 4 });
    const b = generateBeatsFromBpm({ bpm: 90, durationSec: 30, beatsPerBar: 4 });
    expect(a).toEqual(b);
  });

  it('onsets = beats 복사 (독립 배열)', () => {
    const d = generateBeatsFromBpm({ bpm: 100, durationSec: 5 });
    expect(d.onsets).toEqual(d.beats);
    expect(d.onsets).not.toBe(d.beats); // 참조 달라야 함
  });

  it('durationSec=0 → 원점 비트만 1개', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 0 });
    expect(d.beats).toEqual([0]);
    expect(d.downbeats).toEqual([0]);
  });

  it('잘못된 bpm 보정: ≤0 → 1', () => {
    const d = generateBeatsFromBpm({ bpm: 0, durationSec: 10 });
    expect(d.bpm).toBe(1);
  });

  it('소수점 3자리 반올림', () => {
    const d = generateBeatsFromBpm({ bpm: 124, durationSec: 5 });
    for (const t of d.beats) {
      const scaled = t * 1000;
      expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-9);
    }
  });
});

describe('serializeBeatData', () => {
  it('키 순서 고정: bpm → beats → onsets → downbeats', () => {
    const d = generateBeatsFromBpm({ bpm: 128, durationSec: 2 });
    const json = serializeBeatData(d);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual(['bpm', 'beats', 'onsets', 'downbeats']);
  });

  it('2-space indent', () => {
    const d = generateBeatsFromBpm({ bpm: 120, durationSec: 1 });
    const json = serializeBeatData(d);
    expect(json).toContain('\n  "bpm"');
  });
});
