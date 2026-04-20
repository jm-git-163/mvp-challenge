/**
 * engine/ar/oneEuroFilter.ts
 *
 * Phase 1 — AR 랜드마크 스무딩.
 * Géry Casiez et al., "1€ Filter: A Simple Speed-based Low-pass Filter
 * for Noisy Input in Interactive Systems" (CHI 2012).
 *
 * 사용처: PoseLandmarker / FaceLandmarker 출력의 좌표 지터 제거.
 * - minCutoff: 정지 시 컷오프 (작을수록 더 많이 스무딩, 지연 ↑)
 * - beta: 속도 기반 컷오프 조절 (클수록 빠른 움직임에 덜 스무딩 = 지연 ↓)
 * - dCutoff: 도함수의 저역 통과 컷오프
 *
 * docs/PERFORMANCE §4: 얼굴 랜드마크는 minCutoff=1.0/beta=0.007 권장
 *                    손·몸 랜드마크는 minCutoff=0.5/beta=0.01 권장
 */

export interface OneEuroParams {
  minCutoff?: number;  // Hz
  beta?: number;
  dCutoff?: number;    // Hz
  /** 초기화 시 첫 신호를 그대로 반환할지. true면 warm-up. */
  initAsIs?: boolean;
}

const DEFAULTS: Required<OneEuroParams> = {
  minCutoff: 1.0,
  beta: 0.0,
  dCutoff: 1.0,
  initAsIs: true,
};

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class LowPass {
  private y: number | null = null;
  private s: number | null = null;
  filter(x: number, a: number): number {
    if (this.y === null) { this.y = x; this.s = x; return x; }
    const s = a * x + (1 - a) * (this.s as number);
    this.y = x; this.s = s;
    return s;
  }
  reset(): void { this.y = null; this.s = null; }
  hasHistory(): boolean { return this.y !== null; }
  lastRaw(): number | null { return this.y; }
}

export class OneEuroFilter {
  private xLP = new LowPass();
  private dxLP = new LowPass();
  private lastTime: number | null = null;
  private readonly p: Required<OneEuroParams>;

  constructor(params: OneEuroParams = {}) {
    this.p = { ...DEFAULTS, ...params };
  }

  /**
   * @param x 신호값
   * @param t 타임스탬프 (ms). 생략 시 performance.now() 또는 Date.now()
   */
  filter(x: number, t?: number): number {
    const now = t ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this.lastTime === null) {
      this.lastTime = now;
      this.xLP.filter(x, 1);
      this.dxLP.filter(0, 1);
      return this.p.initAsIs ? x : x;
    }
    const dtMs = now - this.lastTime;
    // 단조 증가 가정이지만 동일/역전 타임스탬프 대응
    const dt = dtMs > 0 ? dtMs / 1000 : 1 / 120; // 동일시각이면 120fps 기준 임시
    this.lastTime = now;

    const prev = this.xLP.lastRaw() as number;
    const dx = (x - prev) / dt;
    const edx = this.dxLP.filter(dx, alpha(this.p.dCutoff, dt));
    const cutoff = this.p.minCutoff + this.p.beta * Math.abs(edx);
    const y = this.xLP.filter(x, alpha(cutoff, dt));
    return y;
  }

  reset(): void {
    this.xLP.reset();
    this.dxLP.reset();
    this.lastTime = null;
  }
}

/** 벡터(2D/3D/N차원 랜드마크) 스무딩. 각 축 독립 1€ 필터. */
export class OneEuroVectorFilter {
  private filters: OneEuroFilter[] = [];
  constructor(private dim: number, private params: OneEuroParams = {}) {
    for (let i = 0; i < dim; i++) this.filters.push(new OneEuroFilter(params));
  }
  filter(v: readonly number[], t?: number): number[] {
    if (v.length !== this.dim) throw new Error(`dim mismatch: got ${v.length}, expected ${this.dim}`);
    return this.filters.map((f, i) => f.filter(v[i], t));
  }
  reset(): void { for (const f of this.filters) f.reset(); }
}
