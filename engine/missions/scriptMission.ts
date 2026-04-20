/**
 * engine/missions/scriptMission.ts
 *
 * Phase 1 — 대본 낭독 미션.
 *
 * CLAUDE.md §5 Script: 레벤슈타인 60 + 완주율 20 + 시간 20.
 *   - 레벤슈타인 = similarity(final, script)
 *   - 완주율 = completion(final, script)   (단어 포함률)
 *   - 시간 = min(1, targetReadMs / elapsedMs)  (빠를수록 만점; 너무 빠르면 similarity가 낮을 것)
 *
 * 사용:
 *   const m = new ScriptMission({ script, targetReadMs: 8000 });
 *   m.begin(tStart);
 *   recognizer.subscribe(({ final }) => m.update(final, now));
 *   m.finish(now); // 총점 계산
 */

import { similarity, completion } from '../recognition/speechRecognizer';

export interface ScriptMissionParams {
  script: string;
  /** 목표 낭독 시간 (ms). 기본 8000. */
  targetReadMs?: number;
  /** 시간 점수 하한 (너무 천천히 읽어도 이 아래로는 안 떨어짐). */
  minTimeScore?: number;
}

export interface ScriptState {
  started: boolean;
  startedAt: number | null;
  endedAt: number | null;
  latestTranscript: string;
}

export class ScriptMission {
  private readonly p: Required<ScriptMissionParams>;
  private s: ScriptState = {
    started: false, startedAt: null, endedAt: null, latestTranscript: '',
  };

  constructor(params: ScriptMissionParams) {
    this.p = {
      targetReadMs: 8000,
      minTimeScore: 0,
      ...params,
    };
  }

  begin(t: number): void {
    this.s.started = true;
    this.s.startedAt = t;
    this.s.endedAt = null;
    this.s.latestTranscript = '';
  }

  update(transcript: string, _t: number): void {
    this.s.latestTranscript = transcript;
  }

  finish(t: number): void {
    this.s.endedAt = t;
  }

  getState(): ScriptState { return this.s; }

  similarity(): number {
    return similarity(this.s.latestTranscript, this.p.script);
  }
  completion(): number {
    return completion(this.s.latestTranscript, this.p.script);
  }
  timeScore(): number {
    if (this.s.startedAt === null) return 0;
    const endT = this.s.endedAt ?? this.s.startedAt;
    const elapsed = endT - this.s.startedAt;
    if (elapsed <= 0) return 1;
    const raw = Math.min(1, this.p.targetReadMs / elapsed);
    return Math.max(this.p.minTimeScore, raw);
  }

  /** 0..100 총점. */
  totalScore(): number {
    return Math.round(this.similarity() * 60 + this.completion() * 20 + this.timeScore() * 20);
  }

  reset(): void {
    this.s = { started: false, startedAt: null, endedAt: null, latestTranscript: '' };
  }
}
