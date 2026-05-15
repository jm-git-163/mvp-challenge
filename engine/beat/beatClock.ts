/**
 * engine/beat/beatClock.ts
 *
 * Phase 5d — **비트 싱크 엔진**. docs/COMPOSITION.md §5.
 *
 * BGM 재생 중 비트·온셋·다운비트 이벤트를 레이어에 배달한다.
 * 사전 분석된 `BeatData` JSON(`bgm/<track>.beats.json`) 기반.
 *
 * 디자인:
 *   - TimeSource 주입 → 실제 HTMLAudioElement도 되고, 테스트용 fake 시간도 됨.
 *   - tick(tSec)마다 "지난 비트 인덱스"를 전진시켜 콜백 fire.
 *   - phase 계산: 현재 시각이 두 비트 사이 어디에 있는지 0..1.
 *   - onBeat/onOnset/onDownbeat 서브스크립션.
 *
 * 폴백: BeatData 없이 bpm만 있으면 균등 간격으로 비트 합성.
 */

export interface BeatData {
  bpm: number;
  /** 비트 시작 시각(초) 오름차순. */
  beats: number[];
  /** 온셋 시각(초). 강한 킥 등. 비트와 겹칠 수 있음. */
  onsets: number[];
  /** 다운비트(소절 시작) 시각(초). 보통 4비트마다. */
  downbeats: number[];
}

export interface TimeSource {
  /** 현재 재생 시각(초). 정지 상태도 OK. */
  getCurrentTime(): number;
  /** 재생 중인지. 정지면 tick 효과 없음. */
  isPlaying(): boolean;
}

export type Unsubscribe = () => void;

/**
 * bpm 기반으로 균등 비트 배열 합성 (사전 분석 없을 때 폴백).
 * @param bpm tempo
 * @param durationSec 생성할 총 길이
 * @param downbeatEvery 몇 비트마다 다운비트 (기본 4)
 */
export function synthesizeBeats(bpm: number, durationSec: number, downbeatEvery = 4): BeatData {
  const period = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t < durationSec; t += period) beats.push(Math.round(t * 1000) / 1000);
  const downbeats = beats.filter((_, i) => i % downbeatEvery === 0);
  return { bpm, beats, onsets: [...beats], downbeats };
}

/** BeatData 검증. 잘못된 JSON은 빠르게 실패. */
export function validateBeatData(d: BeatData): void {
  if (!(d.bpm > 0)) throw new Error('BeatData: bpm must be > 0');
  for (let i = 1; i < d.beats.length; i++) {
    if (d.beats[i] < d.beats[i - 1]) throw new Error(`BeatData: beats[${i}] < beats[${i - 1}]`);
  }
}

export class BeatClock {
  private data: BeatData | null = null;
  private source: TimeSource | null = null;
  private nextBeatIdx = 0;
  private nextOnsetIdx = 0;
  private nextDownbeatIdx = 0;
  private beatCbs = new Set<(beatIdx: number, tSec: number) => void>();
  private onsetCbs = new Set<(onsetIdx: number, tSec: number) => void>();
  private downbeatCbs = new Set<(barIdx: number, tSec: number) => void>();

  /** BGM 시작 시점에 호출. */
  start(source: TimeSource, data: BeatData): void {
    validateBeatData(data);
    this.source = source;
    this.data = data;
    this.nextBeatIdx = 0;
    this.nextOnsetIdx = 0;
    this.nextDownbeatIdx = 0;
  }

  stop(): void {
    this.source = null;
    this.data = null;
  }

  /**
   * 매 프레임 호출. 현재 시각까지 지난 비트·온셋·다운비트 콜백 모두 fire.
   * 내부적으로 인덱스를 앞으로만 전진시키므로 **단조 증가 시간** 가정.
   * 큰 점프(seek) 시 `reset(tSec)` 호출해 인덱스 재동기화.
   */
  tick(): void {
    if (!this.data || !this.source) return;
    if (!this.source.isPlaying()) return;
    const tSec = this.source.getCurrentTime();
    this.advanceIndex(this.data.beats, 'nextBeatIdx', tSec, (i, t) => this.beatCbs.forEach((cb) => cb(i, t)));
    this.advanceIndex(this.data.onsets, 'nextOnsetIdx', tSec, (i, t) => this.onsetCbs.forEach((cb) => cb(i, t)));
    this.advanceIndex(this.data.downbeats, 'nextDownbeatIdx', tSec, (i, t) => this.downbeatCbs.forEach((cb) => cb(i, t)));
  }

  private advanceIndex<K extends 'nextBeatIdx' | 'nextOnsetIdx' | 'nextDownbeatIdx'>(
    arr: number[],
    key: K,
    tSec: number,
    emit: (idx: number, t: number) => void,
  ): void {
    while (this[key] < arr.length && arr[this[key]] <= tSec + 1e-6) {
      emit(this[key], arr[this[key]]);
      this[key]++;
    }
  }

  /** seek 등 큰 시간 점프 후 호출해 인덱스 재동기화. */
  reset(tSec: number): void {
    if (!this.data) return;
    this.nextBeatIdx = this.data.beats.findIndex((t) => t > tSec);
    if (this.nextBeatIdx < 0) this.nextBeatIdx = this.data.beats.length;
    this.nextOnsetIdx = this.data.onsets.findIndex((t) => t > tSec);
    if (this.nextOnsetIdx < 0) this.nextOnsetIdx = this.data.onsets.length;
    this.nextDownbeatIdx = this.data.downbeats.findIndex((t) => t > tSec);
    if (this.nextDownbeatIdx < 0) this.nextDownbeatIdx = this.data.downbeats.length;
  }

  /** 현재 재생 시각. source 없으면 0. */
  getCurrentTime(): number {
    return this.source?.getCurrentTime() ?? 0;
  }

  /** 현재 비트 진행도 0..1. */
  getBeatPhase(): number {
    return this.phaseOn(this.data?.beats);
  }

  /** 현재 소절 진행도 0..1. */
  getBarPhase(): number {
    return this.phaseOn(this.data?.downbeats);
  }

  private phaseOn(arr: number[] | undefined): number {
    if (!arr || arr.length < 2 || !this.source) return 0;
    const t = this.source.getCurrentTime();
    // 현재 시각을 둘러싼 두 시점 찾기
    let lo = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (t >= arr[i] && t < arr[i + 1]) { lo = i; break; }
      if (t >= arr[arr.length - 1]) lo = arr.length - 2;
    }
    const a = arr[lo];
    const b = arr[lo + 1];
    if (b <= a) return 0;
    return Math.max(0, Math.min(1, (t - a) / (b - a)));
  }

  onBeat(cb: (beatIdx: number, tSec: number) => void): Unsubscribe {
    this.beatCbs.add(cb);
    return () => this.beatCbs.delete(cb);
  }
  onOnset(cb: (onsetIdx: number, tSec: number) => void): Unsubscribe {
    this.onsetCbs.add(cb);
    return () => this.onsetCbs.delete(cb);
  }
  onDownbeat(cb: (barIdx: number, tSec: number) => void): Unsubscribe {
    this.downbeatCbs.add(cb);
    return () => this.downbeatCbs.delete(cb);
  }
}
