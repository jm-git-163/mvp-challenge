/**
 * engine/composition/layerEngine.ts
 *
 * Phase 5b — **레이어 엔진 코어**. docs/COMPOSITION.md §2, §3.
 *
 * 하나의 메인 캔버스에 15~25개 레이어를 zIndex 순으로 순차 그린다.
 * 각 레이어는 BaseLayer 메타(zIndex, opacity, blendMode, enabled, activeRange)와
 * 타입별 `LayerRenderer` (onEnter/render/onExit)를 갖는다.
 *
 * 매 프레임:
 *   1. zIndex 오름차순 순회 (낮은 값이 먼저, 높은 값이 위에 덮임)
 *   2. enabled + activeRange 확인 → 꺼진 레이어 스킵
 *   3. 처음 활성화되는 프레임에 onEnter, 처음 비활성되는 프레임에 onExit 호출
 *   4. ctx.save() → globalAlpha/CompositeOperation 적용 → render() → ctx.restore()
 *   5. 개별 레이어 예외는 격리 (CLAUDE §3 #3: 즉시 크래시 금지, 에러는 상위에 보고).
 */

import type { BaseLayer } from '../templates/schema';

/** 렌더 시점에 레이어에 전달되는 공통 컨텍스트. */
export interface FrameContext {
  /** 캔버스 2D 렌더 컨텍스트. */
  ctx: unknown;
  width: number;
  height: number;
  /** 세션 시작(녹화 시작)부터의 경과 ms. */
  tMs: number;
  /** tMs / 1000. */
  tSec: number;
  /** 누적 프레임 인덱스. */
  frameIndex: number;
  /** 틱 간 델타 ms. 첫 프레임은 0. */
  deltaMs: number;
}

/** 타입별 레이어 렌더러. Phase 5c~5h에서 타입별 구현. */
export interface LayerRenderer {
  /** 레이어가 비활성→활성 전이할 때 1회. 리소스 warm-up용. */
  onEnter?: (fc: FrameContext) => void;
  /** 레이어가 활성→비활성 전이할 때 1회. cleanup. */
  onExit?: (fc: FrameContext) => void;
  /** 활성 동안 매 프레임 호출. globalAlpha/CompositeOperation은 엔진이 미리 세팅. */
  render: (fc: FrameContext) => void;
}

export interface LayerInstance {
  spec: BaseLayer;
  renderer: LayerRenderer;
  /** 내부 상태: 현재 활성 여부(이전 프레임 기준). onEnter/onExit 전이 트리거. */
  _wasActive: boolean;
}

export interface LayerEngineDeps {
  /** 에러 수집 훅. 기본은 console.warn. */
  onError?: (layerId: string, err: Error) => void;
}

export class LayerEngine {
  private layers: LayerInstance[] = [];
  private sorted = false;
  private lastTickMs: number | null = null;
  private frameIndex = 0;
  private readonly onError: (layerId: string, err: Error) => void;

  constructor(
    private readonly canvasCtx: unknown,
    private readonly width: number,
    private readonly height: number,
    deps: LayerEngineDeps = {},
  ) {
    this.onError = deps.onError ?? ((id, e) => { void id; void e; });
  }

  /** 레이어 추가. 동일 id는 거부. 반환값은 remove 함수. */
  addLayer(spec: BaseLayer, renderer: LayerRenderer): () => void {
    if (this.layers.some((l) => l.spec.id === spec.id)) {
      throw new Error(`LayerEngine: 중복 id "${spec.id}"`);
    }
    this.layers.push({ spec, renderer, _wasActive: false });
    this.sorted = false;
    return () => this.removeLayer(spec.id);
  }

  removeLayer(id: string): void {
    const idx = this.layers.findIndex((l) => l.spec.id === id);
    if (idx < 0) return;
    this.layers.splice(idx, 1);
  }

  /** 현재 등록된 레이어 수. */
  layerCount(): number { return this.layers.length; }

  /** 진단용: zIndex 정렬된 id 배열. */
  getLayerOrder(): string[] {
    this.ensureSorted();
    return this.layers.map((l) => l.spec.id);
  }

  /** spec.enabled 토글. 활성 전이되면 다음 프레임에 onEnter 호출됨. */
  setEnabled(id: string, enabled: boolean): void {
    const l = this.layers.find((x) => x.spec.id === id);
    if (l) l.spec = { ...l.spec, enabled };
  }

  /**
   * 한 프레임 렌더. 호출자(Compositor 또는 테스트)가 tMs 제공.
   */
  renderFrame(tMs: number): void {
    this.ensureSorted();
    const deltaMs = this.lastTickMs === null ? 0 : Math.max(0, tMs - this.lastTickMs);
    const fc: FrameContext = {
      ctx: this.canvasCtx,
      width: this.width,
      height: this.height,
      tMs,
      tSec: tMs / 1000,
      frameIndex: this.frameIndex,
      deltaMs,
    };
    for (const l of this.layers) {
      const active = this.isActive(l, fc.tSec);
      // 전이: onEnter / onExit
      if (active && !l._wasActive) {
        this.safe(l, () => l.renderer.onEnter?.(fc));
      } else if (!active && l._wasActive) {
        this.safe(l, () => l.renderer.onExit?.(fc));
      }
      l._wasActive = active;
      if (!active) continue;

      // ctx 프로퍼티 (타입 안전한 서브셋). 실제 CanvasRenderingContext2D 또는 테스트 스텁.
      const c = this.canvasCtx as {
        save?: () => void;
        restore?: () => void;
        globalAlpha?: number;
        globalCompositeOperation?: string;
      };
      c.save?.();
      const prevAlpha = c.globalAlpha;
      const prevBlend = c.globalCompositeOperation;
      try {
        if ('globalAlpha' in (c as object)) c.globalAlpha = l.spec.opacity;
        if (l.spec.blendMode && 'globalCompositeOperation' in (c as object)) {
          c.globalCompositeOperation = l.spec.blendMode;
        }
        this.safe(l, () => l.renderer.render(fc));
      } finally {
        // restore()가 둘 다 되돌리지만, 스텁(간단 ctx) 대응해 수동 복원도 시도.
        if (prevAlpha !== undefined) c.globalAlpha = prevAlpha;
        if (prevBlend !== undefined) c.globalCompositeOperation = prevBlend;
        c.restore?.();
      }
    }
    this.lastTickMs = tMs;
    this.frameIndex++;
  }

  /** 시간 초기화. start() 시 호출. */
  reset(): void {
    this.lastTickMs = null;
    this.frameIndex = 0;
    for (const l of this.layers) l._wasActive = false;
  }

  private ensureSorted(): void {
    if (this.sorted) return;
    // 오름차순: 낮은 zIndex가 먼저(뒤에) 그려진다.
    this.layers.sort((a, b) => a.spec.zIndex - b.spec.zIndex);
    this.sorted = true;
  }

  private isActive(l: LayerInstance, tSec: number): boolean {
    if (!l.spec.enabled) return false;
    const ar = l.spec.activeRange;
    if (!ar) return true;
    return tSec >= ar.startSec && tSec <= ar.endSec;
  }

  private safe(l: LayerInstance, fn: () => void): void {
    try { fn(); } catch (e) { this.onError(l.spec.id, e as Error); }
  }
}
