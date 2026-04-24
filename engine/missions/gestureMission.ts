/**
 * engine/missions/gestureMission.ts
 *
 * Phase 1 — 제스처 미션 (MediaPipe GestureRecognizer 기반).
 *
 * CLAUDE.md §5 Gesture 공식: 신뢰도 70 + 응답속도 30.
 *
 * MediaPipe 기본 카테고리:
 *   Thumb_Up / Thumb_Down / Open_Palm / Closed_Fist / Pointing_Up / Victory / ILoveYou / None
 *
 * 시나리오:
 *   - prompts: 순서대로 "Thumb_Up 해주세요" 등 지시
 *   - 각 prompt 시작 시각 기록 → 최초 매칭까지 걸린 시간이 응답속도
 *   - 매칭 시 confidence 기록
 *   - 모든 prompt 소화하거나 timeoutMs 만료 시 종료
 *
 * 입력: 매 프레임 `push(category, confidence, t)` — GestureRecognizer 결과.
 */

export type GestureCategory =
  | 'Thumb_Up' | 'Thumb_Down' | 'Open_Palm' | 'Closed_Fist'
  | 'Pointing_Up' | 'Victory' | 'ILoveYou' | 'None' | string;

export interface GesturePrompt {
  target: GestureCategory;
  /** 이 프롬프트 제한 시간 (ms). 초과 시 실패 처리. */
  timeoutMs?: number;
}

export interface GestureResult {
  prompt: GestureCategory;
  matched: boolean;
  confidence: number;
  responseMs: number | null;
}

export interface GestureMissionParams {
  /** 매칭으로 인정할 최소 신뢰도. */
  minConfidence?: number;  // 기본 0.6
  /** 프롬프트별 기본 제한 시간. */
  defaultTimeoutMs?: number; // 기본 5000
  /** 응답속도 만점 기준 (이보다 빠르면 만점). */
  fastResponseMs?: number;  // 기본 800
  /** 응답속도 0점 기준 (이보다 느리면 0점). */
  slowResponseMs?: number;  // 기본 4000
}

const DEFAULTS: Required<GestureMissionParams> = {
  minConfidence: 0.6,
  defaultTimeoutMs: 5000,
  fastResponseMs: 800,
  slowResponseMs: 4000,
};

export class GestureMission {
  private readonly p: Required<GestureMissionParams>;
  private prompts: GesturePrompt[] = [];
  private results: GestureResult[] = [];
  private currentIdx = -1;
  private currentStartedAt: number | null = null;
  private lastT = 0;

  constructor(params: GestureMissionParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  /** 미션 시작. */
  begin(prompts: GesturePrompt[], t: number): void {
    this.prompts = prompts;
    this.results = [];
    this.currentIdx = 0;
    this.currentStartedAt = t;
    this.lastT = t;
  }

  /** 매 프레임 호출. */
  push(category: GestureCategory, confidence: number, t: number): void {
    this.lastT = t;
    if (this.currentIdx < 0 || this.currentIdx >= this.prompts.length) return;
    const prompt = this.prompts[this.currentIdx];
    const timeout = prompt.timeoutMs ?? this.p.defaultTimeoutMs;
    const elapsed = t - (this.currentStartedAt ?? t);

    if (category === prompt.target && confidence >= this.p.minConfidence) {
      this.results.push({
        prompt: prompt.target,
        matched: true,
        confidence,
        responseMs: elapsed,
      });
      this.advance(t);
      return;
    }
    if (elapsed >= timeout) {
      this.results.push({ prompt: prompt.target, matched: false, confidence: 0, responseMs: null });
      this.advance(t);
    }
  }

  private advance(t: number): void {
    this.currentIdx++;
    this.currentStartedAt = this.currentIdx < this.prompts.length ? t : null;
  }

  getResults(): GestureResult[] { return this.results; }
  isFinished(): boolean { return this.currentIdx >= this.prompts.length; }
  currentPrompt(): GesturePrompt | null {
    return this.currentIdx >= 0 && this.currentIdx < this.prompts.length
      ? this.prompts[this.currentIdx] : null;
  }

  /** 신뢰도 평균 (매칭된 것만). 0..1. */
  meanConfidence(): number {
    const matched = this.results.filter(r => r.matched);
    if (matched.length === 0) return 0;
    return matched.reduce((s, r) => s + r.confidence, 0) / matched.length;
  }

  /** 응답속도 평균 점수 (0..1). 빠른 응답일수록 1. */
  responseSpeed(): number {
    const matched = this.results.filter(r => r.matched && r.responseMs !== null);
    if (matched.length === 0) return 0;
    let total = 0;
    for (const r of matched) {
      const t = r.responseMs as number;
      const score = (this.p.slowResponseMs - Math.max(this.p.fastResponseMs, Math.min(this.p.slowResponseMs, t)))
        / (this.p.slowResponseMs - this.p.fastResponseMs);
      total += Math.max(0, Math.min(1, score));
    }
    return total / matched.length;
  }

  /** 매칭률 (0..1) — 정보 목적, 점수식엔 직접 반영 안 함. */
  matchRatio(): number {
    if (this.prompts.length === 0) return 0;
    return this.results.filter(r => r.matched).length / this.prompts.length;
  }

  /** 0..100 총점. CLAUDE §5: 신뢰도 70 + 응답속도 30. 매칭률로 곱해 실패 반영. */
  totalScore(): number {
    const c = this.meanConfidence();
    const r = this.responseSpeed();
    const ratio = this.matchRatio();
    return Math.round((c * 70 + r * 30) * ratio);
  }

  reset(): void {
    this.prompts = []; this.results = []; this.currentIdx = -1;
    this.currentStartedAt = null; this.lastT = 0;
  }
}
