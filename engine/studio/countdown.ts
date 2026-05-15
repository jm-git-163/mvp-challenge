/**
 * engine/studio/countdown.ts
 *
 * Phase 6 — 3-2-1 카운트다운 상태기.
 * 순수 계산 + 콜백. UI는 `displayNumber` / `scale` / `opacity` 를 바로 그리면 됨.
 */

export interface CountdownState {
  /** 'idle' | 'counting' | 'go' | 'done' */
  phase: 'idle' | 'counting' | 'go' | 'done';
  /** 현재 표시할 숫자. counting 중에만 3→2→1, go는 0. */
  displayNumber: number;
  /** 0~1 정규화 진행도 (해당 숫자 내에서) */
  localProgress: number;
  /** 각 숫자 scale pop (0.6 → 1.1 → 1.0) */
  scale: number;
  opacity: number;
}

export interface CountdownConfig {
  /** 각 숫자 1 tick ms (기본 1000) */
  tickMs: number;
  /** 'GO' 유지 ms (기본 500) */
  goMs: number;
  /** 시작 숫자 (기본 3) */
  from: number;
}

export const DEFAULT_COUNTDOWN: CountdownConfig = {
  tickMs: 1000,
  goMs: 500,
  from: 3,
};

export function countdownState(
  elapsedMs: number,
  cfg: CountdownConfig = DEFAULT_COUNTDOWN,
): CountdownState {
  if (elapsedMs < 0) {
    return { phase: 'idle', displayNumber: cfg.from, localProgress: 0, scale: 1, opacity: 0 };
  }
  const totalCount = cfg.from * cfg.tickMs;
  if (elapsedMs < totalCount) {
    const idx = Math.floor(elapsedMs / cfg.tickMs); // 0..from-1
    const num = cfg.from - idx;
    const local = (elapsedMs - idx * cfg.tickMs) / cfg.tickMs;
    return {
      phase: 'counting',
      displayNumber: num,
      localProgress: local,
      scale: popScale(local),
      opacity: popOpacity(local),
    };
  }
  const goEnd = totalCount + cfg.goMs;
  if (elapsedMs < goEnd) {
    const local = (elapsedMs - totalCount) / cfg.goMs;
    return {
      phase: 'go',
      displayNumber: 0,
      localProgress: local,
      scale: popScale(local),
      opacity: popOpacity(local),
    };
  }
  return { phase: 'done', displayNumber: 0, localProgress: 1, scale: 1, opacity: 0 };
}

/**
 * 숫자 간 전환 이벤트 목록 — 햅틱·사운드 트리거용.
 * [0, tickMs, 2*tickMs, ..., totalCount] 각 경계에서 'tick', 마지막에 'go', 끝에 'end'.
 */
export type CountdownEvent =
  | { tMs: number; kind: 'tick'; number: number }
  | { tMs: number; kind: 'go' }
  | { tMs: number; kind: 'end' };

export function countdownEvents(cfg: CountdownConfig = DEFAULT_COUNTDOWN): CountdownEvent[] {
  const ev: CountdownEvent[] = [];
  for (let i = 0; i < cfg.from; i++) {
    ev.push({ tMs: i * cfg.tickMs, kind: 'tick', number: cfg.from - i });
  }
  const total = cfg.from * cfg.tickMs;
  ev.push({ tMs: total, kind: 'go' });
  ev.push({ tMs: total + cfg.goMs, kind: 'end' });
  return ev;
}

/** 팝 envelope: 0→0.2 에서 0.6→1.1, 0.2→0.6 hold 1.0, 0.6→1.0 fade */
function popScale(t: number): number {
  if (t < 0.2) return 0.6 + (1.1 - 0.6) * (t / 0.2);
  if (t < 0.6) return 1.1 - 0.1 * ((t - 0.2) / 0.4);
  return 1.0;
}

function popOpacity(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t > 0.85) return (1 - t) / 0.15;
  return 1;
}
