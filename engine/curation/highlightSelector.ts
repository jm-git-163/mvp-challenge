/**
 * engine/curation/highlightSelector.ts
 *
 * 결정론적 점수 시계열에서 "성공·고득점 구간" 만 자동 선별해 짧은 하이라이트
 * 영상 구간 배열을 만든다. 캡컷·캔바와의 차별 핵심 (특허 청구항 §자동 편집).
 *
 * 알고리즘:
 *  1) 'count' / 'match' 이벤트 ±2초 컨텍스트 윈도우 추출
 *  2) score 의 미분 (증가속도) 상위 N% 구간 선별
 *  3) 인접 구간 병합 (gap < 1.5s)
 *  4) 총 길이 30초 ± 5초로 제한 (긴 구간부터 배치)
 *  5) 시간순 정렬
 *
 * 100% 결정론적 — 같은 입력은 같은 출력. random 금지 (CLAUDE.md §3.1).
 */

import type { ScoreTimelineEntry } from '../scoring/scoreTimeline';

export interface HighlightSegment {
  startMs: number;
  endMs: number;
  reason: 'event' | 'score-spike' | 'merged';
  /** 디버그용 — 구간을 만든 점수 합. 정렬·필터에는 안 씀. */
  weight: number;
}

export interface HighlightOptions {
  /** 원본 영상 총 길이 (ms). 구간 끝 클램프. */
  totalDurationMs: number;
  /** 이벤트 ±컨텍스트 윈도우 (ms). 기본 2000. */
  contextMs?: number;
  /** 점수 미분 상위 N% (0~1). 기본 0.30. */
  scoreSpikePercentile?: number;
  /** 인접 구간 병합 gap 한계 (ms). 기본 1500. */
  mergeGapMs?: number;
  /** 목표 총 길이 (ms). 기본 30000. */
  targetTotalMs?: number;
  /** 허용 오차 (ms). 기본 5000. */
  toleranceMs?: number;
  /** 단일 구간 최소 길이 (ms). 기본 1500. */
  minSegmentMs?: number;
}

