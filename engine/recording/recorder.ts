/**
 * engine/recording/recorder.ts
 *
 * Phase 3 — MediaRecorder 래퍼.
 *
 * 계약:
 *   - 캔버스 스트림(`canvas.captureStream(30)`) + 오디오 Mixer 출력 스트림을 결합한
 *     `MediaStream`을 받아 녹화. 청크는 1초 단위.
 *   - 종료 시 단일 Blob으로 결합해 반환.
 *   - onError / onState subscribe 지원.
 *   - Wake Lock·미디어 점유 관리는 상위 (Phase 5 RecordingPipeline).
 *
 * 테스트: `MediaRecorderLike` 주입으로 node에서 검증.
 */

import type { CodecSelection } from './codecNegotiator';

export interface MediaRecorderLike {
  state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: { error: Error }) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  requestData?(): void;
}

export interface RecorderDeps {
  /** new 가능한 MediaRecorder 생성자. 없으면 globalThis.MediaRecorder. */
  ctor?: new (stream: MediaStream, options?: unknown) => MediaRecorderLike;
  /** Blob 생성자. 테스트에서 주입. */
  Blob?: typeof Blob;
}

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecorderEvent {
  state: RecorderState;
  /** 지금까지 쌓인 청크 수. */
  chunkCount: number;
  /** 누적 예상 바이트 (마지막 청크 Blob.size 합). */
  bytes: number;
  error?: Error;
}

export class Recorder {
  private rec: MediaRecorderLike | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private state: RecorderState = 'idle';
  private listeners: Array<(e: RecorderEvent) => void> = [];
  private readonly Ctor: (new (stream: MediaStream, options?: unknown) => MediaRecorderLike) | undefined;
  private readonly BlobCtor: typeof Blob;
  private stopResolve: ((b: Blob) => void) | null = null;
  private stopReject: ((e: Error) => void) | null = null;

  constructor(deps: RecorderDeps = {}) {
    this.Ctor = deps.ctor
      ?? (typeof MediaRecorder !== 'undefined'
          ? (MediaRecorder as unknown as new (s: MediaStream, o?: unknown) => MediaRecorderLike)
          : undefined);
    this.BlobCtor = deps.Blob ?? (typeof Blob !== 'undefined' ? Blob : (class FakeBlob {
      size = 0;
      constructor(parts: unknown[]) {
        for (const p of parts) this.size += (p as { size?: number })?.size ?? 0;
      }
    } as unknown as typeof Blob));
  }

  isSupported(): boolean { return !!this.Ctor; }
  getState(): RecorderState { return this.state; }
  getChunkCount(): number { return this.chunks.length; }

  subscribe(cb: (e: RecorderEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  start(stream: MediaStream, codec: CodecSelection): void {
    if (!this.Ctor) {
      this.setState('error', new Error('MediaRecorder not supported'));
      return;
    }
    if (this.state === 'recording') return;

    this.chunks = [];
    this.bytes = 0;

    const options = {
      mimeType: codec.mimeType,
      videoBitsPerSecond: codec.videoBitsPerSecond,
      audioBitsPerSecond: codec.audioBitsPerSecond,
    };
    let rec: MediaRecorderLike;
    try {
      rec = new this.Ctor(stream, options);
    } catch (e) {
      this.setState('error', e as Error);
      return;
    }

    rec.ondataavailable = (ev) => {
      if (!ev.data) return;
      if ((ev.data as { size?: number }).size === 0) return;
      this.chunks.push(ev.data);
      this.bytes += (ev.data as { size?: number }).size ?? 0;
      this.notify();
    };
    rec.onerror = (ev) => {
      this.setState('error', ev.error);
      this.stopReject?.(ev.error);
      this.stopResolve = null; this.stopReject = null;
    };
    rec.onstop = () => {
      const blob = new this.BlobCtor(this.chunks, { type: codec.mimeType });
      this.setState('stopped');
      this.stopResolve?.(blob);
      this.stopResolve = null; this.stopReject = null;
    };

    try {
      rec.start(codec.timesliceMs);
      this.rec = rec;
      this.setState('recording');
    } catch (e) {
      this.setState('error', e as Error);
    }
  }

  pause(): void {
    if (this.state !== 'recording') return;
    this.rec?.pause();
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.rec?.resume();
    this.setState('recording');
  }

  /** 정지 후 결합 Blob을 resolve. */
  async stop(): Promise<Blob> {
    if (!this.rec) throw new Error('not recording');
    if (this.state === 'stopped') {
      return new this.BlobCtor(this.chunks);
    }
    return new Promise<Blob>((resolve, reject) => {
      this.stopResolve = resolve;
      this.stopReject = reject;
      try { this.rec?.stop(); } catch (e) { reject(e as Error); }
    });
  }

  getBytes(): number { return this.bytes; }

  private setState(state: RecorderState, error?: Error): void {
    this.state = state;
    this.notify(error);
  }

  private notify(error?: Error): void {
    const ev: RecorderEvent = { state: this.state, chunkCount: this.chunks.length, bytes: this.bytes, error };
    for (const cb of [...this.listeners]) {
      try { cb(ev); } catch { /* ignore */ }
    }
  }
}
