/**
 * engine/audio/sfxPlayer.ts
 *
 * Phase 5 wave1 — **SFX 시스템 (placeholder + asset-aware)**.
 *
 * 미션 이벤트(스쿼트 카운트, 자막 완주, 미션 성공/실패, 비트, 카운트다운 등) 에
 * 효과음을 재생한다. 사용자가 mp3 파일을 제공하면 그것을 우선 사용하고,
 * 없으면 Web Audio 로 generated tone 을 재생한다.
 *
 * **디자인 원칙**:
 *   - 100% 클라이언트, 외부 전송 없음 (CLAUDE §12).
 *   - 단일 AudioContext 재사용. 사용자 첫 제스처 후 resume() 안전.
 *   - 동시 재생 가능 (다중 oscillator/gain).
 *   - mp3 자산은 `/sfx/<name>.mp3` 경로 규약. 실패 시 자동으로 generated tone.
 *
 * 호출 예:
 *   import { playSfx } from '@/engine/audio/sfxPlayer';
 *   playSfx('squat_count');      // 440 Hz pop
 *   playSfx('mission_success');  // 880 Hz triad
 *   playSfx('mission_fail');     // 220 Hz drop
 *
 * 등록된 키:
 *   - 'squat_count'      : pop (440 Hz, 100ms)
 *   - 'beat'             : tick (1200 Hz, 30ms)
 *   - 'countdown_tick'   : 660 Hz, 80ms
 *   - 'countdown_go'     : 880 → 1320 Hz, 200ms
 *   - 'mission_success'  : C major triad arpeggio (523/659/784, 250ms)
 *   - 'mission_fail'     : 220 → 110 Hz drop, 300ms
 *   - 'caption_complete' : 988 Hz bell, 220ms
 *   - 'gesture_hit'      : 1320 Hz pop, 80ms
 *
 * ASSET_CHECKLIST.md: 사용자가 위 키로 `/public/sfx/<key>.mp3` 를 추가하면 자동 우선.
 */

export type SfxKey =
  | 'squat_count'
  | 'beat'
  | 'countdown_tick'
  | 'countdown_go'
  | 'mission_success'
  | 'mission_fail'
  | 'caption_complete'
  | 'gesture_hit';

export interface SfxOptions {
  /** 0..1 볼륨. 기본 0.4. */
  volume?: number;
  /** mp3 우회 — 항상 generated tone. 테스트/저사양용. */
  forceGenerated?: boolean;
}

/** key → fallback tone 정의. */
interface ToneDef {
  /** 시간순 (freqHz, durationMs, type?) tone 시퀀스. */
  steps: Array<{ freq: number; durMs: number; type?: OscillatorType; gain?: number }>;
  /** 전체 길이 ms (캐시용). */
  totalMs: number;
}

const TONES: Record<SfxKey, ToneDef> = {
  squat_count:      { steps: [{ freq: 440, durMs: 100, type: 'sine', gain: 0.4 }], totalMs: 100 },
  beat:             { steps: [{ freq: 1200, durMs: 30, type: 'square', gain: 0.18 }], totalMs: 30 },
  countdown_tick:   { steps: [{ freq: 660, durMs: 80, type: 'triangle', gain: 0.35 }], totalMs: 80 },
  countdown_go:     {
    steps: [
      { freq: 880, durMs: 90, type: 'sine', gain: 0.4 },
      { freq: 1320, durMs: 130, type: 'sine', gain: 0.5 },
    ],
    totalMs: 220,
  },
  mission_success:  {
    steps: [
      { freq: 523, durMs: 80, type: 'triangle', gain: 0.35 },
      { freq: 659, durMs: 80, type: 'triangle', gain: 0.4 },
      { freq: 784, durMs: 120, type: 'triangle', gain: 0.45 },
    ],
    totalMs: 280,
  },
  mission_fail:     {
    steps: [
      { freq: 220, durMs: 140, type: 'sawtooth', gain: 0.35 },
      { freq: 110, durMs: 180, type: 'sawtooth', gain: 0.3 },
    ],
    totalMs: 320,
  },
  caption_complete: { steps: [{ freq: 988, durMs: 220, type: 'sine', gain: 0.4 }], totalMs: 220 },
  gesture_hit:      { steps: [{ freq: 1320, durMs: 80, type: 'square', gain: 0.3 }], totalMs: 80 },
};