export function selectHighlights(
  timeline: ScoreTimelineEntry[],
  opts: HighlightOptions,
): HighlightSegment[] {
  const {
    totalDurationMs,
    contextMs = 2000,
    scoreSpikePercentile = 0.30,
    mergeGapMs = 1500,
    targetTotalMs = 30000,
    toleranceMs = 5000,
    minSegmentMs = 1500,
  } = opts;

  if (timeline.length === 0 || totalDurationMs <= 0) return [];

  const candidates: HighlightSegment[] = [];

  // 1) 이벤트 ±컨텍스트
  for (const e of timeline) {
    if (e.event === 'count' || e.event === 'match') {
      candidates.push({
        startMs: Math.max(0, e.tMs - contextMs),
        endMs: Math.min(totalDurationMs, e.tMs + contextMs),
        reason: 'event',
        weight: e.score + 1, // 이벤트 보너스
      });
    }
  }

  // 2) 점수 미분 (증가속도) 상위 N%
  const deltas: { idx: number; delta: number; tMs: number }[] = [];
  for (let i = 1; i < timeline.length; i++) {
    const d = timeline[i].score - timeline[i - 1].score;
    deltas.push({ idx: i, delta: d, tMs: timeline[i].tMs });
  }
  if (deltas.length > 0) {
    const sorted = [...deltas].sort((a, b) => b.delta - a.delta);
    const cutoffN = Math.max(1, Math.floor(sorted.length * scoreSpikePercentile));
    const cutoff = sorted[cutoffN - 1].delta;
    // 양수 미분만 (점수 떨어지는 구간 제외).
    if (cutoff > 0) {
      // 추가 게이트: 절대 점수가 timeline 평균보다 높을 때만 highlight 후보로.
      //   "0.1 → 0.3 으로 올랐다" 같은 가난한 spike 는 결과 영상에 안 좋음.
      const avgScore = timeline.reduce((a, b) => a + b.score, 0) / timeline.length;
      for (const d of deltas) {
        if (d.delta >= cutoff && timeline[d.idx].score >= avgScore) {
          candidates.push({
            startMs: Math.max(0, d.tMs - contextMs),
            endMs: Math.min(totalDurationMs, d.tMs + contextMs),
            reason: 'score-spike',
            weight: d.delta + (timeline[d.idx].score),
          });
        }
      }
    }
  }

  if (candidates.length === 0) return [];

  // 3) 인접 구간 병합
  candidates.sort((a, b) => a.startMs - b.startMs);
  const merged: HighlightSegment[] = [];
  for (const c of candidates) {
    const last = merged[merged.length - 1];
    if (last && c.startMs <= last.endMs + mergeGapMs) {
      last.endMs = Math.max(last.endMs, c.endMs);
      last.weight += c.weight;
      last.reason = 'merged';
    } else {
      merged.push({ ...c });
    }
  }

  // 최소 길이 필터
  const longEnough = merged.filter((s) => s.endMs - s.startMs >= minSegmentMs);
  if (longEnough.length === 0) return [];

  // 각 merged 구간의 평균 점수를 weight 로 재계산 — 최종 픽 기준이 "고득점" 우선이 되도록.
  for (const seg of longEnough) {
    let sum = 0; let n = 0;
    for (const e of timeline) {
      if (e.tMs >= seg.startMs && e.tMs < seg.endMs) { sum += e.score; n += 1; }
    }
    seg.weight = n > 0 ? sum / n : 0;
  }

  // 4) 목표 길이로 제한 — weight 내림차순으로 채우다 budget 초과하면 stop.
  const budgetMin = targetTotalMs - toleranceMs;
  const budgetMax = targetTotalMs + toleranceMs;
  const byWeight = [...longEnough].sort((a, b) => b.weight - a.weight);

  // baseline: 전체 평균 점수 — 평균 미만 구간은 highlight 자격 박탈.
  const baseline = timeline.reduce((a, b) => a + b.score, 0) / timeline.length;
  const aboveBaseline = byWeight.filter((s) => s.weight >= baseline);

  const picked: HighlightSegment[] = [];
  let total = 0;
  // 1차 패스: 평균 이상 + 가중치(=segment 내 평균 점수) 큰 것부터.
  for (const seg of aboveBaseline) {
    const len = seg.endMs - seg.startMs;
    if (total + len <= budgetMax) {
      picked.push(seg);
      total += len;
    }
  }
  // 2차 패스: budgetMin 미달이면 평균 이상 후보의 고득점 부분만 trim.
  if (total < budgetMin) {
    for (const seg of aboveBaseline) {
      if (picked.includes(seg)) continue;
      const room = budgetMax - total;
      const len = seg.endMs - seg.startMs;
      if (room >= minSegmentMs) {
        // segment 내부에서 가장 점수 높은 sub-window (room ms) 선택.
        const sub = pickBestSubWindow(timeline, seg, room);
        picked.push({
          startMs: sub.startMs,
          endMs: sub.endMs,
          reason: seg.reason,
          weight: seg.weight,
        });
        total += sub.endMs - sub.startMs;
      } else if (total + len <= budgetMax) {
        picked.push(seg);
        total += len;
      }
      if (total >= budgetMin) break;
    }
  }
  // budgetMin 도 못 맞췄으면, 위 baseline 게이트 없이 남은 byWeight 채움 (소수 케이스 안전망).
  if (total < budgetMin) {
    for (const seg of byWeight) {
      if (picked.includes(seg)) continue;
      const len = seg.endMs - seg.startMs;
      if (total + len <= budgetMax) {
        picked.push(seg);
        total += len;
      }
      if (total >= budgetMin) break;
    }
  }

  // 5) 시간순 정렬
  picked.sort((a, b) => a.startMs - b.startMs);

  return picked;
}

/** segment 안에서 점수 최대화하는 길이 windowMs 의 sub-window 를 찾는다. */
function pickBestSubWindow(
  timeline: ScoreTimelineEntry[],
  seg: HighlightSegment,
  windowMs: number,
): { startMs: number; endMs: number } {
  const inside = timeline.filter((e) => e.tMs >= seg.startMs && e.tMs < seg.endMs);
  if (inside.length === 0) {
    return { startMs: seg.startMs, endMs: Math.min(seg.endMs, seg.startMs + windowMs) };
  }
  let best = { startMs: seg.startMs, endMs: Math.min(seg.endMs, seg.startMs + windowMs), avg: -1 };
  for (const e of inside) {
    const startMs = Math.max(seg.startMs, e.tMs - windowMs / 2);
    const endMs = Math.min(seg.endMs, startMs + windowMs);
    let sum = 0; let n = 0;
    for (const x of inside) {
      if (x.tMs >= startMs && x.tMs < endMs) { sum += x.score; n += 1; }
    }
    const avg = n > 0 ? sum / n : 0;
    if (avg > best.avg) best = { startMs, endMs, avg };
  }
  return { startMs: best.startMs, endMs: best.endMs };
}

/** 선별된 구간 합산 길이. */
export function totalDurationOf(segments: HighlightSegment[]): number {
  return segments.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
}

/** 시계열에서 평균 점수 계산 (구간 안에 들어온 entry 만). */
export function averageScoreInSegments(
  timeline: ScoreTimelineEntry[],
  segments: HighlightSegment[],
): number {
  if (timeline.length === 0 || segments.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const e of timeline) {
    for (const s of segments) {
      if (e.tMs >= s.startMs && e.tMs < s.endMs) {
        sum += e.score;
        n += 1;
        break;
      }
    }
  }
  return n > 0 ? sum / n : 0;
}
