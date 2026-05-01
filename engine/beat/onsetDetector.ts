/**
 * engine/beat/onsetDetector.ts
 *
 * Phase 5d — **실시간 온셋(비트) 감지 폴백**.
 *
 * 사전 분석 BeatData JSON 이 없는 BGM(또는 라이브 마이크) 에서
 * Web Audio AnalyserNode 의 시간/주파수 도메인을 분석해 온셋(킥/스네어) 시점을
 * 콜백으로 알린다. BeatClock 의 `onBeat`/`onOnset` 와 동일 인터페이스.
 *
 * 알고리즘 (단순·결정론적):
 *   1) AnalyserNode (frequencyBinCount=512, smoothingTimeConstant=0.0)
 *   2) 매 tick: getByteFrequencyData → 저주파 대역(0..120Hz, ~bin 0-12) 평균 = energy
 *   3) energy 이동평균(window=18 tick ≈ 300ms @60fps) = baseline
 *   4) energy > baseline * sensitivity AND 최근 onset 으로부터 minIntervalMs 이상 경과
 *      → 온셋 fire
 *
 * **주의**: 정확도는 사전 분석 < 런타임. 폴백 전용.
 *
 * 사용:
 *   const det = new OnsetDetector(audioCtx, sourceNode);
 *   const off = det.onOnset((tSec) => console.log('beat', tSec));
 *   det.start();
 *   // ... in raf loop:
 *   det.tick();
 *   // ... 종료:
 *   det.stop();
 *   off();
 */

export interface OnsetDetectorOptions {
  /** 저주파 대역 상한 Hz. 기본 120 (킥 영역). */
  lowBandHz?: number;
  /** baseline 대비 몇 배 이상이면 온셋. 기본 1.5. */
  sensitivity?: number;
  /** 직전 온셋과 최소 간격 ms. 기본 180 (BPM 333 상한). */
  minIntervalMs?: number;
  /** 이동평균 윈도 길이(tick 수). 기본 18. */
  baselineWindow?: number;
}

export type OnsetCallback = (tSec: number, intensity: number) => void;
export type Unsubscribe = () => void;

export class OnsetDetector {
  private analyser: AnalyserNode | null = null;
  private freqBuf: Uint8Array | null = null;
  private cbs = new Set<OnsetCallback>();
  private history: number[] = [];
  private lastOnsetMs = -Infinity;
  private running = false;

  // 옵션
  private readonly lowBandHz: number;
  private readonly sensitivity: number;
  private readonly minIntervalMs: number;
  private readonly baselineWindow: number;

  constructor(
    private readonly audioCtx: AudioContext,
    private readonly source: AudioNode,
    opts: OnsetDetectorOptions = {},
  ) {
    this.lowBandHz      = opts.lowBandHz      ?? 120;
    this.sensitivity    = opts.sensitivity    ?? 1.5;
    this.minIntervalMs  = opts.minIntervalMs  ?? 180;
    this.baselineWindow = opts.baselineWindow ?? 18;
  }

  start(): void {
    if (this.running) return;
    const an = this.audioCtx.createAnalyser();
    an.fftSize = 1024; // bin 수 = 512
    an.smoothingTimeConstant = 0;
    this.source.connect(an);
    this.analyser = an;
    this.freqBuf = new Uint8Array(an.frequencyBinCount);
    this.history = [];
    this.lastOnsetMs = -Infinity;
    this.running = true;
  }

  stop(): void {
    if (!this.running) return;
    if (this.analyser) {
      try { this.source.disconnect(this.analyser); } catch { /* ignore */ }
      this.analyser = null;
    }
    this.freqBuf = null;
    this.running = false;
  }

  /** 매 raf 또는 라이브 루프에서 호출. */
  tick(): void {
    if (!this.running || !this.analyser || !this.freqBuf) return;
    // Cast to satisfy strict ArrayBuffer typing (TS lib confuses ArrayBufferLike vs ArrayBuffer).
    this.analyser.getByteFrequencyData(this.freqBuf as Uint8Array<ArrayBuffer>);

    const sr = this.audioCtx.sampleRate;
    const binHz = sr / this.analyser.fftSize;
    const lowBins = Math.max(1, Math.floor(this.lowBandHz / binHz));
    let sum = 0;
    for (let i = 0; i < lowBins; i++) sum += this.freqBuf[i];
    const energy = sum / lowBins; // 0..255

    // baseline = 이동평균
    this.history.push(energy);
    if (this.history.length > this.baselineWindow) this.history.shift();
    const baseline = this.history.reduce((a, b) => a + b, 0) / this.history.length;

    const nowMs = this.audioCtx.currentTime * 1000;
    if (
      this.history.length >= Math.floor(this.baselineWindow / 2) &&
      energy > baseline * this.sensitivity &&
      energy > 30 && // 절대 하한 (조용한 구간 노이즈 무시)
      nowMs - this.lastOnsetMs >= this.minIntervalMs
    ) {
      const intensity = Math.min(1, (energy - baseline) / Math.max(1, 255 - baseline));
      const tSec = this.audioCtx.currentTime;
      this.lastOnsetMs = nowMs;
      this.cbs.forEach((cb) => {
        try { cb(tSec, intensity); } catch { /* ignore */ }
      });
    }
  }

  onOnset(cb: OnsetCallback): Unsubscribe {
    this.cbs.add(cb);
    return () => this.cbs.delete(cb);
  }

  isRunning(): boolean { return this.running; }
}
