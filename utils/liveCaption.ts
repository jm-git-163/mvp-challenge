/**
 * utils/liveCaption.ts — FIX-Z25 (2026-04-22)
 *
 * 녹화 캔버스 하단 1/4 지점에 실시간 자막을 그린다.
 * + 대본 챌린지 발화 판정 (Perfect/Good/So-so/Miss) 우측 상단 팝업.
 *
 * 순수 함수 모듈 — DOM/React 의존 없음. 단위테스트 용이.
 *
 * 위치 선정 근거 (9:16 720×1280 캔버스):
 *  - y ≈ 0.78~0.92 (998~1178px) → 얼굴(상단 30~60%) 가림 없음
 *  - 좌우 16px 마진 → 프레임 깎임 방지
 *  - 폰트 42~48px bold → 모바일 실기기에서 2m 거리에서도 판독 가능
 *  - 배경 rgba(0,0,0,0.72) + 좌측 6px accent strip → 명도대비 WCAG AA 이상
 *  - 최대 2줄, 초과 시 가운데 말줄임표
 *  - 판정 팝업은 우측 상단(코너) 72px bold, 0.8s 페이드아웃
 */

export type JudgementTier = 'perfect' | 'good' | 'soso' | 'miss';

export interface LiveCaptionOpts {
  canvasW: number;
  canvasH: number;
  text: string;
  accentColor?: string;
  judgementTier?: JudgementTier | null;
  /** 폰트 크기. default 46. */
  fontSize?: number;
  /** 박스 좌우 마진. default 16. */
  margin?: number;
}

export interface JudgementToastOpts {
  canvasW: number;
  canvasH: number;
  /** 'perfect'|'good'|'soso'|'miss' */
  tier: JudgementTier;
  /** 판정 발생 시각 (performance.now() 기준 ms) */
  at: number;
  /** 현재 시각. default performance.now() */
  now?: number;
  /** 표시 지속시간. default 800ms */
  durationMs?: number;
}

type Ctx2D = {
  save: () => void;
  restore: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (t: string, x: number, y: number) => void;
  measureText: (t: string) => { width: number };
  fillStyle: any;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
};

export const TIER_COLORS: Record<JudgementTier, string> = {
  perfect: '#39FF7D',
  good:    '#00E0FF',
  soso:    '#FFCC00',
  miss:    '#FF6B6B',
};

export const TIER_LABELS: Record<JudgementTier, string> = {
  perfect: 'PERFECT!',
  good:    'GOOD',
  soso:    'SO-SO',
  miss:    'MISS',
};

/**
 * similarity (0~1) → judgement tier.
 *  ≥0.90 perfect / ≥0.70 good / ≥0.50 so-so / else miss
 */
export function similarityToTier(sim: number): JudgementTier {
  if (sim >= 0.90) return 'perfect';
  if (sim >= 0.70) return 'good';
  if (sim >= 0.50) return 'soso';
  return 'miss';
}

/**
 * 주어진 max 폭 안에 들어가도록 2줄까지 greedy wrap.
 * 3줄 이상이면 마지막 줄에 … 붙여 자름.
 * 순수 함수 — measureText 가 있는 ctx 를 받음.
 */
export function wrapCaption(
  ctx: Pick<Ctx2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines: number = 2,
): string[] {
  if (!text) return [];
  // 한국어는 공백 없이 이어질 때가 많음 → 문자 단위로도 끊을 수 있게 대비.
  const words = text.split(/(\s+)/); // 공백 보존
  const lines: string[] = [];
  let cur = '';
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth;
  const pushLine = (s: string) => { if (s.trim()) lines.push(s.trim()); };

  for (const w of words) {
    const tryLine = cur + w;
    if (fits(tryLine)) {
      cur = tryLine;
    } else {
      if (cur) {
        pushLine(cur);
        if (lines.length >= maxLines) break;
        cur = '';
      }
      // 단일 단어가 maxWidth 보다 큰 경우 → 문자 단위로 쪼갬
      if (!fits(w)) {
        let buf = '';
        for (const ch of w) {
          if (fits(buf + ch)) {
            buf += ch;
          } else {
            if (buf) pushLine(buf);
            if (lines.length >= maxLines) { buf = ''; break; }
            buf = ch;
          }
        }
        cur = buf;
      } else {
        cur = w;
      }
    }
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && cur.trim()) pushLine(cur);

  // maxLines 초과분이 남았다면 마지막 줄에 … 붙여 자름.
  if (lines.length === maxLines) {
    // 남은 텍스트가 있는지 대충 감지 — cur 에 아직 내용 남았거나 words 소진 안 됨.
    // 간단히 lines 마지막 폭이 maxWidth 근접 + 원문 전체가 아직 다 안 들어갔으면 …
    const joined = lines.join(' ');
    if (joined.length < text.replace(/\s+/g, ' ').trim().length) {
      let last = lines[maxLines - 1];
      const ell = '…';
      while (last.length > 0 && !fits(last + ell)) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + ell;
    }
  }
  return lines;
}

/**
 * 캔버스 하단 1/4 지점(y ≈ 78~92%) 에 자막 렌더.
 * text 가 비어있으면 아무것도 그리지 않음.
 */
