/**
 * engine/missions/loudVoiceMission.ts
 *
 * Phase 1 — 큰 소리 미션.
 *
 * CLAUDE.md §5 Loud Voice: dB 60 + 지속 40.
 *
 * 입력: 매 프레임 smoothedDbFS 값 (engine/recognition/audioAnalyser.ts).
 * 출력:
 *   - dBScore: 세션 최대 smoothedDbFS을 −40 → −10 dB 구간에 선형 매핑
 *   - sustainScore: 임계값 이상 연속 프레임 최장 구간을 targetMs에 매핑
 */

export interface LoudVoiceMissionParams {
  /** 이 dBFS 이상이면 "큰 소리". */
  activateDb?: number;    // 기본 −20
  /** hysteresis 복귀점. */
  deactivateDb?: number;  // 기본 −25
  /** dB 점수 만점 기준. */
  maxDb?: number;         // 기본 −10
  /** dB 점수 0점 기준. */
  minDb?: number;         // 기본 −40
  /** 유지 만점 기준 (ms). */
  targetSustainMs?: number; // 기본 2000
}

const DEFAULTS: Required<LoudVoiceMissionParams> = {
  activateDb: -20,
  deactivateDb: -25,
  maxDb: -10,
  minDb: -40,
  targetSustainMs: 2000,
};

export interface LoudVoiceState {
  active: boolean;
  activeSince: number | null;
  peakDb: number;
  bestSustainedMs: number;
  lastT: number | null;
}

export class LoudVoiceMission {
  private readonly p: Required<LoudVoiceMissionParams>;
  private s: LoudVoiceState = {
    active: false, activeSince: null, peakDb: -100,
    bestSustainedMs: 0, lastT: null,
  };

  constructor(params: LoudVoiceMissionParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  push(dbFS: number, t: number): LoudVoiceState {
    this.s.peakDb = Math.max(this.s.peakDb, dbFS);
    this.s.lastT = t;

    const wasActive = this.s.active;
    if (!wasActive && dbFS >= this.p.activateDb) {
      this.s.active = true;
      this.s.activeSince = t;
    } else if (wasActive && dbFS <= this.p.deactivateDb) {
      if (this.s.activeSince !== null) {
        this.s.bestSustainedMs = Math.max(this.s.bestSustainedMs, t - this.s.activeSince);
      }
      this.s.active = false;
      this.s.activeSince = null;
    }
    if (this.s.active && this.s.activeSince !== null) {
      this.s.bestSustainedMs = Math.max(this.s.bestSustainedMs, t - this.s.activeSince);
    }

    return this.s;
  }

  getState(): LoudVoiceState { return this.s; }

  dbScore(): number {
    const db = Math.max(this.p.minDb, Math.min(this.p.maxDb, this.s.peakDb));
    return (db - this.p.minDb) / (this.p.maxDb - this.p.minDb);
  }
  sustainScore(): number {
    return Math.min(1, this.s.bestSustainedMs / this.p.targetSustainMs);
  }

  /** CLAUDE §5: dB*60 + sustain*40. */
  totalScore(): number {
    return Math.round(this.dbScore() * 60 + this.sustainScore() * 40);
  }

  reset(): void {
    this.s = { active: false, activeSince: null, peakDb: -100, bestSustainedMs: 0, lastT: null };
  }
}
