/**
 * engine/missions/missionSequencer.test.ts — Phase 5 wave2.
 */
import { describe, it, expect, vi } from 'vitest';
import { MissionSequencer, type MissionSequence } from './missionSequencer';

const seq5: MissionSequence = {
  missions: [
    { id: 'm1', kind: 'squat_count', target: 5 },
    { id: 'm2', kind: 'read_script', script: '나는 할 수 있다' },
    { id: 'm3', kind: 'pose_hold', pose: 'T', holdMs: 3000 },
    { id: 'm4', kind: 'gesture', gesture: 'Victory' },
    { id: 'm5', kind: 'smile', intensity: 0.5, durationMs: 2000 },
  ],
  transitions: [{ durationMs: 1000, kind: 'glow_fade' }],
};

describe('MissionSequencer', () => {
  it('throws on empty', () => {
    expect(() => new MissionSequencer({ missions: [] } as any)).toThrow();
  });

  it('throws on duplicate id', () => {
    expect(() => new MissionSequencer({
      missions: [
        { id: 'a', kind: 'squat_count', target: 1 },
        { id: 'a', kind: 'squat_count', target: 2 },
      ],
    })).toThrow();
  });

  it('start → running with first mission', () => {
    const s = new MissionSequencer(seq5);
    s.start(0);
    expect(s.getState().phase).toBe('running');
    expect(s.getState().currentMission?.id).toBe('m1');
  });

  it('5-mission sequence with all success: applies combo bonus correctly', () => {
    const s = new MissionSequencer(seq5);
    s.start(0);
    let now = 0;
    for (let i = 0; i < 5; i++) {
      s.completeCurrent(now, { score: 80, success: true });
      // 트랜지션 진행 (마지막 미션은 즉시 finish, 트랜지션 없음).
      if (i < 4) {
        now += 1000;
        s.tick(now);
      }
    }
    expect(s.getState().phase).toBe('finished');

    const results = s.getState().results;
    expect(results).toHaveLength(5);

    // m1: combo=1, bonus 0% → 80
    // m2: combo=2, bonus 10% → 88
    // m3: combo=3, bonus 20% → 96
    // m4: combo=4, bonus 30% → 100 (clamp)
    // m5: combo=5, bonus 40% → 100 (clamp)
    expect(results[0].score).toBe(80);
    expect(results[1].score).toBe(88);
    expect(results[2].score).toBe(96);
    expect(results[3].score).toBe(100);
    expect(results[4].score).toBe(100);

    // 가중평균 (균등): (80+88+96+100+100)/5 = 92.8 → 93
    const agg = s.aggregate();
    expect(agg.total).toBe(93);
    expect(agg.stars).toBeGreaterThanOrEqual(4);
  });

  it('failure resets combo, no bonus', () => {
    const s = new MissionSequencer(seq5);
    s.start(0);
    s.completeCurrent(0, { score: 80, success: true });          // combo 1, bonus 0
    s.tick(1000);
    s.completeCurrent(1000, { score: 50, success: false });      // combo 0, no bonus
    s.tick(2000);
    s.completeCurrent(2000, { score: 80, success: true });       // combo 1, bonus 0
    const r = s.getState().results;
    expect(r[0].score).toBe(80);
    expect(r[1].score).toBe(50);
    expect(r[2].score).toBe(80);
  });

  it('transition phase between missions', () => {
    const s = new MissionSequencer(seq5);
    s.start(0);
    s.completeCurrent(0, { score: 70, success: true });
    expect(s.getState().phase).toBe('transitioning');
    expect(s.transitionProgress(500)).toBeCloseTo(0.5, 1);
    s.tick(1000);
    expect(s.getState().phase).toBe('running');
    expect(s.getState().currentMission?.id).toBe('m2');
  });

  it('subscribe + dispose: no memory leak (listeners cleared)', () => {
    const s = new MissionSequencer(seq5);
    const fn = vi.fn();
    const unsub = s.subscribe(fn);
    s.start(0);
    expect(fn).toHaveBeenCalled();
    unsub();
    s.completeCurrent(0, { score: 50, success: true });
    expect(fn).toHaveBeenCalledTimes(1); // start 만 받음

    const fn2 = vi.fn();
    s.subscribe(fn2);
    s.dispose();
    // dispose 후 listeners 비워짐 → 추가 emit 없음을 검증.
    s.tick(2000);
    expect(fn2).not.toHaveBeenCalled();
  });

  it('completeCurrent ignored when not running', () => {
    const s = new MissionSequencer(seq5);
    s.completeCurrent(0, { score: 80, success: true });
    expect(s.getState().results).toHaveLength(0);
  });
});
