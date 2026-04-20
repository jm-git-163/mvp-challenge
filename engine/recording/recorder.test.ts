import { describe, it, expect, vi } from 'vitest';
import { Recorder, type MediaRecorderLike } from './recorder';
import type { CodecSelection } from './codecNegotiator';

class FakeBlob {
  size = 0;
  type = '';
  constructor(parts: Array<{ size?: number }> = [], opts?: { type?: string }) {
    for (const p of parts) this.size += p?.size ?? 0;
    if (opts?.type) this.type = opts.type;
  }
}

function makeCtor() {
  const instances: FakeRec[] = [];
  class FakeRec implements MediaRecorderLike {
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((e: { error: Error }) => void) | null = null;
    options: unknown;
    constructor(_s: MediaStream, options?: unknown) {
      this.options = options;
      instances.push(this);
    }
    start(_timeslice?: number) { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
    emitData(size: number) {
      this.ondataavailable?.({ data: new FakeBlob([{ size }]) as unknown as Blob });
    }
    emitError(e: Error) { this.onerror?.({ error: e }); }
  }
  return { Ctor: FakeRec as unknown as new (s: MediaStream, o?: unknown) => MediaRecorderLike, instances };
}

const codec: CodecSelection = {
  mimeType: 'video/webm;codecs=vp9,opus',
  videoBitsPerSecond: 3_500_000,
  audioBitsPerSecond: 128_000,
  timesliceMs: 1000,
};

describe('Recorder', () => {
  it('isSupported=false 면 start 즉시 error', () => {
    const r = new Recorder({ ctor: undefined, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    expect(r.getState()).toBe('error');
  });

  it('start → recording, dataavailable 누적', () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    expect(r.getState()).toBe('recording');
    (instances[0] as unknown as { emitData: (s: number) => void }).emitData(1000);
    (instances[0] as unknown as { emitData: (s: number) => void }).emitData(500);
    expect(r.getChunkCount()).toBe(2);
    expect(r.getBytes()).toBe(1500);
  });

  it('pause/resume 상태 전이', () => {
    const { Ctor } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    r.pause();
    expect(r.getState()).toBe('paused');
    r.resume();
    expect(r.getState()).toBe('recording');
  });

  it('stop() → Blob resolve + state=stopped', async () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    (instances[0] as unknown as { emitData: (s: number) => void }).emitData(1000);
    const blob = await r.stop();
    expect(r.getState()).toBe('stopped');
    expect(blob).toBeInstanceOf(FakeBlob);
    expect((blob as unknown as FakeBlob).size).toBe(1000);
    expect((blob as unknown as FakeBlob).type).toBe('video/webm;codecs=vp9,opus');
  });

  it('크기 0 청크는 무시', () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    (instances[0] as unknown as { emitData: (s: number) => void }).emitData(0);
    expect(r.getChunkCount()).toBe(0);
  });

  it('onerror → state=error + subscribe 알림', () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    const events: string[] = [];
    r.subscribe((e) => events.push(e.state));
    r.start({} as MediaStream, codec);
    (instances[0] as unknown as { emitError: (e: Error) => void }).emitError(new Error('boom'));
    expect(r.getState()).toBe('error');
    expect(events.at(-1)).toBe('error');
  });

  it('두 번째 start 무시 (이미 recording)', () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    r.start({} as MediaStream, codec);
    expect(instances.length).toBe(1);
  });

  it('options가 코덱 선택값 반영', () => {
    const { Ctor, instances } = makeCtor();
    const r = new Recorder({ ctor: Ctor, Blob: FakeBlob as unknown as typeof Blob });
    r.start({} as MediaStream, codec);
    const opts = (instances[0] as unknown as { options: { mimeType: string; videoBitsPerSecond: number } }).options;
    expect(opts.mimeType).toBe(codec.mimeType);
    expect(opts.videoBitsPerSecond).toBe(codec.videoBitsPerSecond);
  });
});
