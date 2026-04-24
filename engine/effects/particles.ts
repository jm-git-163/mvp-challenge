/**
 * engine/effects/particles.ts
 *
 * Phase 5c (파티클) — docs/VISUAL_DESIGN §6.1.
 *
 * 풀(pool) 기반 파티클 시스템. 최대 N개 재사용해 GC 압력 최소화.
 * 순수 로직 — canvas 드로잉은 `renderParticles(ctx, system)` 유틸에서.
 *
 * 프리셋: confettiBurst, starShower, sparkle, dust.
 *
 * **결정론 주의** (CLAUDE §3 #2): 난수는 주입된 rng()만 사용.
 */

export interface Particle {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;     // 가속도 (중력 등)
  size: number;
  color: string;
  alpha: number;
  ageMs: number;
  lifeMs: number;             // 0이면 영구
  /** 수명 종료 시 페이드아웃 여부. */
  fadeOut: boolean;
  /** 회전(도) + 각속도(도/초). */
  angleDeg: number; angularVelDps: number;
  /** 모양. */
  shape: 'circle' | 'square' | 'triangle' | 'line';
}

export type Rng = () => number; // [0,1)

export interface ParticleEmitOpts {
  count: number;
  x: number; y: number;
  speed: { min: number; max: number };
  angleDeg: { min: number; max: number };
  size: { min: number; max: number };
  colors: string[];
  lifeMs: { min: number; max: number };
  gravity?: number;              // px/s² 방향 +y
  drag?: number;                 // 0..1 per sec (0=감쇠 없음)
  fadeOut?: boolean;
  shape?: Particle['shape'];
  spinDps?: { min: number; max: number };
}

export class ParticleSystem {
  private pool: Particle[];
  private readonly rng: Rng;
  private readonly drag: number;

  constructor(public readonly capacity: number = 200, rng: Rng = Math.random, globalDrag = 0) {
    this.rng = rng;
    this.drag = globalDrag;
    this.pool = Array.from({ length: capacity }, () => this.blank());
  }

  private blank(): Particle {
    return {
      alive: false, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
      size: 0, color: '#fff', alpha: 1, ageMs: 0, lifeMs: 0,
      fadeOut: true, angleDeg: 0, angularVelDps: 0, shape: 'circle',
    };
  }

  /** 살아있는 파티클 수. */
  aliveCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.alive) n++;
    return n;
  }

  /** 외부 이터레이션(렌더링)용. */
  forEachAlive(cb: (p: Particle) => void): void {
    for (const p of this.pool) if (p.alive) cb(p);
  }

  /** 풀에서 비어있는 슬롯 하나 찾기. 없으면 null. */
  private acquire(): Particle | null {
    for (const p of this.pool) if (!p.alive) return p;
    return null;
  }

  /** 한 번에 count개 발사. 풀이 모자라면 가능한 만큼만. */
  emit(opts: ParticleEmitOpts): number {
    let emitted = 0;
    for (let i = 0; i < opts.count; i++) {
      const p = this.acquire();
      if (!p) break;
      const speed = lerp(opts.speed.min, opts.speed.max, this.rng());
      const ang = lerp(opts.angleDeg.min, opts.angleDeg.max, this.rng());
      const rad = (ang * Math.PI) / 180;
      p.alive = true;
      p.x = opts.x; p.y = opts.y;
      p.vx = Math.cos(rad) * speed;
      p.vy = Math.sin(rad) * speed;
      p.ax = 0;
      p.ay = opts.gravity ?? 0;
      p.size = lerp(opts.size.min, opts.size.max, this.rng());
      p.color = opts.colors[Math.floor(this.rng() * opts.colors.length)] ?? '#fff';
      p.alpha = 1;
      p.ageMs = 0;
      p.lifeMs = lerp(opts.lifeMs.min, opts.lifeMs.max, this.rng());
      p.fadeOut = opts.fadeOut ?? true;
      p.shape = opts.shape ?? 'circle';
      const spin = opts.spinDps ?? { min: 0, max: 0 };
      p.angularVelDps = lerp(spin.min, spin.max, this.rng());
      p.angleDeg = this.rng() * 360;
      emitted++;
    }
    return emitted;
  }

  /** 타임스텝 진행. dtMs 입력. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const d = this.drag > 0 ? Math.pow(1 - this.drag, dt) : 1;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.ageMs += dtMs;
      if (p.lifeMs > 0 && p.ageMs >= p.lifeMs) {
        p.alive = false;
        continue;
      }
      p.vx = (p.vx + p.ax * dt) * d;
      p.vy = (p.vy + p.ay * dt) * d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angleDeg += p.angularVelDps * dt;
      if (p.fadeOut && p.lifeMs > 0) {
        const t = p.ageMs / p.lifeMs;
        // 마지막 30% 구간에서 선형 페이드
        p.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      }
    }
  }

  clear(): void { for (const p of this.pool) p.alive = false; }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// ── 프리셋 ──────────────────────────────────────────────────────────

export const PARTICLE_PRESETS = {
  confettiBurst(x: number, y: number, colors: string[]): ParticleEmitOpts {
    return {
      count: 60, x, y,
      speed: { min: 300, max: 700 },
      angleDeg: { min: -180, max: 0 }, // 위쪽으로 분출
      size: { min: 6, max: 14 },
      colors,
      lifeMs: { min: 1200, max: 2000 },
      gravity: 900,
      drag: 0.1,
      fadeOut: true,
      shape: 'square',
      spinDps: { min: -720, max: 720 },
    };
  },
  starShower(x: number, y: number, color = '#FFFFFF'): ParticleEmitOpts {
    return {
      count: 40, x, y,
      speed: { min: 80, max: 180 },
      angleDeg: { min: 80, max: 100 }, // 아래 방향
      size: { min: 2, max: 4 },
      colors: [color],
      lifeMs: { min: 1500, max: 2500 },
      gravity: 40,
      fadeOut: true,
      shape: 'circle',
    };
  },
  sparkle(x: number, y: number, color = '#FFD86B'): ParticleEmitOpts {
    return {
      count: 12, x, y,
      speed: { min: 20, max: 60 },
      angleDeg: { min: 0, max: 360 },
      size: { min: 2, max: 5 },
      colors: [color],
      lifeMs: { min: 400, max: 700 },
      fadeOut: true,
      shape: 'circle',
    };
  },
  dust(x: number, y: number): ParticleEmitOpts {
    return {
      count: 6, x, y,
      speed: { min: 10, max: 30 },
      angleDeg: { min: -100, max: -80 },
      size: { min: 1.5, max: 3 },
      colors: ['rgba(255,255,255,0.6)'],
      lifeMs: { min: 2000, max: 3500 },
      gravity: -8,
      fadeOut: true,
      shape: 'circle',
    };
  },
};

// ── 렌더링 ───────────────────────────────────────────────────────────

/** Canvas 2D 렌더 유틸. 사용처에서 ctx.save/restore는 상위에서 보장. */
export function renderParticles(ctx: CanvasRenderingContext2D, sys: ParticleSystem): void {
  sys.forEachAlive((p) => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    switch (p.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'square':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angleDeg * Math.PI) / 180);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        break;
      case 'triangle':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angleDeg * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, p.size);
        ctx.lineTo(-p.size, p.size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      case 'line':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angleDeg * Math.PI) / 180);
        ctx.fillRect(-p.size, -1, p.size * 2, 2);
        ctx.restore();
        break;
    }
  });
  ctx.globalAlpha = 1;
}
