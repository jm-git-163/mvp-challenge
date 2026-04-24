/**
 * engine/studio/performanceBudget.ts
 *
 * Phase 7 — 프레임 페이싱 + 메모리 측정.
 * docs/PERFORMANCE 기준: 30fps 유지, dropped frames <10%.
 *
 * 가벼운 RAF 샘플링으로 p50/p95 deltaMs / 드롭률 집계.
 */

export interface PerfBudget {
  /** 타겟 fps (기본 30). */
  targetFps: number;
  /** p95 deltaMs 허용 상한. 기본 1.5 * (1000/targetFps). */
  p95MaxMs: number;
  /** 드롭 프레임 허용율(%). 기본 10. */
  maxDropPct: number;
}

export const DEFAULT_BUDGET: PerfBudget = {
  targetFps: 30,
  p95MaxMs: 50,      // 30fps = 33.3, +50% = 50
  maxDropPct: 10,
};

export interface PerfSample {
  count: number;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  droppedPct: number;
}

export interface PerfReport extends PerfSample {
  pass: boolean;
  violations: string[];
}

/** 순수 통계 계산: deltaMs 배열 → 요약. */
export function summarize(deltas: number[], targetMs: number): PerfSample {
  const count = deltas.length;
  if (count === 0) return { count: 0, p50Ms: 0, p95Ms: 0, avgMs: 0, droppedPct: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(count * 0.5)];
  const p95 = sorted[Math.min(count - 1, Math.floor(count * 0.95))];
  const avg = deltas.reduce((s, x) => s + x, 0) / count;
  // dropped = delta > 1.5 * target
  const drops = deltas.filter((d) => d > targetMs * 1.5).length;
  return { count, p50Ms: p50, p95Ms: p95, avgMs: avg, droppedPct: (drops / count) * 100 };
}

export function evaluate(deltas: number[], budget: PerfBudget = DEFAULT_BUDGET): PerfReport {
  const targetMs = 1000 / budget.targetFps;
  const s = summarize(deltas, targetMs);
  const violations: string[] = [];
  if (s.count > 0 && s.p95Ms > budget.p95MaxMs) {
    violations.push(`p95 프레임 시간 ${s.p95Ms.toFixed(1)}ms > 허용 ${budget.p95MaxMs}ms`);
  }
  if (s.count > 0 && s.droppedPct > budget.maxDropPct) {
    violations.push(`드롭률 ${s.droppedPct.toFixed(1)}% > 허용 ${budget.maxDropPct}%`);
  }
  return { ...s, pass: violations.length === 0, violations };
}

/**
 * 런타임 샘플러. `tick(tMs)` 를 매 RAF 호출.
 * maxSamples 도달 시 FIFO 로 오래된 샘플 drop.
 */
export class PerfSampler {
  private samples: number[] = [];
  private lastMs: number | null = null;
  private readonly maxSamples: number;

  constructor(maxSamples = 300) {
    this.maxSamples = maxSamples;
  }

  tick(tMs: number): void {
    if (this.lastMs != null) {
      const d = tMs - this.lastMs;
      if (d > 0 && d < 10_000) {
        this.samples.push(d);
        if (this.samples.length > this.maxSamples) this.samples.shift();
      }
    }
    this.lastMs = tMs;
  }

  report(budget: PerfBudget = DEFAULT_BUDGET): PerfReport {
    return evaluate(this.samples, budget);
  }

  reset(): void {
    this.samples.length = 0;
    this.lastMs = null;
  }

  size(): number { return this.samples.length; }
}

/** performance.memory (Chromium 전용) 래퍼. 미지원 환경에서 null. */
export function currentHeapUsedBytes(): number | null {
  if (typeof performance === 'undefined') return null;
  const p = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  if (!p.memory || typeof p.memory.usedJSHeapSize !== 'number') return null;
  return p.memory.usedJSHeapSize;
}
