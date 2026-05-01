/**
 * engine/curation/highlightSelector.test.ts
 *
 * 90초 mock 타임라인에서 30초 추출 시 평균 점수가 +25% 이상.
 */
import { describe, it, expect } from 'vitest';
import {
  selectHighlights,
  totalDurationOf,
  averageScoreInSegments,
} from './highlightSelector';
import type { ScoreTimelineEntry } from '../scoring/scoreTimeline';

function buildMockTimeline(): ScoreTimelineEntry[] {
  const out: ScoreTimelineEntry[] = [];
  // 90초 — 1초 윈도우 90개. 점수 패턴:
  //  - 0~30s: 낮음 (0.2~0.3) 평지
  //  - 30~45s: 급상승 + count 이벤트 다수
  //  - 45~60s: 고점 유지 (0.85)
  //  - 60~75s: 떨어짐 (0.4)
  //  - 75~90s: 다시 match 이벤트 + 상승
  for (let t = 0; t < 90; t++) {
    let score: number;
    let event: ScoreTimelineEntry['event'] = 'idle';
    if (t < 30) {
      score = 0.2 + (t % 3) * 0.03;
    } else if (t < 45) {
      score = 0.3 + (t - 30) * 0.04;
      if (t % 3 === 0) event = 'count';
    } else if (t < 60) {
      score = 0.85;
      if (t === 50) event = 'count';
    } else if (t < 75) {
      score = 0.40;
      if (t === 70) event = 'fail';
    } else {
      score = 0.55 + (t - 75) * 0.02;
      if (t === 80 || t === 85) event = 'match';
    }
    out.push({
      tMs: t * 1000,
      score,
      missionId: '1:gesture',
      event,
    });
  }
  return out;
}

describe('selectHighlights', () => {
  it('빈 타임라인이면 빈 결과', () => {
    expect(selectHighlights([], { totalDurationMs: 60000 })).toEqual([]);
  });

  it('90초 → 30초±5 추출, 평균 점수 +25% 이상', () => {
    const timeline = buildMockTimeline();
    const total = 90_000;
    const baseline =
      timeline.reduce((a, b) => a + b.score, 0) / timeline.length;

    const segs = selectHighlights(timeline, {
      totalDurationMs: total,
      targetTotalMs: 30_000,
      toleranceMs: 5_000,
    });

    expect(segs.length).toBeGreaterThan(0);
    const dur = totalDurationOf(segs);
    expect(dur).toBeGreaterThanOrEqual(25_000);
    expect(dur).toBeLessThanOrEqual(35_000);

    const highlightAvg = averageScoreInSegments(timeline, segs);
    // 베이스라인 대비 +25% 이상
    expect(highlightAvg).toBeGreaterThanOrEqual(baseline * 1.25);
  });

  it('시간순 정렬 + 인접 구간 병합', () => {
    const timeline = buildMockTimeline();
    const segs = selectHighlights(timeline, { totalDurationMs: 90_000 });
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].startMs).toBeGreaterThanOrEqual(segs[i - 1].endMs);
    }
  });

  it('결정론적 — 같은 입력 같은 출력', () => {
    const tl = buildMockTimeline();
    const a = selectHighlights(tl, { totalDurationMs: 90_000 });
    const b = selectHighlights(tl, { totalDurationMs: 90_000 });
    expect(a).toEqual(b);
  });

  it('구간 끝은 totalDurationMs 를 초과하지 않음', () => {
    const timeline = buildMockTimeline();
    const segs = selectHighlights(timeline, { totalDurationMs: 90_000 });
    for (const s of segs) {
      expect(s.startMs).toBeGreaterThanOrEqual(0);
      expect(s.endMs).toBeLessThanOrEqual(90_000);
      expect(s.endMs).toBeGreaterThan(s.startMs);
    }
  });
});
