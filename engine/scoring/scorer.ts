/**
 * engine/scoring/scorer.ts
 *
 * Phase 2 — 미션별 스코어러 공통 인터페이스 + 점수 집계.
 *
 * CLAUDE.md §5:
 *   미션별 0..100 점수 공식은 각 `engine/missions/*`에서 이미 구현됨.
 *   본 모듈은 다수 미션을 하나의 세션 점수로 집계하고,
 *   별점(1 + round(총점/25))과 세부 브레이크다운을 생성한다.
 *
 * 결정론 원칙: Math.random 등 비결정 호출 금지 (CLAUDE §3 FORBIDDEN #2).
 */

/** 스코어러가 구현해야 하는 최소 인터페이스. 모든 미션 클래스가 만족. */
export interface Scorer {
  /** 0..100. 정수. */
  totalScore(): number;
}

export type MissionKind = 'squat' | 'script' | 'pose_hold' | 'smile' | 'gesture' | 'loud_voice';

export interface MissionResult {
  kind: MissionKind;
  /** 미션 ID (템플릿이 여러 미션 가질 때). */
  id: string;
  score: number;   // 0..100 (정수)
  weight: number;  // 세션 내 비중 (합이 1이 되도록 aggregator가 정규화)
  /** 자유 형식 세부 데이터 (UI 표시용). */
  detail?: Record<string, unknown>;
}

export interface SessionScore {
  total: number;       // 0..100
  stars: number;       // 1..5
  missions: MissionResult[];
  /** 통과 여부 (>= passingScore). */
  passed: boolean;
}

export interface AggregateOptions {
  /** 통과 임계점. 기본 60. */
  passingScore?: number;
}

/**
 * 가중 평균으로 세션 점수 계산. weight가 모두 0이면 단순 평균.
 */
export function aggregate(missions: MissionResult[], opts: AggregateOptions = {}): SessionScore {
  const passing = opts.passingScore ?? 60;
  if (missions.length === 0) {
    return { total: 0, stars: 1, missions: [], passed: false };
  }

  const weightSum = missions.reduce((s, m) => s + Math.max(0, m.weight), 0);
  let total: number;
  if (weightSum <= 0) {
    total = missions.reduce((s, m) => s + clampScore(m.score), 0) / missions.length;
  } else {
    total = missions.reduce((s, m) => s + clampScore(m.score) * (Math.max(0, m.weight) / weightSum), 0);
  }

  const rounded = Math.round(total);
  return {
    total: rounded,
    stars: starsFromScore(rounded),
    missions,
    passed: rounded >= passing,
  };
}

/** 1 + round(score/25) → 1..5. 경계: 0→1, 12→1, 13→2, 37→2, 38→3, 63→4, 87→4, 88→5. */
export function starsFromScore(score: number): number {
  const s = clampScore(score);
  return Math.max(1, Math.min(5, 1 + Math.round(s / 25)));
}

export function clampScore(s: number): number {
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, Math.round(s)));
}

/** Scorer + 메타 → MissionResult 헬퍼. */
export function missionResultOf(
  kind: MissionKind,
  id: string,
  scorer: Scorer,
  weight = 1,
  detail?: Record<string, unknown>,
): MissionResult {
  return {
    kind, id,
    score: clampScore(scorer.totalScore()),
    weight, detail,
  };
}