let ctxRef: AudioContext | null = null;
const bufferCache: Map<SfxKey, AudioBuffer | null> = new Map(); // null = mp3 없음 확정
const inFlight: Map<SfxKey, Promise<AudioBuffer | null>> = new Map();

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctxRef && ctxRef.state !== 'closed') return ctxRef;
  const C = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!C) return null;
  try {
    ctxRef = new C();
    return ctxRef;
  } catch {
    return null;
  }
}

/** 사용자 제스처 후 호출하면 모바일 Safari/Chrome 의 suspend 상태를 풀어준다. */
export async function unlockSfx(): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
}

async function loadMp3(key: SfxKey): Promise<AudioBuffer | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (bufferCache.has(key)) return bufferCache.get(key) ?? null;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const p = (async () => {
    try {
      const url = `/sfx/${key}.mp3`;
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) {
        bufferCache.set(key, null);
        return null;
      }
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      bufferCache.set(key, buf);
      return buf;
    } catch {
      bufferCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

function playGenerated(key: SfxKey, opts: SfxOptions): void {
  const ctx = getCtx();
  if (!ctx) return;
  const def = TONES[key];
  if (!def) return;
  const userVol = opts.volume ?? 0.4;
  let cursor = ctx.currentTime;
  for (const step of def.steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step.type ?? 'sine';
    osc.frequency.setValueAtTime(step.freq, cursor);
    const peak = (step.gain ?? 0.35) * userVol;
    // ADSR 단순 envelope: 5ms attack, hold, 30ms release
    gain.gain.setValueAtTime(0, cursor);
    gain.gain.linearRampToValueAtTime(peak, cursor + 0.005);
    gain.gain.setValueAtTime(peak, cursor + step.durMs / 1000 - 0.03);
    gain.gain.linearRampToValueAtTime(0, cursor + step.durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(cursor);
    osc.stop(cursor + step.durMs / 1000 + 0.02);
    cursor += step.durMs / 1000;
  }
}

function playBuffer(buf: AudioBuffer, volume: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

/**
 * SFX 재생. 비동기지만 await 강제하지 않음 (fire-and-forget OK).
 *   - mp3 가 캐시에 있으면 즉시 재생.
 *   - mp3 가 없거나 디코딩 실패면 generated tone.
 */
export function playSfx(key: SfxKey, opts: SfxOptions = {}): void {
  if (typeof window === 'undefined') return;
  const ctx = getCtx();
  if (!ctx) return;

  // 즉시 재생 우선 — 캐시된 버퍼가 있으면 사용
  const cached = bufferCache.get(key);
  if (cached && !opts.forceGenerated) {
    playBuffer(cached, opts.volume ?? 0.7);
    return;
  }
  if (cached === null && !opts.forceGenerated) {
    // 이전에 404 확인됨 → 즉시 generated
    playGenerated(key, opts);
    return;
  }
  if (opts.forceGenerated) {
    playGenerated(key, opts);
    return;
  }

  // 첫 호출: mp3 시도 + 동시에 generated 즉시 재생 (지연 0)
  // — UX 상 미션 피드백이 200~300ms 늦으면 게임 느낌이 깨지므로 즉시 generated 후
  //   다음 호출부터 mp3 사용.
  playGenerated(key, opts);
  void loadMp3(key);
}

/** 테스트용. 캐시·컨텍스트 초기화. */
export function _resetSfxForTest(): void {
  bufferCache.clear();
  inFlight.clear();
  if (ctxRef && ctxRef.state !== 'closed') {
    try { void ctxRef.close(); } catch { /* ignore */ }
  }
  ctxRef = null;
}
