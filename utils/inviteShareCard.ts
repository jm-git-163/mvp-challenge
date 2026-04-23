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
  /**
   * 카드 하단에 **눈으로 보이게** 박아넣을 짧은 display URL.
   * FIX-INVITE-KAKAO-PNG (2026-04-23): 카카오톡/라인이 `navigator.share` 의
   * url/text 를 드롭해도 수신자가 이 문자열을 보고 직접 입력/복사할 수 있게 함.
   * 예: "motiq.app/challenge/squat-master?c=eyJmI…"
   */
  displayUrl?: string;
  width?: number;
  height?: number;
}

/**
 * 썸네일 이미지를 CORS-safe 하게 로드. 실패 시 null.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  // DEBUG-INVITE-2026-04-23: 3s timeout — Unsplash/Supabase 가 cold-cache 나
  //   네트워크 지연일 때 onload/onerror 둘 다 안 불려 공유가 영원히 hang 되는
  //   사례 보고. 3초 안에 못 받으면 null 반환 → 호출자가 그라디언트-only 카드로 진행.
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: HTMLImageElement | null) => { if (done) return; done = true; resolve(v); };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 3000);
    try { img.src = url; } catch { finish(null); }
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

  // URL strip (있을 때만) — 카드 최하단. 카카오톡/라인이 메타데이터를 드롭해도
  // 수신자가 이 주소를 보고 브라우저에 입력/복사할 수 있다.
  const urlStripH = opts.displayUrl ? 96 : 0;
  const contentBottom = H - urlStripH;

  // 헤드라인 (2줄까지 자동 줄바꿈) — URL strip 위로 끌어올림
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.textBaseline = 'alphabetic';
  const maxW = W - 96;
  const lines = wrapLines(ctx, opts.headline, maxW, 2);
  // 서브라인 기준점: contentBottom - 24, 그 위로 헤드라인
  const sublineY = contentBottom - 24;
  let headY = sublineY - 60 - (lines.length - 1) * 66;
  for (const line of lines) {
    ctx.fillText(line, 48, headY);
    headY += 66;
  }

  // 서브라인
  ctx.font = '500 28px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(opts.subline, 48, sublineY);

  // URL strip (bottom) — 다크 필드 + 핫핑크 hint + 모노스페이스 URL
  if (opts.displayUrl && urlStripH > 0) {
    const stripY = contentBottom;
    ctx.fillStyle = 'rgba(5,5,9,0.96)';
    ctx.fillRect(0, stripY, W, urlStripH);
    // 상단 hairline (핫핑크 accent)
    ctx.fillStyle = 'rgba(236,72,153,0.9)';
    ctx.fillRect(0, stripY, W, 2);

    // "탭해서 열기 →" hint
    ctx.fillStyle = 'rgba(236,72,153,0.95)';
    ctx.font = '700 18px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('탭해서 열기 →', 48, stripY + 14);

    // URL (monospace) — 길면 말줄임
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 22px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
    let urlText = opts.displayUrl;
    while (urlText.length > 0 && ctx.measureText(urlText).width > W - 96) {
      urlText = urlText.slice(0, -2) + '…';
    }
    ctx.fillText(urlText, 48, stripY + 44);
  }

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
 * FIX-INVITE-KAKAO (2026-04-23): 카카오톡/라인/인스타 in-app 브라우저는 `navigator.share`
 *   가 존재해도 다이얼로그를 호출하는 순간 URL 을 가로채거나 조용히 AbortError 를 던져
 *   공유가 실패한다. UA 기반으로 감지해 클립보드+다운로드 폴백으로 강제 전환.
 */
export function isInAppBrowserWithBrokenShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();
  return (
    ua.includes('kakaotalk')
    || ua.includes('naver(inapp')
    || ua.includes('fb_iab')
    || ua.includes('fbav')
    || ua.includes('instagram')
    || ua.includes('line/')
  );
}

/**
 * Web Share API 가 파일 포함 공유를 지원하는지 사전 체크.
 * 호출자는 이 결과에 따라 카드 생성 여부를 결정한다.
 */
export function canShareInviteCard(): boolean {
  if (typeof navigator === 'undefined') return false;
  // in-app 브라우저는 share API 가 있어도 동작하지 않음 → 사전 차단.
  if (isInAppBrowserWithBrokenShare()) return false;
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
