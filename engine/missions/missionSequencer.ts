/**
 * engine/missions/missionSequencer.ts
 *
 * Phase 5 wave2 (2026-05-01) — **미션 체이닝 시스템**.
 *
 * 한 챌린지 = 미션 3~5개 연속 (예: 스쿼트 5회 → 짧은 자막 한 줄 → 포즈 홀드 3초 → 손 V).
 *
 *   - 각 미션 종료 → 1초 트랜지션 (글로우 페이드) → 다음 미션 자동 시작
 *   - 카메라/녹화는 단일 MediaRecorder 세션 유지 (시퀀서는 점수·상태만 관리)
 *   - 미션별 점수 합산 + 보너스: 연속 성공 시 +10% (각 연속 성공마다 누적, 최대 +50%)
 *
 * 결정론 — Math.random 등 비결정 호출 금지. 외부 시간 주입(now ms).
 *
 * 사용 예:
 *   const seq = new MissionSequencer({
 *     missions: [
 *       { id: 'sq', kind: 'squat_count', target: 5 },
 *       { id: 'rd', kind: 'read_script', script: '나는 할 수 있다' },
 *       { id: 'vs', kind: 'gesture', gesture: 'Victory' },
 *     ],
 *     transitionMs: 1000,
 *   });
 *   seq.start(0);
 *   // 매 프레임:
 *   seq.tick(nowMs, missionResultIfFinished);
 *   // 미션이 끝났다 보고할 때:
 *   seq.completeCurrent({ score: 80, success: true });
 *   // 종료 시:
 *   const total = seq.aggregate();
 */

import type { MissionResult, SessionScore } from '../scoring/scorer';
import { aggregate, clampScore, starsFromScore } from '../scoring/scorer';

// 미션 한 단계 — schema.zMissionSpec 와 동일 구조에 id/label 추가.
export type MissionStep =
  | { id: string; label?: string; kind: 'squat_count'; target: number }
  | { id: string; label?: string; kind: 'smile'; intensity: number; durationMs: number }
  | { id: string; label?: string; kind: 'gesture'; gesture: string; sequence?: string[] }
  | { id: string; label?: string; kind: 'pose_hold'; pose: string; holdMs: number }
  | { id: string; label?: string; kind: 'loud_voice'; minDb: number; durationMs: number }
  | { id: string; label?: string; kind: 'read_script'; script: string | string[] };

export interface TransitionConfig {
  /** ms. 0이면 즉시 다음 미션. 기본 1000ms 글로우 페이드. */
  durationMs?: number;
  /** 'glow_fade' | 'flash' | 'none' — 컴포지션 엔진이 해석. */
  kind?: 'glow_fade' | 'flash' | 'none';
}

export interface MissionSequence {
  missions: MissionStep[];
  transitions?: TransitionConfig[]; // missions.length-1 개. 부족하면 마지막 값 반복.
  /** 각 미션 가중치. 생략 시 균등. */
  weights?: number[];
  /** 연속 성공 보너스 — 단계당 % (default 10). 0이면 비활성. */
  comboBonusPct?: number;
  /** 보너스 상한 % (default 50). */
  comboBonusMaxPct?: number;
  /** 미션 결과 통과 임계점 (default 60). */
  passingScore?: number;
}

export type SequencerPhase = 'idle' | 'running' | 'transitioning' | 'finished';

export interface SequencerState {
  phase: SequencerPhase;
  index: number;            // 현재 미션 인덱스
  currentMission: MissionStep | null;
  comboCount: number;       // 연속 성공 누적
  startedAtMs: number;
  transitionEndsAtMs: number;
  results: MissionResult[];
}

export interface CompleteInput {
  score: number;
  success: boolean;
  detail?: Record<string, unknown>;
}

export class MissionSequencer {
  private readonly seq: MissionSequence;
  private state: SequencerState;
  private listeners = new Set<(s: SequencerState) => void>();

  constructor(seq: MissionSequence) {
    if (!seq.missions || seq.missions.length === 0) {
      throw new Error('MissionSequencer: missions empty');
    }
    // 중복 id 검증
    const ids = new Set<string>();
    for (const m of seq.missions) {
      if (ids.has(m.id)) throw new Error(`MissionSequencer: duplicate mission id "${m.id}"`);
      ids.add(m.id);
    }
    this.seq = {
      ...seq,
      transitions: seq.transitions ?? [],
      comboBonusPct: seq.comboBonusPct ?? 10,
      comboBonusMaxPct: seq.comboBonusMaxPct ?? 50,
      passingScore: seq.passingScore ?? 60,
    };
    this.state = {
      phase: 'idle',
      index: -1,
      currentMission: null,
      comboCount: 0,
      startedAtMs: 0,
      transitionEndsAtMs: 0,
      results: [],
    };
  }

