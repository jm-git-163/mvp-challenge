/**
 * utils/whisperRecognizer.ts
 *
 * FIX-I (2026-04-21) — Whisper WASM 기반 음성 인식기.
 *
 * 배경: Android Chrome 의 `webkitSpeechRecognition` 이 `not-allowed` / 무반응으로
 *   실사용 거의 불가. 100% 클라이언트 제약(CLAUDE.md §12) 하에서 대체재 필요.
 *
 * 해결: `@xenova/transformers` (ONNX Runtime Web) 로 Whisper-tiny 모델을
 *   브라우저 WASM 에서 실행. 모델은 IndexedDB 캐시 → 두 번째부터 즉시 로드.
 *
 * API: SpeechRecognizer 와 동일 시그니처(listen/stop/setTargetText/isSupported/
 *   isListening/resetForNextMission/getDiagnostic) 유지 → useJudgement 는
 *   factory 만 바꾸면 나머지 코드 그대로.
 *
 * 이번 세션(1): 최소 동작 — mainthread inference, 5s chunk.
 * 다음 세션(2): Worker-ize + 청크 슬라이딩 윈도우 + 부분 결과.
 * 다음 세션(3): 모델 프리로드 UX + 저사양 tier 자동 감지.
 */

import { textSimilarity } from './speechUtils';

type InterimCb = (text: string) => void;
type FinalCb = (text: string) => void;
type ProgressCb = (similarity: number) => void;

const CHUNK_MS = 5_000;      // 5초 버퍼 → Whisper 추론
const SAMPLE_RATE = 16_000;  // Whisper 기본 샘플레이트

// ── 모델 로더 싱글톤 ──────────────────────────────────────────────────────────
let _pipelinePromise: Promise<unknown> | null = null;

// FIX-I3 (2026-04-21): Metro 번들러가 `@xenova/transformers` 내부 Node 의존성
// (fs/path/onnxruntime-node)을 못 resolve → `Requiring unknown module "817"`.
// 해결: bare import 대신 런타임에 jsdelivr ESM CDN 에서 동적 로드. Metro 는
// 빌드 타임에 URL import 를 보지 못하므로 번들에서 완전히 제외됨.
const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

async function loadTransformersFromCdn(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('no window');
  const w = window as any;
  if (w.__motiq_transformers) return w.__motiq_transformers;
  return new Promise((resolve, reject) => {
    // 이미 로드 중이면 이벤트만 대기
    const onReady = () => resolve(w.__motiq_transformers);
    window.addEventListener('__motiq_transformers_ready', onReady, { once: true });
    if (w.__motiq_transformers_loading) return;
    w.__motiq_transformers_loading = true;
    const s = document.createElement('script');
    s.type = 'module';
    // inline module → jsdelivr ESM 에서 import → window 에 노출
    s.textContent = `
      import * as T from '${TRANSFORMERS_CDN}';
      window.__motiq_transformers = T;
      window.dispatchEvent(new Event('__motiq_transformers_ready'));
    `;
    s.onerror = (e) => {
      w.__motiq_transformers_loading = false;
      reject(new Error('transformers CDN script load failed'));
    };
    document.head.appendChild(s);
    // 30초 타임아웃
    setTimeout(() => {
      if (!w.__motiq_transformers) {
        reject(new Error('transformers CDN import timeout 30s'));
      }
    }, 30_000);
  });
}

async function loadWhisperPipeline(modelId = 'Xenova/whisper-tiny'): Promise<any> {
  if (_pipelinePromise) return _pipelinePromise;
  _pipelinePromise = (async () => {
    const t: any = await loadTransformersFromCdn();
    // IndexedDB 캐시 활성 (기본값 true 이지만 명시)
    t.env.useBrowserCache = true;
    t.env.useFSCache = false;
    // 원격 호스트 고정 (jsdelivr ESM 은 wasm 을 같은 경로에서 찾음)
    t.env.allowRemoteModels = true;
    // pipeline = high-level API (preprocess + tokenizer + decode 자동)
    const asr = await t.pipeline('automatic-speech-recognition', modelId, {
      // quantized=true → 모델 크기 1/4, 속도 2배, 품질 소폭 하락 (tiny 에서는 무시할 수준)
      quantized: true,
    });
    return asr;
  })().catch((e) => {
    _pipelinePromise = null; // 재시도 가능
    throw e;
  });
  return _pipelinePromise;
}

export function preloadWhisper(modelId?: string): Promise<void> {
  return loadWhisperPipeline(modelId).then(() => {});
}

// ── 마이크 오디오 캡처 → Float32 모노 16kHz 리샘플 ────────────────────────────
class MicAudioBuffer {
  private ac: AudioContext;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  // 고정된 샘플레이트가 아닐 수 있으므로 브라우저 기본값을 그대로 사용 후 추론 직전 리샘플
  private inputRate: number;
  private chunks: Float32Array[] = [];
  private chunkSampleCount = 0;
  private onChunk: (pcm16k: Float32Array) => void;

  constructor(stream: MediaStream, onChunk: (pcm16k: Float32Array) => void) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ac = new AC();
    this.inputRate = this.ac.sampleRate;
    this.onChunk = onChunk;

    this.source = this.ac.createMediaStreamSource(stream);
    // ScriptProcessorNode 는 deprecated 이지만 AudioWorklet 는 setup 복잡도 높음.
    // 세션 2 에서 Worklet 로 교체 예정.
    this.processor = this.ac.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.ac.destination);

    const targetChunkSamples = Math.floor((CHUNK_MS / 1000) * this.inputRate);

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      // 복사 (버퍼 재사용 방지)
      this.chunks.push(new Float32Array(input));
      this.chunkSampleCount += input.length;
      if (this.chunkSampleCount >= targetChunkSamples) {
        const merged = this.mergeChunks();
        this.chunks = [];
        this.chunkSampleCount = 0;
        const resampled = resampleTo16k(merged, this.inputRate);
        this.onChunk(resampled);
      }
    };
  }

  private mergeChunks(): Float32Array {
    const total = this.chunkSampleCount;
    const out = new Float32Array(total);
    let off = 0;
    for (const c of this.chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  stop(): void {
    try { this.processor?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.ac.close(); } catch {}
  }
}

function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === SAMPLE_RATE) return input;
  const ratio = inputRate / SAMPLE_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

