/**
 * engine/composition/layers/news_ticker.ts
 *
 * Focused Session-5 Candidate X: **가로 스크롤 브로드캐스트 띠**.
 *
 *   방송국 하단의 news ticker 스타일. 여러 텍스트 조각을 separator 로
 *   이어붙여 우→좌로 흐른다. 내용은 layer.props.texts 또는
 *   state.missionState.ticker 에서 읽는다.
 *
 *   props:
 *     - texts        : string[] | string   (default []). string 이면 단일 항목.
 *     - speedPxPerSec: number              (default 120) — 양수=좌로, 음수=우로
 *     - fontSize     : number              (default 32)
 *     - fontFamily   : string              (default 'Pretendard, system-ui, sans-serif')
 *     - color        : string              (default '#FFFFFF')
 *     - bgColor      : string | null       (default 'rgba(0,0,0,0.7)'); null=투명
 *     - accentColor  : string | null       (default '#FF2D95') — 좌측 인디케이터 바, null=생략
 *     - position     : 'top'|'bottom'|'center'|{y}   (default 'bottom')
 *     - height       : number              (default fontSize * 1.8)
 *     - separator    : string              (default '  •  ')
 *     - paddingX     : number              (default fontSize * 0.6) — 인디케이터 이후 여백
 *     - labelText    : string | null       (default null) — 고정 좌측 라벨(예: 'LIVE')
 *     - labelBg      : string              (default '#FF2D95')
 *     - labelColor   : string              (default '#FFFFFF')
 *
 *   state fallback:
 *     - state.missionState.ticker : string | string[]
 *     - state.tickerText          : string
 *
 *   per-layer offset 는 모듈 스코프 Map 으로 유지되며, 텍스트 내용이
 *   바뀌면 자동 리셋된다.
 */
import type { BaseLayer } from '../../templates/schema';

interface LayerState {
  offsetPx: number;      // 현재 스크롤 오프셋 (누적; 양수면 왼쪽으로 이동)
  lastFrameMs: number;
  lastKey: string;       // 내용 변경 감지용
}

const _perLayer = new Map<string, LayerState>();

function getLayerState(id: string): LayerState {
  let st = _perLayer.get(id);
  if (!st) {
    st = { offsetPx: 0, lastFrameMs: Number.NaN, lastKey: '' };
    _perLayer.set(id, st);
  }
  return st;
}

export function _resetNewsTicker(id?: string): void {
  if (id) _perLayer.delete(id);
  else _perLayer.clear();
}

function readTexts(layer: BaseLayer, state: any): string[] {
  const props: any = layer.props || {};
  const raw =
    props.texts ??
    state?.missionState?.ticker ??
    state?.tickerText ??
    [];
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (typeof raw === 'string' && raw.length > 0) return [raw];
  return [];
}

function resolveY(pos: any, H: number, barH: number): number {
  if (pos && typeof pos === 'object' && Number.isFinite(pos.y)) return pos.y;
  switch (pos) {
    case 'top':    return 0;
    case 'center': return (H - barH) / 2;
    case 'bottom':
    default:       return H - barH;
  }
}

export default function render(
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
): void {
  const id = String(layer.id ?? 'news-ticker');
  const st = getLayerState(id);
  const props: any = layer.props || {};
  const { width: W, height: H } = ctx.canvas;

  const texts = readTexts(layer, state);
  if (texts.length === 0) {
    // 내용 없으면 상태 리셋(다음 내용 들어왔을 때 오른쪽 바깥에서 시작)
    st.offsetPx = 0;
    st.lastFrameMs = Number.NaN;
    st.lastKey = '';
    return;
  }

  const separator  = (props.separator as string) ?? '  •  ';
  const speed      = Number.isFinite(props.speedPxPerSec) ? (props.speedPxPerSec as number) : 120;
  const fontSize   = (props.fontSize as number) || 32;
  const fontFamily = (props.fontFamily as string) || 'Pretendard, system-ui, sans-serif';
  const color      = (props.color as string) || '#FFFFFF';
  const bgColor    = props.bgColor === null ? null : ((props.bgColor as string) || 'rgba(0,0,0,0.7)');
  const accent     = props.accentColor === null ? null : ((props.accentColor as string) || '#FF2D95');
  const height     = (props.height as number) || fontSize * 1.8;
  const paddingX   = (props.paddingX as number) ?? fontSize * 0.6;
  const labelText  = typeof props.labelText === 'string' ? props.labelText : null;
  const labelBg    = (props.labelBg as string) || '#FF2D95';
  const labelColor = (props.labelColor as string) || '#FFFFFF';

  const y = resolveY(props.position, H, height);

  // 내용 키: 변경 감지
  const key = texts.join('\u0001') + '|' + separator;
  if (key !== st.lastKey) {
    st.offsetPx = 0;      // 새 내용은 오른쪽 바깥에서 다시 시작
    st.lastKey = key;
    st.lastFrameMs = Number.NaN;
  }

  // dt 계산
  const dtMs = Number.isFinite(st.lastFrameMs) ? timeMs - st.lastFrameMs : 0;
  st.lastFrameMs = timeMs;
  const dtSec = Math.max(0, Math.min(0.1, dtMs / 1000));
  st.offsetPx += speed * dtSec;

  // 배경
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, y, W, height);
  }

  // 좌측 인디케이터 바
  let leftCursor = 0;
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, y, 8, height);
    leftCursor = 8;
  }

  // 고정 라벨 (LIVE 등)
  ctx.font = `700 ${Math.round(fontSize * 0.82)}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (labelText) {
    const labelW = ctx.measureText(labelText).width + fontSize * 0.8;
    ctx.fillStyle = labelBg;
    ctx.fillRect(leftCursor, y, labelW, height);
    ctx.fillStyle = labelColor;
    ctx.fillText(labelText, leftCursor + fontSize * 0.4, y + height / 2);
    leftCursor += labelW;
  }

  // 스크롤 영역 클립
  const scrollX0 = leftCursor + paddingX;
  const scrollW  = Math.max(1, W - scrollX0);
  ctx.beginPath();
  ctx.rect(scrollX0, y, scrollW, height);
  ctx.clip();

  // 본문 스트링
  const body = texts.join(separator);
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  const bodyW = ctx.measureText(body).width;

  // loop 단위: body + separator(gap). 한 번만 렌더하면 끊겨보이므로
  // 두 번(또는 필요한 만큼) 반복 렌더.
  const gap = ctx.measureText(separator).width;
  const unit = bodyW + gap;

  // 시작 위치: 오른쪽 바깥(W)에서 왼쪽으로 offsetPx 만큼 이동
  // offsetPx 를 unit 으로 modulo → 무한 루프
  let startX: number;
  if (speed >= 0) {
    // 왼쪽으로 흐름
    const off = ((st.offsetPx % unit) + unit) % unit; // 0..unit
    startX = W - off;
  } else {
    // 오른쪽으로 흐름
    const off = ((-st.offsetPx % unit) + unit) % unit;
    startX = scrollX0 - bodyW + off;
  }

  // 반복 렌더: 스크롤 영역 전체를 덮을 때까지
  const textY = y + height / 2;
  let drawX = startX;
  // 왼쪽 경계 넘어설 때까지 뒤로 이동
  while (drawX > scrollX0 - unit) drawX -= unit;
  // 오른쪽 경계까지 반복
  const rightBound = W + unit;
  while (drawX < rightBound) {
    ctx.fillText(body, drawX, textY);
    drawX += unit;
  }

  ctx.restore();
}