  /** 시퀀스 시작. */
  start(nowMs: number): void {
    this.state.phase = 'running';
    this.state.index = 0;
    this.state.currentMission = this.seq.missions[0];
    this.state.startedAtMs = nowMs;
    this.state.results = [];
    this.state.comboCount = 0;
    this.emit();
  }

  /** 매 프레임 호출 — 트랜지션 종료 검출 등. */
  tick(nowMs: number): void {
    if (this.state.phase === 'transitioning' && nowMs >= this.state.transitionEndsAtMs) {
      // 다음 미션 시작
      const nextIdx = this.state.index + 1;
      if (nextIdx >= this.seq.missions.length) {
        this.state.phase = 'finished';
        this.state.currentMission = null;
        this.emit();
        return;
      }
      this.state.index = nextIdx;
      this.state.currentMission = this.seq.missions[nextIdx];
      this.state.phase = 'running';
      this.emit();
    }
  }

  /** 현재 미션을 완료 처리. 외부(렌더 루프 또는 미션 엔진)가 호출. */
  completeCurrent(nowMs: number, input: CompleteInput): void {
    if (this.state.phase !== 'running' || !this.state.currentMission) return;
    const m = this.state.currentMission;
    const baseScore = clampScore(input.score);

    // 연속 성공 보너스 계산. 보너스는 본 미션 점수 자체에 적용.
    if (input.success) {
      this.state.comboCount += 1;
    } else {
      this.state.comboCount = 0;
    }
    const bonusSteps = Math.max(0, this.state.comboCount - 1); // 첫 성공은 보너스 없음, 둘째부터.
    const bonusPct = Math.min(this.seq.comboBonusMaxPct!, bonusSteps * this.seq.comboBonusPct!);
    const finalScore = clampScore(baseScore * (1 + bonusPct / 100));

    const weight = this.seq.weights?.[this.state.index] ?? 1;
    this.state.results.push({
      kind: kindToScoringKind(m.kind),
      id: m.id,
      score: finalScore,
      weight,
      detail: {
        baseScore,
        bonusPct,
        comboCount: this.state.comboCount,
        success: input.success,
        ...input.detail,
      },
    });

    // 트랜지션 진입.
    const tIdx = Math.min(this.state.index, (this.seq.transitions?.length ?? 1) - 1);
    const tConf = this.seq.transitions?.[tIdx] ?? this.seq.transitions?.[0] ?? {};
    const tMs = tConf.durationMs ?? 1000;

    if (this.state.index + 1 >= this.seq.missions.length) {
      // 마지막 미션 → 트랜지션 생략, 즉시 finish.
      this.state.phase = 'finished';
      this.state.currentMission = null;
    } else {
      this.state.phase = 'transitioning';
      this.state.transitionEndsAtMs = nowMs + tMs;
    }
    this.emit();
  }

  /** 강제 종료 — 외부 사유. 남은 미션은 결과에 포함되지 않음. */
  abort(): void {
    this.state.phase = 'finished';
    this.state.currentMission = null;
    this.emit();
  }

  getState(): Readonly<SequencerState> {
    return this.state;
  }

  /** 트랜지션 진행률 0..1 (UI 글로우 페이드용). */
  transitionProgress(nowMs: number): number {
    if (this.state.phase !== 'transitioning') return 0;
    const tIdx = Math.min(this.state.index, (this.seq.transitions?.length ?? 1) - 1);
    const tConf = this.seq.transitions?.[tIdx] ?? this.seq.transitions?.[0] ?? {};
    const tMs = tConf.durationMs ?? 1000;
    if (tMs <= 0) return 1;
    const remain = this.state.transitionEndsAtMs - nowMs;
    return Math.max(0, Math.min(1, 1 - remain / tMs));
  }

  /** 최종 점수. finish 전 호출 가능 — 누적된 결과만 합산. */
  aggregate(): SessionScore {
    return aggregate(this.state.results, { passingScore: this.seq.passingScore });
  }

  /** 별점 (1..5). aggregate 의 stars 와 동일. */
  stars(): number {
    return starsFromScore(this.aggregate().total);
  }

  /** 변화 구독 — UI 바인딩. */
  subscribe(fn: (s: SequencerState) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** 누수 방지 — 시퀀서를 폐기할 때 호출. */
  dispose(): void {
    this.listeners.clear();
    this.state.results = [];
    this.state.currentMission = null;
  }

  private emit(): void {
    for (const l of this.listeners) {
      try { l(this.state); } catch { /* listener 실패 격리 */ }
    }
  }
}

function kindToScoringKind(k: MissionStep['kind']): MissionResult['kind'] {
  switch (k) {
    case 'squat_count': return 'squat';
    case 'read_script': return 'script';
    case 'pose_hold': return 'pose_hold';
    case 'smile': return 'smile';
    case 'gesture': return 'gesture';
    case 'loud_voice': return 'loud_voice';
  }
}
