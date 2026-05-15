/**
 * engine/beat/reactiveBinding.ts
 *
 * Phase 5d (후반) — **리액티브 바인딩 평가기**.
 *
 * `ReactiveBinding` 스펙(docs/COMPOSITION §4)을 실제 레이어 프로퍼티 변화로 환원.
 *
 * 동작:
 *   - PulseAnimator: 프로퍼티별 일시적 펄스 애니메이션 (trigger 시 durationMs 동안 작용).
 *     삼각 엔벨로프 (0 → amount → 0) + easing 모양.
 *   - wireReactive(bc, binding, pulse): BeatClock 구독해 onBeat/onOnset 이벤트를 PulseAnimator에 연결.
 *   - evaluate(property, nowMs): 현재 활성 펄스들의 합(또는 최대)을 반환.
 *
 * Phase 5b LayerEngine이 render() 직전에 `pulse.evaluate()`를 호출해
 * 시각 프로퍼티를 보정하는 식으로 통합된다.
 */

import type { ReactiveBinding } from '../templates/schema';
import { EASE, type EasingToken } from '../design/motion';
import type { BeatClock } from './beatClock';

type PulseProperty = 'scale' | 'opacity' | 'rotate' | 'translate' | 'color' | 'glow';

interface ActivePulse {
  property: PulseProperty;
  amount: number;
  durationMs: number;
  startMs: number;
  easing: EasingToken;
}

export class PulseAnimator {
  private active: ActivePulse[] = [];

  trigger(nowMs: number, property: PulseProperty, amount: number, durationMs: number, easing: EasingToken): void {
    this.active.push({ property, amount, durationMs, startMs: nowMs, easing });
  }

  /** 만료 펄스 청소. 매 프레임 호출 권장. */
  prune(nowMs: number): void {
    this.active = this.active.filter((p) => nowMs - p.startMs < p.durationMs);
  }

  /**
   * 현재 프로퍼티의 변위(델타). 여러 펄스가 동시에 있으면 합산.
   * 삼각 엔벨로프: 0→amount 전반부, amount→0 후반부 (easing 적용).
   */
  evaluate(property: PulseProperty, nowMs: number): number {
    let sum = 0;
    for (const p of this.active) {
      if (p.property !== property) continue;
      const elapsed = nowMs - p.startMs;
      if (elapsed < 0 || elapsed >= p.durationMs) continue;
      const t = elapsed / p.durationMs;
      // 삼각 엔벨로프: t<0.5면 2t, 아니면 2(1-t). easing은 envelope 진행에 적용.
      const envRaw = t < 0.5 ? t * 2 : (1 - t) * 2;
      const env = EASE[p.easing](envRaw);
      sum += env * p.amount;
    }
    return sum;
  }

  activeCount(): number { return this.active.length; }
  clear(): void { this.active = []; }
}

/**
 * ReactiveBinding을 BeatClock에 연결. 반환값은 모든 구독 해제 함수.
 */
export function wireReactive(
  bc: BeatClock,
  binding: ReactiveBinding | undefined,
  pulse: PulseAnimator,
  nowMsFn: () => number,
): () => void {
  if (!binding) return () => {};
  const offs: Array<() => void> = [];

  if (binding.onBeat) {
    const ob = binding.onBeat;
    const off = bc.onBeat((beatIdx) => {
      if (beatIdx % ob.every !== 0) return;
      pulse.trigger(nowMsFn(), ob.property, ob.amount, ob.durationMs, ob.easing);
    });
    offs.push(off);
  }

  if (binding.onOnset) {
    const oo = binding.onOnset;
    let lastFireMs = -Infinity;
    const off = bc.onOnset(() => {
      const now = nowMsFn();
      if (oo.minIntervalMs && now - lastFireMs < oo.minIntervalMs) return;
      lastFireMs = now;
      pulse.trigger(now, oo.property, oo.amount, oo.durationMs, oo.easing);
    });
    offs.push(off);
  }

  return () => { for (const o of offs) o(); };
}

/**
 * onVolume은 프레임별 폴링 방식 (dB 임계치 넘으면 pulse 트리거).
 * AudioAnalyser의 `smoothedDbFS` 주입.
 */
export function evaluateVolumeBinding(
  binding: ReactiveBinding | undefined,
  smoothedDbFS: number,
  nowMs: number,
  pulse: PulseAnimator,
): void {
  if (!binding?.onVolume) return;
  const ov = binding.onVolume;
  if (smoothedDbFS >= ov.thresholdDb) {
    // 반복 트리거 방지를 위해 volume은 직접 evaluate하지 않고 작은 펄스만 발사
    pulse.trigger(nowMs, ov.property, ov.amount, 150, 'standard');
  }
}
