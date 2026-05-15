/**
 * engine/recording/compositor.ts
 *
 * Phase 3 — **단순 합성기**. 본격적인 레이어 엔진은 Phase 5.
 *
 * 목적: 녹화 파이프라인을 먼저 뚫기 위해 "비디오 + 테스트 텍스트 1개"만 합성하는
 * 최소 컴포지터를 제공. Phase 5에서 이 인터페이스를 확장한 `LayerEngine`으로 교체.
 *
 * 아키텍처:
 *   Compositor
 *     - start(): requestAnimationFrame 루프 시작
 *     - stop(): 루프 정지
 *     - drawFrame(ctx, t): 한 프레임 합성 (주입된 renderer 함수 호출)
 *
 * 테스트: rAF/ctx를 모두 주입해 node 환경에서 프레임 카운트/타이밍 검증.
 */

export interface RendererContext {
  ctx: unknown;            // CanvasRenderingContext2D
  width: number;
  height: number;
  tMs: number;             // 세션 시작부터의 경과 시간
  frameIndex: number;
}

export type Renderer = (rc: RendererContext) => void;

export interface CompositorDeps {
  /** requestAnimationFrame 대안. 기본 globalThis.requestAnimationFrame. */
  raf?: (cb: (ts: number) => void) => number;
  cancelRaf?: (handle: number) => void;
  /** 현재 타임스탬프 (ms). */
  now?: () => number;
}

export interface CompositorOptions {
  width: number;
  height: number;
  /** 목표 fps. RAF 호출 사이에 이 간격 미만이면 drawFrame 스킵. 기본 30. */
  targetFps?: number;
}

export class Compositor {
  private running = false;
  private handle: number | null = null;
  private startMs = 0;
  private lastDrawMs = -Infinity;
  private frameIndex = 0;
  private readonly raf: (cb: (ts: number) => void) => number;
  private readonly cancelRaf: (h: number) => void;
  private readonly now: () => number;
  private renderers: Renderer[] = [];

  constructor(
    private readonly canvasCtx: unknown,
    private readonly opts: CompositorOptions,
    deps: CompositorDeps = {},
  ) {
    this.raf = deps.raf ?? ((cb) => (globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(cb)
      : (setTimeout(() => cb(performance.now?.() ?? Date.now()), 16) as unknown as number)));
    this.cancelRaf = deps.cancelRaf ?? ((h) => {
      if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(h);
      else clearTimeout(h as unknown as NodeJS.Timeout);
    });
    this.now = deps.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  addRenderer(r: Renderer): () => void {
    this.renderers.push(r);
    return () => {
      const i = this.renderers.indexOf(r);
      if (i >= 0) this.renderers.splice(i, 1);
    };
  }

  rendererCount(): number { return this.renderers.length; }
  isRunning(): boolean { return this.running; }
  getFrameIndex(): number { return this.frameIndex; }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startMs = this.now();
    this.lastDrawMs = -Infinity;
    this.frameIndex = 0;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) this.cancelRaf(this.handle);
    this.handle = null;
  }

  /** 외부(녹화기)가 강제로 한 프레임 그리고 싶을 때. */
  drawOnce(): void {
    this.drawFrame(this.now());
  }

  private schedule(): void {
    if (!this.running) return;
    this.handle = this.raf(() => this.tick());
  }

  private tick(): void {
    if (!this.running) return;
    const nowMs = this.now();
    const elapsed = nowMs - this.startMs;
    const minIntervalMs = 1000 / (this.opts.targetFps ?? 30);
    if (elapsed - this.lastDrawMs >= minIntervalMs) {
      this.drawFrame(nowMs);
    }
    this.schedule();
  }

  private drawFrame(nowMs: number): void {
    const tMs = nowMs - this.startMs;
    const rc: RendererContext = {
      ctx: this.canvasCtx,
      width: this.opts.width,
      height: this.opts.height,
      tMs,
      frameIndex: this.frameIndex,
    };
    for (const r of this.renderers) {
      try { r(rc); } catch { /* 단일 레이어 예외는 다음 레이어에 전파 안 함 */ }
    }
    this.frameIndex++;
    this.lastDrawMs = tMs;
  }
}
