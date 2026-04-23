/**
 * utils/inviteShareCard.ts
 *
 * **초대 썸네일 카드 PNG 생성기.**
 *
 * 카카오톡·라인 같은 네이티브 메신저는 `navigator.share({ files: [pngBlob], ... })`
 * 로 공유된 PNG 첨부를 **자동으로 카드 미리보기**로 렌더한다. 긴 URL 텍스트 대신
 * 이미지 카드로 보내면 수신자 입장에서 훨씬 명확하고 탭도 자연스럽다.
 *
 * 이 모듈은 DOM Canvas 를 이용해:
 *   1) 템플릿 썸네일 이미지를 **crossOrigin='anonymous'** 로 로드
 *   2) 1200x628 (OG 표준) 캔버스에 썸네일 + 어두운 그라디언트 + 두 줄 헤드라인 그리기
 *   3) `canvas.toBlob('image/png')` 로 Blob 반환
 *
 * 모두 클라이언트-사이드. 서버 전송·업로드 없음 (CLAUDE.md §12).
 * CORS 실패 시(일부 Unsplash/Pixabay 캐시 히트 전) null 반환 → 호출자가 텍스트 폴백.
 */

export interface ShareCardOpts {
  thumbnailUrl: string;
  headline: string;           // 1줄 헤드라인, 예: "지민이 도전장을 보냈어요!"
  subline: string;            // 2줄째, 예: "스쿼트 마스터 · 87점"
  brand?: string;             // 좌상단 브랜드 워터마크, 기본 "MotiQ 챌린지"
  width?: number;
  height?: number;
}

/**
 * 썸네일 이미지를 CORS-safe 하게 로드. 실패 시 null.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * PNG Blob 생성. 실패 시 null.
 * 호출 측 예:
 *   const blob = await generateInviteShareCard({ thumbnailUrl, headline, subline });
 *   if (blob) { const file = new File([blob], 'invite.png', { type: 'image/png' });
 *               await navigator.share({ files: [file], text, url }); }
 */
export async function generateInviteShareCard(opts: ShareCardOpts): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = opts.width  ?? 1200;
  const H = opts.height ?? 628;
  const brand = opts.brand ?? 'MotiQ 챌린지';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 배경 — 항상 먼저 채움(썸네일 로드 실패 시 폴백).
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#1B0B2E');
  bgGrad.addColorStop(1, '#050509');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 썸네일 로드 (실패해도 카드는 나감)
  const img = await loadImage(opts.thumbnailUrl);
  if (img) {
    // cover fit
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    try {
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {
      // tainted canvas: 계속 진행, 배경만 사용
    }

    // 하단 dark overlay
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0.0, 'rgba(5,5,9,0.1)');
    overlay.addColorStop(0.55, 'rgba(5,5,9,0.55)');
    overlay.addColorStop(1.0, 'rgba(5,5,9,0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  }

  // 상단 브랜드 배지
  ctx.font = '600 22px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.textBaseline = 'top';
  const brandPadX = 18;
  const brandPadY = 10;
  const brandW = ctx.measureText(brand).width + brandPadX * 2;
  ctx.fillStyle = 'rgba(236,72,153,0.92)';
  roundRect(ctx, 48, 48, brandW, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(brand, 48 + brandPadX, 48 + brandPadY + 2);

  // 헤드라인 (2줄까지 자동 줄바꿈)
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.textBaseline = 'alphabetic';
  const maxW = W - 96;
  const lines = wrapLines(ctx, opts.headline, maxW, 2);
  let y = H - 180;
  for (const line of lines) {
    ctx.fillText(line, 48, y);
    y += 66;
  }

  // 서브라인
  ctx.font = '500 28px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(opts.subline, 48, H - 60);

  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.92);
    } catch {
      resolve(null);
    }
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  // 한국어는 공백 드물 → 우선 공백 분할, 안되면 문자 분할
  const tokens = text.split(/(\s+)/);
  const lines: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    const trial = cur + tok;
    if (ctx.measureText(trial).width > maxW && cur.trim()) {
      lines.push(cur.trimEnd());
      cur = tok.trimStart();
      if (lines.length >= maxLines) break;
    } else {
      cur = trial;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur.trimEnd());
  // 문자 단위 fallback
  if (lines.length === 0) {
    let buf = '';
    for (const ch of text) {
      if (ctx.measureText(buf + ch).width > maxW) {
        lines.push(buf);
        buf = ch;
        if (lines.length >= maxLines) return lines;
      } else {
        buf += ch;
      }
    }
    if (buf && lines.length < maxLines) lines.push(buf);
  }
  // 마지막 줄 말줄임
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxW) {
      last = last.slice(0, -1);
    }
    // 원본보다 짧아졌다면 말줄임 부착
    const joined = lines.slice(0, -1).join(' ') + (lines.length > 1 ? ' ' : '') + last;
    if (joined.length < text.length) lines[maxLines - 1] = last + '…';
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Web Share API 가 파일 포함 공유를 지원하는지 사전 체크.
 * 호출자는 이 결과에 따라 카드 생성 여부를 결정한다.
 */
export function canShareInviteCard(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as any;
  if (typeof nav.share !== 'function') return false;
  if (typeof nav.canShare !== 'function') return false;
  if (typeof File !== 'function') return false;
  try {
    const probe = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'p.png', { type: 'image/png' });
    return !!nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