// ── 메인 클래스 — SpeechRecognizer 와 동일 시그니처 ───────────────────────────
export class WhisperRecognizer {
  private supported: boolean;
  private _listening = false;
  private _targetText = '';
  private _finalText = '';
  private _accumulated = '';
  private mic: MicAudioBuffer | null = null;
  private stream: MediaStream | null = null;
  private onInterim: InterimCb | null = null;
  private onFinal: FinalCb | null = null;
  private onProgress: ProgressCb | null = null;
  private _stopTimer: ReturnType<typeof setTimeout> | null = null;
  // 진단 카운터 (SpeechRecognizer 와 동일 인터페이스)
  public lastError: string | null = null;
  public lastTranscript = '';
  public startCount = 0;
  public endCount = 0;
  public resultCount = 0;

  constructor() {
    this.supported = typeof window !== 'undefined'
      && !!(window as any).AudioContext
      && !!navigator.mediaDevices
      && !!navigator.mediaDevices.getUserMedia;
  }

  isSupported(): boolean { return this.supported; }
  isListening(): boolean { return this._listening; }

  resetForNextMission(): void {
    this._finalText = '';
    this._accumulated = '';
    this._targetText = '';
  }

  setTargetText(text: string): void {
    this._targetText = text;
  }

  getDiagnostic() {
    return {
      listening: this._listening,
      error: this.lastError,
      transcript: this.lastTranscript,
      starts: this.startCount,
      ends: this.endCount,
      results: this.resultCount,
    };
  }

  /**
   * SpeechRecognizer.listen 과 동일 시그니처.
   * @returns 중단 함수.
   */
  listen(
    _lang: 'ko' | 'en',
    onInterim: InterimCb,
    onFinal: FinalCb,
    timeoutMs = 30_000,
    targetText?: string,
    onProgress?: ProgressCb,
  ): () => void {
    if (!this.supported || this._listening) {
      if (!this.supported) setTimeout(() => onFinal(''), 100);
      return () => {};
    }
    this._listening = true;
    this._accumulated = '';
    this._finalText = '';
    this._targetText = targetText ?? '';
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onProgress = onProgress ?? null;
    this.startCount++;
    this.lastError = null;

    (async () => {
      try {
        // 1) 마이크 스트림 확보 — 기존 __cameraStream 재사용 우선
        let stream = (window as any).__cameraStream as MediaStream | undefined;
        if (!stream || stream.getAudioTracks().length === 0) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          this.stream = stream; // 별도 획득한 것만 cleanup 대상
        }
        if (!this._listening) { // 이미 stop 된 경우
          this.cleanupStream();
          return;
        }

        // 2) Whisper 파이프라인 준비 (지연 로드)
        const asr = await loadWhisperPipeline();
        if (!this._listening) { this.cleanupStream(); return; }

        // 3) 마이크 버퍼 → 5초마다 Whisper 호출
        this.mic = new MicAudioBuffer(stream, (pcm16k) => {
          void this.infer(asr, pcm16k);
        });
      } catch (err) {
        this.lastError = String((err as Error)?.message ?? err);
        this._listening = false;
        try { console.warn('[whisper] listen failed:', err); } catch {}
        onFinal('');
      }
    })();

    this._stopTimer = setTimeout(() => this.finish(), timeoutMs);

    return () => this.finish();
  }

  private async infer(asr: any, pcm16k: Float32Array): Promise<void> {
    if (!this._listening) return;
    try {
      const result = await asr(pcm16k, {
        language: 'korean',
        task: 'transcribe',
        // chunk_length_s: 5,  // chunks 자동처리는 mainthread blocking 심함 → 수동 청킹
      });
      this.resultCount++;
      const text = (result?.text ?? '').trim();
      if (!text) return;
      // 누적 (새 청크는 이전과 겹칠 수 있으므로 간단히 append — 세션 2에서 중복제거)
      this._accumulated = (this._accumulated + ' ' + text).trim();
      this._finalText = this._accumulated;
      this.lastTranscript = this._accumulated;
      this.onInterim?.(this._accumulated);
      if (this._targetText && this.onProgress) {
        this.onProgress(textSimilarity(this._targetText, this._accumulated));
      }
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err);
      try { console.warn('[whisper] infer failed:', err); } catch {}
    }
  }

  private finish(): void {
    if (!this._listening) return;
    this._listening = false;
    this.endCount++;
    if (this._stopTimer) { clearTimeout(this._stopTimer); this._stopTimer = null; }
    try { this.mic?.stop(); } catch {}
    this.mic = null;
    this.cleanupStream();
    const final = this._finalText || this._accumulated;
    this.onFinal?.(final);
    this.onInterim = null;
    this.onFinal = null;
    this.onProgress = null;
  }

  private cleanupStream(): void {
    if (this.stream) {
      try { this.stream.getTracks().forEach((t) => t.stop()); } catch {}
      this.stream = null;
    }
  }

  stop(): void {
    this.finish();
  }
}

let _globalWhisper: WhisperRecognizer | null = null;

export function getGlobalWhisperRecognizer(): WhisperRecognizer {
  if (!_globalWhisper) _globalWhisper = new WhisperRecognizer();
  return _globalWhisper;
}