export function drawLiveCaption(ctx: Ctx2D, opts: LiveCaptionOpts): void {
  const text = (opts.text || '').trim();
  if (!text) return;

  const CW = opts.canvasW;
  const CH = opts.canvasH;
  const fontSize = opts.fontSize ?? 46;
  const margin = opts.margin ?? 16;
  const accent = opts.accentColor
    ?? (opts.judgementTier ? TIER_COLORS[opts.judgementTier] : '#7fffd4');

  const boxX = margin;
  const boxW = CW - margin * 2;
  const padX = 22;
  const padY = 16;
  const lineH = Math.round(fontSize * 1.18);

  ctx.save();
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lines = wrapCaption(ctx, text, boxW - padX * 2, 2);
  if (lines.length === 0) { ctx.restore(); return; }

  const boxH = lineH * lines.length + padY * 2;
  // y 시작점: 캔버스 하단 92% 앵커에 박스 하단 맞춤 → 박스 위쪽 = 92% - boxH
  const anchorY = Math.round(CH * 0.92);
  const boxY = Math.max(Math.round(CH * 0.72), anchorY - boxH);

  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  // 좌측 accent strip
  ctx.fillStyle = accent;
  ctx.fillRect(boxX, boxY, 6, boxH);

  // 텍스트
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], boxX + padX, boxY + padY + i * lineH);
  }
  ctx.restore();
}

/**
 * 우측 상단 판정 토스트. opts.at 로부터 durationMs 지나면 아무것도 안 그림.
 */
export function drawJudgementToast(ctx: Ctx2D, opts: JudgementToastOpts): void {
  const now = opts.now ?? performance.now();
  const dur = opts.durationMs ?? 800;
  const age = now - opts.at;
  if (age < 0 || age > dur) return;

  // 알파: 0~0.2 페이드인 0→1, 0.2~0.7 유지, 0.7~1.0 페이드아웃 1→0
  const t = age / dur;
  let alpha: number;
  if (t < 0.2)      alpha = t / 0.2;
  else if (t < 0.7) alpha = 1;
  else              alpha = (1 - t) / 0.3;
  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) return;

  const color = TIER_COLORS[opts.tier];
  const label = TIER_LABELS[opts.tier];
  const CW = opts.canvasW;

  ctx.save();
  ctx.font = 'bold 72px system-ui, -apple-system, "Noto Sans KR", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const textW = ctx.measureText(label).width;
  const padX = 22, padY = 14;
  const boxW = textW + padX * 2;
  const boxH = 72 + padY * 2;
  const boxX = CW - 16 - boxW;
  const boxY = 16;

  // scale-up 느낌: 초기 0.2 구간에 살짝 커지며 등장
  const scale = t < 0.2 ? 0.85 + 0.15 * (t / 0.2) : 1;

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  // 좌측 accent strip
  ctx.fillRect(boxX, boxY, 6, boxH);
  // 텍스트 (중앙 정렬을 위해 textAlign right 유지, x = 박스 우측에서 padX 안쪽)
  ctx.font = `bold ${Math.round(72 * scale)}px system-ui, -apple-system, "Noto Sans KR", sans-serif`;
  ctx.fillText(label, boxX + boxW - padX, boxY + padY + (72 - 72 * scale) / 2);
  ctx.restore();
}

/**
 * 캔버스 중앙 "+1" 스쿼트 카운트 팝업. 500ms.
 */
export function drawSquatPlusOne(
  ctx: Ctx2D,
  opts: { canvasW: number; canvasH: number; at: number; now?: number; durationMs?: number; color?: string },
): void {
  const now = opts.now ?? performance.now();
  const dur = opts.durationMs ?? 500;
  const age = now - opts.at;
  if (age < 0 || age > dur) return;
  const t = age / dur;
  const alpha = t < 0.25 ? t / 0.25 : (1 - t) / 0.75;
  const scale = 1 + t * 0.8;
  const color = opts.color ?? '#39FF7D';

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(120 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+1', opts.canvasW / 2, opts.canvasH / 2 - 80);
  ctx.restore();
}

/**
 * 마이크 권한 필요 빨간 배너. 캔버스 하단 (자막 박스 위) 3초 표시.
 */
export function drawMicPermissionBanner(
  ctx: Ctx2D,
  opts: { canvasW: number; canvasH: number; at: number; now?: number; durationMs?: number },
): void {
  const now = opts.now ?? performance.now();
  const dur = opts.durationMs ?? 3000;
  const age = now - opts.at;
  if (age < 0 || age > dur) return;
  const t = age / dur;
  const alpha = t > 0.85 ? (1 - t) / 0.15 : 1;

  const CW = opts.canvasW;
  const CH = opts.canvasH;
  const boxX = 16, boxW = CW - 32;
  const boxH = 100;
  const boxY = Math.round(CH * 0.58);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = '#FF3B3B';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, -apple-system, "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('마이크 권한 필요', CW / 2, boxY + 36);
  ctx.font = 'bold 22px system-ui, -apple-system, "Noto Sans KR", sans-serif';
  ctx.fillText('주소창 🔒 → 마이크 허용', CW / 2, boxY + 72);
  ctx.restore();
}
