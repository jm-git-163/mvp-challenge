/**
 * engine/studio/haptics.ts
 *
 * Phase 6 — 햅틱 피드백. navigator.vibrate 래퍼 + 패턴 프리셋.
 *
 * docs/COMPATIBILITY §9: iOS Safari 는 vibrate 미지원 (무음 폴백).
 * SSR-safe: `typeof navigator === 'undefined'` 체크.
 */

export type HapticPattern =
  | 'tick'        // 카운트다운 틱 (15ms)
  | 'go'          // 시작 (50ms)
  | 'success'     // 미션 성공 (20, 40, 20)
  | 'fail'        // 실패 (80ms)
  | 'rep'         // 카운터 1회 증가 (25ms)
  | 'error';      // 에러 경고 (100, 60, 100)

export const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 15,
  go: 50,
  success: [20, 40, 20],
  fail: 80,
  rep: 25,
  error: [100, 60, 100],
};

export interface VibrateFn {
  (pattern: number | number[]): boolean;
}

export interface HapticsOptions {
  /** true 면 모든 호출 무시 (사용자 설정·접근성). */
  muted?: boolean;
  /** 동일 패턴 최소 간격 ms (rep 스팸 방지, 기본 40). */
  minIntervalMs?: number;
  /** 의존성 주입. 기본은 navigator.vibrate 사용. */
  vibrate?: VibrateFn | null;
  /** 현재 시각 ms 소스. 기본 performance.now(). */
  now?: () => number;
}

export class Haptics {
  private readonly muted: boolean;
  private readonly minInt: number;
  private readonly vib: VibrateFn | null;
  private readonly now: () => number;
  private lastFired = new Map<HapticPattern, number>();

  constructor(opts: HapticsOptions = {}) {
    this.muted = opts.muted ?? false;
    this.minInt = opts.minIntervalMs ?? 40;
    this.vib = opts.vibrate !== undefined ? opts.vibrate : resolveDefaultVibrate();
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  /** 패턴 실행. 실행됐으면 true. */
  fire(kind: HapticPattern): boolean {
    if (this.muted) return false;
    if (!this.vib) return false;
    const t = this.now();
    const last = this.lastFired.get(kind) ?? -Infinity;
    if (t - last < this.minInt) return false;
    const pat = PATTERNS[kind];
    const ok = this.vib(pat);
    if (ok) this.lastFired.set(kind, t);
    return ok;
  }

  /** 모든 진동 즉시 중단. */
  cancel(): void {
    if (this.vib) this.vib(0);
  }

  /** 브라우저가 햅틱을 지원하는지. (muted 와 별개) */
  isSupported(): boolean {
    return this.vib != null;
  }
}

function resolveDefaultVibrate(): VibrateFn | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof n.vibrate !== 'function') return null;
  return (pattern: number | number[]) => n.vibrate!(pattern);
}
