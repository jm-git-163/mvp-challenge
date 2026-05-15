/**
 * engine/studio/presenceWatcher.ts
 *
 * Phase 6 — 사용자 프레임 이탈 감지.
 * docs/EDGE_CASES.md §3: 10초 이상 미검출 시 타이머 일시정지 + 안내.
 *
 * 순수 상태기. 프레임마다 `observe(isPresent, nowMs)` 호출.
 */

export type PresenceState = 'present' | 'absent' | 'warning';

export interface PresenceConfig {
  /** 이탈 후 경고 띄우기까지 ms. 기본 3000. */
  warningAfterMs: number;
  /** 이탈 후 타이머 정지·안내로 전환할 ms. 기본 10000. */
  pauseAfterMs: number;
  /** 복귀 후 present 확정까지 유예 ms (노이즈 방지). 기본 400. */
  returnDebounceMs: number;
}

export const DEFAULT_PRESENCE: PresenceConfig = {
  warningAfterMs: 3000,
  pauseAfterMs: 10000,
  returnDebounceMs: 400,
};

export type PresenceEvent =
  | { kind: 'enter' }
  | { kind: 'warn' }
  | { kind: 'pause' }
  | { kind: 'resume' };

export class PresenceWatcher {
  private readonly cfg: PresenceConfig;
  private state: PresenceState = 'present';
  private absentSinceMs: number | null = null;
  private lastSeenMs = -Infinity;
  private warningFired = false;
  private pauseFired = false;

  constructor(cfg: Partial<PresenceConfig> = {}) {
    this.cfg = { ...DEFAULT_PRESENCE, ...cfg };
  }

  getState(): PresenceState { return this.state; }

  /**
   * 한 프레임 관측. 상태 전이 시 이벤트 배열 반환.
   * @param isPresent 이번 프레임에 사용자 감지 여부
   * @param nowMs 현재 시각 (monotonic ms)
   */
  observe(isPresent: boolean, nowMs: number): PresenceEvent[] {
    const events: PresenceEvent[] = [];
    if (isPresent) {
      this.lastSeenMs = nowMs;
      if (this.state === 'present') {
        this.absentSinceMs = null;
        return events;
      }
      // 디바운스: 이탈 상태였지만 최근 감지 → returnDebounceMs 후 present 확정.
      // 여기선 단순화: 바로 resume.
      if (this.state === 'warning' || this.state === 'absent') {
        if (this.pauseFired) events.push({ kind: 'resume' });
        else events.push({ kind: 'enter' });
        this.state = 'present';
        this.absentSinceMs = null;
        this.warningFired = false;
        this.pauseFired = false;
      }
      return events;
    }
    // 이탈 프레임
    if (this.absentSinceMs == null) this.absentSinceMs = nowMs;
    const dur = nowMs - this.absentSinceMs;
    if (!this.warningFired && dur >= this.cfg.warningAfterMs) {
      this.state = 'warning';
      this.warningFired = true;
      events.push({ kind: 'warn' });
    }
    if (!this.pauseFired && dur >= this.cfg.pauseAfterMs) {
      this.state = 'absent';
      this.pauseFired = true;
      events.push({ kind: 'pause' });
    }
    return events;
  }

  reset(): void {
    this.state = 'present';
    this.absentSinceMs = null;
    this.lastSeenMs = -Infinity;
    this.warningFired = false;
    this.pauseFired = false;
  }
}
