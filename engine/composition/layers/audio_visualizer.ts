/**
 * engine/composition/layers/audio_visualizer.ts
 *
 * Focused Session-5 Candidate U: **오디오 스펙트럼 막대 비주얼라이저 레이어**.
 *
 *   상태(`state`) 에서 FFT magnitude 배열(0~255, Uint8Array 또는 number[]) 을
 *   읽어 Canvas 하단/상단/중앙에 N개 막대로 표시한다.
 *
 *   state 경로 (우선순위):
 *     - state.audioSpectrum : Uint8Array | number[]   ← AnalyserNode.getByteFrequencyData
 *     - state.missionState?.audioSpectrum : 같은 타입
 *
 *   props:
 *     - barCount  : number (default 48)
 *     - bandStart : number (0~1, default 0.0)  — FFT 배열의 어느 비율부터 사용
 *     - bandEnd   : number (0~1, default 0.8)  — 고역 상단은 비어있어서 trim
 *     - color     : string | [string, string]  — 그라디언트 상/하 색
 *     - position  : 'bottom' | 'top' | 'center' | {y: number}  (default 'bottom')
 *     - barWidthRatio : number (0~1, default 0.7) — 간격 대비 막대 두께
 *     - heightRatio   : number (0~1, default 0.25) — 캔버스 높이 대비 최대 bar 높이
 *     - mirror        : boolean — 중앙 대칭 (default false)
 *     - smoothing     : number (0~1, default 0.3) — 프레임 간 envelope 지수평균
 *     - floorDb       : number (default 10) — 임계치 이하(0~255)는 자름
 *
 *   비트 반응:
 *     - state.beatIntensity > 0 이면 막대 높이에 (1 + 0.35*onset) 부스트.
 *
 *   성능:
 *     - 각 막대는 구간 평균 magnitude. 매 프레임 O(barCount * band).
 *     - 48 막대 × 256 bin 기준 1프레임 ~0.05ms.
 */
import type { BaseLayer } from '../../templates/schema';

interface PerLayerState {
  envelope: number[] | null;
}

// layer.id → 이전 프레임 envelope (smoothing). 모듈 스코프로 관리.
const _perLayer = new Map<string, PerLayerState>();

function readSpectrum(state: any): Uint8Array | number[] | null {
  if (!state) return null;
  if (state.audioSpectrum && (state.audioSpectrum as any).length > 0) return state.audioSpectrum;
  const ms = state.missionState?.audioSpectrum;
  if (ms && (ms as any).length > 0) return ms;
  return null;
}

function resolveY(pos: any, H: number, barHeightMax: number): { anchor: number; dir: 1 | -1 } {
  if (pos && typeof pos === 'object' && Number.isFinite(pos.y)) {
    return { anchor: pos.y, dir: -1 };
  }
  switch (pos) {
    case 'top':    return { anchor: 0, dir: 1 };
    case 'center': return { anchor: H / 2, dir: -1 }; // 위로 자람
    case 'bottom':
    default:       return { anchor: H, dir: -1 };
  }
}

function pickColor(c: any): [string, string] {
  if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'string' && typeof c[1] === 'string') {
    return [c[0], c[1]];
  }
  if (typeof c === 'string') return [c, c];
  return ['#60a5fa', '#a78bfa']; // 기본 파랑→보라
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  _timeMs: number,
  state: any,
): void {
  const spec = readSpectrum(state);
  if (!spec || spec.length === 0) return;

  const props = (layer.props as any) || {};
  const { width: W, height: H } = ctx.canvas;

  const barCount  = Math.max(4, Math.min(256, (props.barCount as number) ?? 48));
  const bandStart = Math.max(0, Math.min(0.99, (props.bandStart as number) ?? 0.0));
  const bandEnd   = Math.max(bandStart + 0.01, Math.min(1.0, (props.bandEnd as number) ?? 0.8));
  const barWR    = Math.max(0.05, Math.min(1.0, (props.barWidthRatio as number) ?? 0.7));
  const heightR  = Math.max(0.05, Math.min(0.9,  (props.heightRatio as number) ?? 0.25));
  const mirror   = !!props.mirror;
  const smooth   = Math.max(0, Math.min(0.95, (props.smoothing as number) ?? 0.3));
  const floorDb  = Math.max(0, Math.min(254, (props.floorDb as number) ?? 10));
  const [c0, c1] = pickColor(props.color);

  const onset = Math.max(0, Math.min(1, state?.beatIntensity ?? 0));
  const heightBoost = 1 + 0.35 * onset;

  // envelope per-layer state
  const key = String(layer.id ?? 'audio-viz');
  let st = _perLayer.get(key);
  if (!st || !st.envelope || st.envelope.length !== barCount) {
    st = { envelope: new Array(barCount).fill(0) };
    _perLayer.set(key, st);
  }
  const env = st.envelope as number[];

  // compute per-bar magnitude (0~1)
  const iStart = Math.floor(spec.length * bandStart);
  const iEnd = Math.max(iStart + barCount, Math.floor(spec.length * bandEnd));
  const binsPerBar = Math.max(1, Math.floor((iEnd - iStart) / barCount));

  for (let b = 0; b < barCount; b++) {
    const s = iStart + b * binsPerBar;
    const e = Math.min(iEnd, s + binsPerBar);
    let sum = 0;
    let n = 0;
    for (let i = s; i < e; i++) {
      const v = (spec as any)[i] as number;
      if (v >= floorDb) sum += (v - floorDb);
      n++;
    }
    const target = n > 0 ? (sum / n) / (255 - floorDb) : 0;
    const clamped = Math.max(0, Math.min(1, target));
    env[b] = smooth > 0 ? (smooth * env[b] + (1 - smooth) * clamped) : clamped;
  }

  // geometry
  const totalSlotW = W / barCount;
  const barWidth = totalSlotW * barWR;
  const maxBarH = H * heightR;

  const { anchor, dir } = resolveY(props.position, H, maxBarH);

  // gradient: use linear from c0 (bottom) to c1 (top)
  const grad = ctx.createLinearGradient(
    0, dir === -1 ? anchor : anchor,
    0, dir === -1 ? anchor - maxBarH : anchor + maxBarH,
  );
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.fillStyle = grad;

  for (let b = 0; b < barCount; b++) {
    const h = env[b] * maxBarH * heightBoost;
    const cx = totalSlotW * (b + 0.5);

    if (mirror) {
      const y = anchor - h / 2;
      ctx.fillRect(cx - barWidth / 2, y, barWidth, h);
    } else if (dir === -1) {
      // grows upward from anchor
      ctx.fillRect(cx - barWidth / 2, anchor - h, barWidth, h);
    } else {
      // grows downward
      ctx.fillRect(cx - barWidth / 2, anchor, barWidth, h);
    }
  }
  ctx.restore();
}

/** 테스트/핫리로드 전용: per-layer envelope 상태 초기화. */
export function _resetAudioVizState(): void {
  _perLayer.clear();
}
