/**
 * engine/composition/beatBridge.ts
 *
 * Focused Session-4 Candidate M: **BeatClock → liveState.beatIntensity 브릿지**.
 *
 * onBeat 이 호출될 때마다 `liveState.beatIntensity` 를 1.0 으로 펄스시키고,
 * decayMs 동안 지수 감쇠(기본 180ms) 시켜 레이어가 비트 싱크 효과를 낼 수 있도록 한다.
 *   - `camera_frame` 의 glow 부스트
 *   - `postProcess` bloom/chromatic onset 부스트
 *   - `beat_flash`, `chromatic_pulse` 레이어 등
 *
 * 설계:
 *   - 순수 모듈 + 주입 가능한 setTimeout/Date.now → Vitest 에서 가짜 시간으로 테스트 가능.
 *   - 동시 요청 시 max 값 유지 (짧은 펄스가 긴 펄스를 덮어쓰지 않음).
 *   - detach 이후에는 beatIntensity 를 0 으로 정리.
 */
import { setBeatIntensity } from './liveState';

export interface BeatClockLike {
  onBeat(cb: (beatIdx: number, tSec: number) => void): () => void;
  onOnset?(cb: (idx: number, tSec: number) => void): () => void;
}

export interface BeatBridgeDeps {
  /** 현재 시각 ms 공급자. 기본 performance.now 또는 Date.now. */
  now?: () => number;
  /** 테스트 주입용 setTimeout. 기본 globalThis.setTimeout. */
  setTimeout?: (cb: () => void, ms: number) => unknown;
  /** 테스트 주입용 clearTimeout. */
  clearTimeout?: (h: unknown) => void;
}

export interface BeatBridgeOptions {
  /** 펄스 감쇠 시간 (ms). 기본 180. */
  decayMs?: number;
  /** 감쇠 샘플링 주기 (ms). 너무 낮으면 CPU 부담. 기본 16(=~60fps). */
  tickMs?: number;
  /** onset(킥/스네어) 도 처리할지. 기본 false (onBeat 만 사용). */
  includeOnsets?: boolean;
}

export interface BeatBridgeHandle {
  /** 수동 펄스 발화 (외부 이벤트로 쓸 때). */
  pulse(intensity?: number): void;
  /** 연결 해제 + 타이머 정리 + liveState 0 으로 리셋. */
  detach(): void;
  /** 진단: 현재 내부 envelope 값 (clamp 전). */
  currentEnvelope(): number;
}

function getDefaultNow(): () => number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return () => performance.now();
  }
  return () => Date.now();
}

/**
 * BeatClock 에 연결 → 매 onBeat 마다 liveState.beatIntensity 를 1.0 으로 펄스시키고
 * decayMs 동안 선형 감쇠시킨다.
 *
 * @returns handle — 세션 종료 시 detach() 호출 필수
 */
export function attachBeatClockToLiveState(
  clock: BeatClockLike,
  opts: BeatBridgeOptions = {},
  deps: BeatBridgeDeps = {},
): BeatBridgeHandle {
  const decayMs = Math.max(20, opts.decayMs ?? 180);
  const tickMs  = Math.max(4,  opts.tickMs  ?? 16);
  const now     = deps.now ?? getDefaultNow();
  const setT    = deps.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  const clrT    = deps.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let envelope = 0;
  let peakAt = 0;         // 마지막 펄스 시각
  let peakIntensity = 0;  // 마지막 펄스 강도 (보통 1)
  let tickHandle: unknown = null;
  let detached = false;

  function sample(): void {
    if (detached) return;
    const dt = now() - peakAt;
    if (dt >= decayMs) {
      envelope = 0;
    } else {
      envelope = peakIntensity * (1 - dt / decayMs);
    }
    setBeatIntensity(envelope);
    if (envelope > 0.001) {
      tickHandle = setT(sample, tickMs);
    } else {
      tickHandle = null;
    }
  }

  function pulse(intensity = 1): void {
    if (detached) return;
    const clamped = Math.max(0, Math.min(1, intensity));
    peakAt = now();
    // 동시 펄스 시 더 큰 값 유지
    peakIntensity = Math.max(peakIntensity * Math.max(0, 1 - (now() - peakAt) / decayMs), clamped);
    envelope = peakIntensity;
    setBeatIntensity(envelope);
    if (tickHandle !== null) clrT(tickHandle);
    tickHandle = setT(sample, tickMs);
  }

  const unsubBeat  = clock.onBeat(() => pulse(1));
  const unsubOnset = opts.includeOnsets && clock.onOnset
    ? clock.onOnset(() => pulse(0.7))
    : () => {};

  return {
    pulse,
    detach() {
      if (detached) return;
      detached = true;
      unsubBeat();
      unsubOnset();
      if (tickHandle !== null) clrT(tickHandle);
      tickHandle = null;
      envelope = 0;
      peakIntensity = 0;
      setBeatIntensity(0);
    },
    currentEnvelope() { return envelope; },
  };
}
