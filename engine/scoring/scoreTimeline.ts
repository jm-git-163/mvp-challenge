/**
 * engine/scoring/scoreTimeline.ts
 *
 * 자동 큐레이션(하이라이트 추출) 의 입력이 되는 결정론적 점수 시계열.
 *
 * - 챌린지 진행 중 매 1초(샘플 간격) 마다 한 번씩 누적 점수·미션 상태·이벤트를 기록한다.
 * - frameTags(120ms 단위) 와는 별도로, "사람이 보고 이해할 수 있는" 거친 입자.
 * - 100% 클라이언트. 서버 전송 금지 (CLAUDE.md §12).
 */

export type TimelineEventKind = 'count' | 'match' | 'fail' | 'idle';

export interface ScoreTimelineEntry {
  /** 녹화 시작 = 0. ms 단위. */
  tMs: number;
  /** 0~1 정규화 누적 점수 (해당 1초 윈도우의 평균). */
  score: number;
  /** 활성 미션 식별자 — `${seq}:${type}`. 없으면 'idle'. */
  missionId: string;
  /** 이 윈도우의 대표 이벤트. */
  event: TimelineEventKind;
}

export interface ScoreTimelineSample {
  tMs: number;
  score: number;
  missionId?: string;
  /** 이 1초 안에 발생한 즉발 이벤트들 — count, match. */
  events?: TimelineEventKind[];
}

/**
 * 1초 윈도우로 압축. 같은 윈도우 안에서:
 *   - score 는 평균
 *   - missionId 는 마지막 값
 *   - event 는 count > match > fail > idle 우선순위
 */
export function compressToTimeline(samples: ScoreTimelineSample[]): ScoreTimelineEntry[] {
  if (samples.length === 0) return [];
  const buckets = new Map<number, ScoreTimelineEntry & { _count: number }>();
  for (const s of samples) {
    const bucket = Math.floor(s.tMs / 1000) * 1000;
    const cur = buckets.get(bucket);
    const ev = pickEvent(s.events);
    if (!cur) {
      buckets.set(bucket, {
        tMs: bucket,
        score: s.score,
        missionId: s.missionId ?? 'idle',
        event: ev,
        _count: 1,
      });
    } else {
      cur.score += s.score;
      cur._count += 1;
      cur.missionId = s.missionId ?? cur.missionId;
      cur.event = mergeEvent(cur.event, ev);
    }
  }
  const out: ScoreTimelineEntry[] = [];
  for (const v of buckets.values()) {
    out.push({
      tMs: v.tMs,
      score: v.score / v._count,
      missionId: v.missionId,
      event: v.event,
    });
  }
  out.sort((a, b) => a.tMs - b.tMs);
  return out;
}

function pickEvent(events: TimelineEventKind[] | undefined): TimelineEventKind {
  if (!events || events.length === 0) return 'idle';
  if (events.includes('count')) return 'count';
  if (events.includes('match')) return 'match';
  if (events.includes('fail')) return 'fail';
  return 'idle';
}

function mergeEvent(a: TimelineEventKind, b: TimelineEventKind): TimelineEventKind {
  const order: TimelineEventKind[] = ['count', 'match', 'fail', 'idle'];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

/**
 * 라이브 수집 헬퍼. judge() 결과물을 매 프레임 push 하면 1초 단위로 자동 압축된다.
 */
export class ScoreTimelineCollector {
  private samples: ScoreTimelineSample[] = [];
  private pendingEvents: TimelineEventKind[] = [];
  private lastSquatCount = 0;
  private lastTier: string | null = null;

  pushFrame(args: {
    tMs: number;
    score: number;
    missionId?: string;
    squatCount?: number;
    judgementTier?: 'perfect' | 'good' | 'so-so' | 'miss' | null;
    judgementAt?: number | null;
  }): void {
    const events: TimelineEventKind[] = [...this.pendingEvents];
    this.pendingEvents = [];

    if (args.squatCount !== undefined && args.squatCount > this.lastSquatCount) {
      events.push('count');
      this.lastSquatCount = args.squatCount;
    }

    if (args.judgementTier && args.judgementAt) {
      const key = `${args.judgementTier}@${args.judgementAt}`;
      if (key !== this.lastTier) {
        if (args.judgementTier === 'perfect' || args.judgementTier === 'good') {
          events.push('match');
        } else if (args.judgementTier === 'miss') {
          events.push('fail');
        }
        this.lastTier = key;
      }
    }

    this.samples.push({
      tMs: args.tMs,
      score: args.score,
      missionId: args.missionId,
      events: events.length > 0 ? events : undefined,
    });
  }

  /** 외부에서 직접 이벤트 주입 (예: 자막 final match). */
  pushEvent(ev: TimelineEventKind): void {
    this.pendingEvents.push(ev);
  }

  build(): ScoreTimelineEntry[] {
    return compressToTimeline(this.samples);
  }

  reset(): void {
    this.samples = [];
    this.pendingEvents = [];
    this.lastSquatCount = 0;
    this.lastTier = null;
  }

  /** 디버그/테스트용. */
  getRawSamples(): ScoreTimelineSample[] {
    return this.samples.slice();
  }
}
