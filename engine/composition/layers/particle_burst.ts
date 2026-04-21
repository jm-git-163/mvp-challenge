/**
 * engine/composition/layers/particle_burst.ts
 *
 * Focused Session-5 Candidate W: **미션 이벤트 파티클 버스트 레이어**.
 *
 *   - state.missionState.pulseSeq 가 증가할 때마다(또는 state.beatIntensity 가 갑자기 증가할 때)
 *     props 로 지정된 N개의 파티클을 화면에 폭발적으로 방출.
 *   - 파티클은 자체 수명(lifeMs) 동안 위치/알파 애니메이트. 수명 끝나면 제거.
 *   - 레이어 인스턴스별 상태는 모듈 스코프 Map 으로 관리.
 *
 *   props:
 *     - burstCount : number         (default 24)
 *     - origin     : 'center' | 'bottom-center' | {x,y}  (default 'center')
 *     - speedMin   : number (px/s)  (default 180)
 *     - speedMax   : number (px/s)  (default 420)
 *     - lifeMs     : number         (default 900)
 *     - gravity    : number (px/s²) (default 180) — 양수면 아래로 끌림
 *     - sizeMin    : number (px)    (default 4)
 *     - sizeMax    : number (px)    (default 10)
 *     - colors     : string[]       (default ['#fbbf24','#f472b6','#60a5fa'])
 *     - shape      : 'circle' | 'square' | 'star'  (default 'circle')
 *     - fadeCurve  : 'linear' | 'quad'  (default 'linear')
 *     - triggerOn  : 'pulseSeq' | 'beat' | 'manual'  (default 'pulseSeq')
 *     - beatThreshold : number (0~1)  (default 0.85) — triggerOn='beat' 에서 교차 임계치
 *
 *   triggerOn='manual': 외부에서 `triggerParticleBurst(layerId)` 호출 필요.
 */
import type { BaseLayer } from '../../templates/schema';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  bornMs: number;
  lifeMs: number;
}

interface LayerState {
  particles: Particle[];
  lastPulseSeq: number;
  lastBeatIntensity: number;
  lastFrameMs: number;
  manualTrigger: boolean;
}

const _perLayer = new Map<string, LayerState>();

function getLayerState(id: string): LayerState {
  let st = _perLayer.get(id);
  if (!st) {
    st = {
      particles: [],
      lastPulseSeq: -1,
      lastBeatIntensity: 0,
      lastFrameMs: 0,
      manualTrigger: false,
    };
    _perLayer.set(id, st);
  }
  return st;
}

/** 외부 API: 특정 레이어 id 에 대해 수동 버스트. */
export function triggerParticleBurst(layerId: string): void {
  const st = getLayerState(layerId);
  st.manualTrigger = true;
}

/** 테스트 전용 초기화. */
export function _resetParticleBurst(layerId?: string): void {
  if (layerId) _perLayer.delete(layerId);
  else _perLayer.clear();
}

function resolveOrigin(
  origin: any, W: number, H: number,
): { x: number; y: number } {
  if (origin && typeof origin === 'object' && Number.isFinite(origin.x)) {
    return { x: origin.x, y: origin.y };
  }
  switch (origin) {
    case 'bottom-center': return { x: W / 2, y: H * 0.9 };
    case 'top-center':    return { x: W / 2, y: H * 0.1 };
    case 'center':
    default:              return { x: W / 2, y: H / 2 };
  }
}

function pickArray<T>(arr: T[] | undefined, fallback: T[]): T[] {
  return Array.isArray(arr) && arr.length > 0 ? arr : fallback;
}

function emit(st: LayerState, props: any, W: number, H: number, nowMs: number): void {
  const n = Math.max(1, Math.min(200, (props.burstCount as number) ?? 24));
  const speedMin = (props.speedMin as number) ?? 180;
  const speedMax = (props.speedMax as number) ?? 420;
  const sizeMin  = (props.sizeMin as number) ?? 4;
  const sizeMax  = (props.sizeMax as number) ?? 10;
  const lifeMs   = (props.lifeMs as number) ?? 900;
  const colors   = pickArray<string>(props.colors, ['#fbbf24', '#f472b6', '#60a5fa']);
  const origin   = resolveOrigin(props.origin, W, H);

  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = speedMin + Math.random() * (speedMax - speedMin);
    const size = sizeMin + Math.random() * (sizeMax - sizeMin);
    const color = colors[Math.floor(Math.random() * colors.length)];
    st.particles.push({
      x: origin.x, y: origin.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size, color,
      bornMs: nowMs,
      lifeMs,
    });
  }
}

function updateAndCull(st: LayerState, dtSec: number, gravity: number, nowMs: number): void {
  const alive: Particle[] = [];
  for (const p of st.particles) {
    const age = nowMs - p.bornMs;
    if (age >= p.lifeMs) continue;
    // velocity 를 먼저 적분해야 중력이 1프레임 지연되지 않음 (semi-implicit Euler)
    p.vy += gravity * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    alive.push(p);
  }
  st.particles = alive;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number, y: number, size: number,
): void {
  if (shape === 'square') {
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    return;
  }
  if (shape === 'star') {
    // 5-pointed star (quick)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.5;
      const sx = x + Math.cos(a) * r;
      const sy = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  // circle (default)
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const id = String(layer.id ?? 'particle-burst');
  const st = getLayerState(id);
  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;

  // timeStep
  const dtMs = st.lastFrameMs === 0 ? 0 : timeMs - st.lastFrameMs;
  st.lastFrameMs = timeMs;
  const dtSec = Math.max(0, Math.min(0.1, dtMs / 1000));

  // trigger detection
  const triggerOn = (props.triggerOn as string) || 'pulseSeq';
  let shouldEmit = false;

  if (triggerOn === 'pulseSeq') {
    const seq = Number(state?.missionState?.pulseSeq ?? -1);
    if (Number.isFinite(seq) && seq > st.lastPulseSeq) {
      if (st.lastPulseSeq !== -1) shouldEmit = true; // 첫 마운트에서는 방출 안함
      st.lastPulseSeq = seq;
    }
  } else if (triggerOn === 'beat') {
    const thr = Math.max(0, Math.min(1, (props.beatThreshold as number) ?? 0.85));
    const cur = Math.max(0, Math.min(1, state?.beatIntensity ?? 0));
    if (st.lastBeatIntensity < thr && cur >= thr) shouldEmit = true;
    st.lastBeatIntensity = cur;
  } else if (triggerOn === 'manual') {
    if (st.manualTrigger) {
      shouldEmit = true;
      st.manualTrigger = false;
    }
  }

  if (shouldEmit) emit(st, props, W, H, timeMs);

  // simulate
  const gravity = (props.gravity as number) ?? 180;
  updateAndCull(st, dtSec, gravity, timeMs);

  if (st.particles.length === 0) return;

  const shape = (props.shape as string) || 'circle';
  const fadeCurve = (props.fadeCurve as string) || 'linear';

  ctx.save();
  for (const p of st.particles) {
    const age = timeMs - p.bornMs;
    const life01 = Math.max(0, Math.min(1, age / p.lifeMs));
    const alpha = fadeCurve === 'quad' ? (1 - life01) * (1 - life01) : (1 - life01);
    ctx.globalAlpha = (layer.opacity ?? 1) * alpha;
    ctx.fillStyle = p.color;
    drawShape(ctx, shape, p.x, p.y, p.size);
  }
  ctx.restore();
}
