// utils/videoCompositor.ts
// Real-time canvas compositor — 720×1280, 15 fps via requestAnimationFrame.
// The template is a PRE-MADE VIDEO SHELL; the user clip is one ingredient.

import {
  VideoTemplate,
  TextOverlay,
  TemplateZone,
  BgmSpec,
  ClipArea,
} from './videoTemplates';
import type { Template as LayeredTemplate, BaseLayer } from '../engine/templates/schema';
import { pickRecordingMimeType } from '../engine/recording/codecNegotiator';
import { dispatchLayer } from '../engine/composition/layers';
import { applyTemplatePostProcess } from '../engine/composition/postProcessHook';
import { mergeLiveIntoState } from '../engine/composition/liveState';
import {
  drawFilmGrain,
  drawLightLeak,
  drawBeatFlash,
  drawLetterbox,
  computeKineticReveal,
  drawKineticText,
  drawTealOrangeGrade,
} from './cinematicEffects';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RecordedClip {
  slot_id: string;
  blob: Blob;
  duration_ms: number;
}

export interface CompositorProgress {
  phase: string;
  percent: number;
}

// ---------------------------------------------------------------------------
// Canvas dimensions
// ---------------------------------------------------------------------------

const W = 720;
const H = 1280;
const FPS = 15;
const FRAME_MS = 1000 / FPS;
const INTRO_MS = 5000;   // 5-second pre-made intro animation (countdown + branding) — Cycle 9 pacing
const OUTRO_MS = 3000;   // 3-second outro celebration (trophy + hashtags)

// ---------------------------------------------------------------------------
// Helper: rounded-rect path (no roundRect API dependency)
// ---------------------------------------------------------------------------

function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.lineTo(x + w - safeR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
  ctx.lineTo(x + w, y + h - safeR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
  ctx.lineTo(x + safeR, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
  ctx.lineTo(x, y + safeR);
  ctx.quadraticCurveTo(x, y, x + safeR, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Scene background drawers
// ---------------------------------------------------------------------------

// FIX-Z15 (2026-04-22): 범용 시네마틱 액센트 레이어.
//   모든 legacy 템플릿의 main 구간 위에 비트 싱크 펄스·상승 입자·가장자리
//   글로우·순간 플래시를 얹어 "여러 겹 레이어" 느낌을 보강.
function drawCinematicAccents(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localMs: number,
  accentColor: string,
  bpm: number,
): void {
  const beatPeriod = 60_000 / Math.max(40, Math.min(200, bpm));
  const beatPhase = (localMs % beatPeriod) / beatPeriod; // 0..1
  const beatPulse = Math.pow(1 - beatPhase, 2.2);        // 비트 직후 강, 감쇠

  // 1) 가장자리 비트 플래시 (상·하 그라디언트 바)
  ctx.save();
  const flashH = 140;
  const flashAlpha = 0.15 + beatPulse * 0.28;
  const gTop = ctx.createLinearGradient(0, 0, 0, flashH);
  gTop.addColorStop(0, accentColor + Math.round(flashAlpha * 255).toString(16).padStart(2, '0'));
  gTop.addColorStop(1, accentColor + '00');
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, W, flashH);
  const gBot = ctx.createLinearGradient(0, H - flashH, 0, H);
  gBot.addColorStop(0, accentColor + '00');
  gBot.addColorStop(1, accentColor + Math.round(flashAlpha * 255).toString(16).padStart(2, '0'));
  ctx.fillStyle = gBot;
  ctx.fillRect(0, H - flashH, W, flashH);
  ctx.restore();

  // 2) 상승 입자 (16개) — 바닥에서 위로 천천히 부상, beat 마다 새 입자 유발
  ctx.save();
  const N = 16;
  for (let i = 0; i < N; i++) {
    const seed = i * 97.31;
    const life = ((localMs * 0.00035) + i / N) % 1; // 0..1
    const x = ((Math.sin(seed) * 0.5 + 0.5) * W);
    const y = H - life * H * 1.05;
    const r = 2 + ((Math.sin(seed * 3.7) + 1) / 2) * 4;
    const a = (1 - life) * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // 입자 글로우
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, accentColor + Math.round(a * 140).toString(16).padStart(2, '0'));
    g.addColorStop(1, accentColor + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3) 코너 글로우 (좌상·우하) — 비트에 맞춰 밝기 변화
  ctx.save();
  const cornerR = Math.max(W, H) * 0.5;
  const cornerAlpha = 0.14 + beatPulse * 0.10;
  const gCornerA = ctx.createRadialGradient(0, 0, 0, 0, 0, cornerR);
  gCornerA.addColorStop(0, accentColor + Math.round(cornerAlpha * 255).toString(16).padStart(2, '0'));
  gCornerA.addColorStop(1, accentColor + '00');
  ctx.fillStyle = gCornerA;
  ctx.fillRect(0, 0, W, H);
  const gCornerB = ctx.createRadialGradient(W, H, 0, W, H, cornerR);
  gCornerB.addColorStop(0, accentColor + Math.round(cornerAlpha * 255).toString(16).padStart(2, '0'));
  gCornerB.addColorStop(1, accentColor + '00');
  ctx.fillStyle = gCornerB;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 4) 매 4박자마다 화이트 플래시 (매우 짧게)
  const bar = Math.floor(localMs / (beatPeriod * 4));
  const barLocal = (localMs - bar * beatPeriod * 4);
  if (barLocal < 120) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${(1 - barLocal / 120) * 0.18})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// FIX-Z16 (2026-04-22): 장르별 팔레트 · 스티커 · 오디오 바 · 프레이밍 마스크
//   메인 렌더 섹션 (non-layered) 이 거의 같은 레이아웃으로 보이는 문제를 해결.
//   후반 컴포지터 단독 수정, 녹화 경로 영향 없음.
// ---------------------------------------------------------------------------

type GenrePalette = {
  main: string;
  accent: string;
  bgA: string;
  bgB: string;
  direction: 'diag' | 'vert' | 'horiz';
  textFontSize: number;      // 기본 자막 보정 계수(px 추가분)
  textWeightBoost: boolean;  // 굵게 강조
};

function getGenrePalette(bgStyle: string): GenrePalette {
  switch (bgStyle) {
    case 'kpop':
      return { main: '#FF2E93', accent: '#8A2BE2', bgA: '#2A0B3A', bgB: '#FF2E93', direction: 'diag', textFontSize: 4, textWeightBoost: true };
    case 'fitness':
      return { main: '#FF5A1F', accent: '#FFD400', bgA: '#2A0A00', bgB: '#FF5A1F', direction: 'vert', textFontSize: 2, textWeightBoost: true };
    case 'news':
      return { main: '#1E3A8A', accent: '#F8FAFC', bgA: '#0B1E4A', bgB: '#E2E8F0', direction: 'horiz', textFontSize: 0, textWeightBoost: true };
    case 'vlog': // lofi
      return { main: '#C9A27A', accent: '#8B5E3C', bgA: '#2B1F14', bgB: '#C9A27A', direction: 'diag', textFontSize: -2, textWeightBoost: false };
    case 'travel':
      return { main: '#38BDF8', accent: '#FDE68A', bgA: '#0C2B4A', bgB: '#38BDF8', direction: 'diag', textFontSize: 0, textWeightBoost: false };
    case 'hiphop':
      return { main: '#F5C518', accent: '#111111', bgA: '#0A0A0A', bgB: '#8A6A00', direction: 'diag', textFontSize: 3, textWeightBoost: true };
    case 'fairy':
      return { main: '#D6A8FF', accent: '#FFB6E1', bgA: '#3A1F5A', bgB: '#FFB6E1', direction: 'diag', textFontSize: 0, textWeightBoost: false };
    case 'english':
      return { main: '#60A5FA', accent: '#FCD34D', bgA: '#0F2A55', bgB: '#60A5FA', direction: 'vert', textFontSize: 0, textWeightBoost: true };
    default:
      return { main: '#FFFFFF', accent: '#888888', bgA: '#111', bgB: '#333', direction: 'vert', textFontSize: 0, textWeightBoost: false };
  }
}

function drawGenreBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localMs: number,
  pal: GenrePalette,
): void {
  let x0 = 0, y0 = 0, x1 = 0, y1 = H;
  if (pal.direction === 'diag') { x1 = W; y1 = H; }
  else if (pal.direction === 'horiz') { x1 = W; y1 = 0; }
  const drift = Math.sin(localMs * 0.00025) * 20;
  const g = ctx.createLinearGradient(x0, y0 + drift, x1, y1 - drift);
  g.addColorStop(0, pal.bgA);
  g.addColorStop(1, pal.bgB);
  ctx.save();
  ctx.globalAlpha = 0.45;  // 기존 gradientColors 위에 은은하게 덧댐
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// 이미지 스티커 로더 (없으면 null, 조용히 폴백)
const stickerCache: Map<string, HTMLImageElement | null> = new Map();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (stickerCache.has(url)) return Promise.resolve(stickerCache.get(url)!);
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { stickerCache.set(url, null); resolve(null); return; }
    const img = new Image();
    img.onload = () => { stickerCache.set(url, img); resolve(img); };
    img.onerror = () => { stickerCache.set(url, null); resolve(null); };
    try { img.src = url; } catch { stickerCache.set(url, null); resolve(null); }
  });
}

// 장르별 스티커 정의 (이모지 폴백 사용 — 실제 PNG 없을 때)
type StickerSpec = { emoji: string; xPct: number; yPct: number; size: number; mode: 'pulse' | 'drift' | 'sparkle' | 'tick' };
function getGenreStickers(bgStyle: string): StickerSpec[] {
  switch (bgStyle) {
    case 'kpop':
      return [
        { emoji: '💫', xPct: 0.08, yPct: 0.08, size: 56, mode: 'pulse' },
        { emoji: '⭐', xPct: 0.92, yPct: 0.08, size: 52, mode: 'pulse' },
        { emoji: '✨', xPct: 0.08, yPct: 0.92, size: 54, mode: 'pulse' },
        { emoji: '🔥', xPct: 0.92, yPct: 0.92, size: 56, mode: 'pulse' },
      ];
    case 'fitness':
      return [
        { emoji: '🔥', xPct: 0.08, yPct: 0.10, size: 60, mode: 'pulse' },
        { emoji: '💪', xPct: 0.92, yPct: 0.10, size: 58, mode: 'pulse' },
        { emoji: '⚡', xPct: 0.50, yPct: 0.06, size: 54, mode: 'sparkle' },
      ];
    case 'news':
      return [
        { emoji: '🔴 LIVE', xPct: 0.12, yPct: 0.93, size: 28, mode: 'tick' },
        { emoji: '🕒', xPct: 0.90, yPct: 0.93, size: 40, mode: 'tick' },
      ];
    case 'vlog': // lofi
      return [
        { emoji: '☁️', xPct: 0.88, yPct: 0.10, size: 50, mode: 'drift' },
        { emoji: '✨', xPct: 0.82, yPct: 0.18, size: 28, mode: 'sparkle' },
      ];
    case 'travel':
      return [
        { emoji: '✈️', xPct: 0.88, yPct: 0.12, size: 48, mode: 'drift' },
        { emoji: '🌴', xPct: 0.10, yPct: 0.92, size: 54, mode: 'drift' },
        { emoji: '☀️', xPct: 0.90, yPct: 0.90, size: 46, mode: 'sparkle' },
      ];
    case 'hiphop':
      return [
        { emoji: '💰', xPct: 0.08, yPct: 0.10, size: 58, mode: 'pulse' },
        { emoji: '🎤', xPct: 0.92, yPct: 0.10, size: 56, mode: 'pulse' },
        { emoji: '💎', xPct: 0.50, yPct: 0.08, size: 48, mode: 'sparkle' },
      ];
    case 'fairy':
      return [
        { emoji: '✨', xPct: 0.12, yPct: 0.15, size: 36, mode: 'sparkle' },
        { emoji: '🌸', xPct: 0.86, yPct: 0.20, size: 44, mode: 'drift' },
        { emoji: '⭐', xPct: 0.20, yPct: 0.80, size: 30, mode: 'sparkle' },
        { emoji: '💖', xPct: 0.82, yPct: 0.82, size: 40, mode: 'drift' },
        { emoji: '✨', xPct: 0.50, yPct: 0.50, size: 24, mode: 'sparkle' },
      ];
    case 'english':
      return [
        { emoji: '📚', xPct: 0.10, yPct: 0.10, size: 50, mode: 'pulse' },
        { emoji: '🌟', xPct: 0.90, yPct: 0.10, size: 44, mode: 'sparkle' },
      ];
    default:
      return [];
  }
}

function drawStickers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localMs: number,
  bgStyle: string,
  bpm: number,
): void {
  const specs = getGenreStickers(bgStyle);
  if (specs.length === 0) return;
  const beatPeriod = 60_000 / Math.max(40, Math.min(200, bpm));
  const beatPhase = (localMs % beatPeriod) / beatPeriod;
  const beatPulse = Math.pow(1 - beatPhase, 2.0);
  ctx.save();
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const baseX = s.xPct * W;
    const baseY = s.yPct * H;
    let scale = 1, rot = 0, alpha = 1, dx = 0, dy = 0;
    switch (s.mode) {
      case 'pulse': {
        scale = 1 + beatPulse * 0.35;
        rot = Math.sin(localMs * 0.003 + i) * 0.08;
        break;
      }
      case 'sparkle': {
        const phase = (localMs * 0.002 + i * 0.7) % 1;
        alpha = 0.3 + Math.abs(Math.sin(phase * Math.PI * 2)) * 0.7;
        scale = 0.85 + Math.sin(localMs * 0.004 + i) * 0.2;
        break;
      }
      case 'drift': {
        dx = Math.sin(localMs * 0.0006 + i * 1.3) * 18;
        dy = Math.cos(localMs * 0.0005 + i * 0.9) * 10;
        alpha = 0.75 + Math.sin(localMs * 0.001 + i) * 0.2;
        break;
      }
      case 'tick': {
        // 초 단위 깜박임
        const secPhase = (localMs % 1000) / 1000;
        alpha = secPhase < 0.5 ? 1 : 0.6;
        break;
      }
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(baseX + dx, baseY + dy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.font = `bold ${s.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.fillText(s.emoji, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// 오디오 비주얼라이저 (BPM 기반 사인 파 + 빠른 감쇠, fake 진폭)
function drawAudioBars(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localMs: number,
  pal: GenrePalette,
  bpm: number,
): void {
  const BAR_COUNT = 14;
  const beatPeriod = 60_000 / Math.max(40, Math.min(200, bpm));
  const beatPhase = (localMs % beatPeriod) / beatPeriod;
  const beatPulse = Math.pow(1 - beatPhase, 2.0);
  const barsAreaH = 80;
  const barsY = H - 170;  // 해시태그 스트립 위
  const gap = 6;
  const totalGap = gap * (BAR_COUNT - 1);
  const areaW = W * 0.55;
  const barW = (areaW - totalGap) / BAR_COUNT;
  const startX = (W - areaW) / 2;
  ctx.save();
  for (let i = 0; i < BAR_COUNT; i++) {
    const seed = i * 11.37;
    const wave = 0.4 + 0.6 * Math.abs(Math.sin(localMs * 0.006 + seed));
    const perBar = Math.abs(Math.sin(seed + i * 0.4));
    const h = Math.max(6, barsAreaH * wave * (0.5 + perBar * 0.5) * (0.7 + beatPulse * 0.5));
    const x = startX + i * (barW + gap);
    const y = barsY + (barsAreaH - h);
    // 바 본체 그라디언트
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, pal.accent);
    g.addColorStop(1, pal.main);
    ctx.fillStyle = g;
    rrPath(ctx, x, y, barW, h, Math.min(barW / 2, 4));
    ctx.fill();
    // 상단 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rrPath(ctx, x, y, barW, Math.min(4, h / 3), Math.min(barW / 2, 4));
    ctx.fill();
  }
  ctx.restore();
}

// 장르별 프레이밍: 클립 영역에 추가 마스크 적용
function applyGenreFraming(
  ctx: CanvasRenderingContext2D,
  bgStyle: string,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  borderRadius: number,
): boolean {
  // 반환: true 면 이 함수에서 clip 적용했음 (호출측은 rrPath/clip 스킵)
  switch (bgStyle) {
    case 'kpop':
    case 'fitness': {
      // 중앙 원형 마스크 (clip 영역 내)
      const r = Math.min(cw, ch) / 2;
      const midX = cx + cw / 2;
      const midY = cy + ch / 2;
      ctx.beginPath();
      ctx.ellipse(midX, midY, r, r, 0, 0, Math.PI * 2);
      ctx.clip();
      return true;
    }
    case 'fairy': {
      // 하트 마스크
      const midX = cx + cw / 2;
      const midY = cy + ch / 2;
      const size = Math.min(cw, ch) * 0.95;
      const s = size / 2;
      ctx.beginPath();
      ctx.moveTo(midX, midY + s * 0.6);
      ctx.bezierCurveTo(midX + s * 1.2, midY - s * 0.1, midX + s * 0.5, midY - s, midX, midY - s * 0.35);
      ctx.bezierCurveTo(midX - s * 0.5, midY - s, midX - s * 1.2, midY - s * 0.1, midX, midY + s * 0.6);
      ctx.closePath();
      ctx.clip();
      return true;
    }
    case 'vlog': {
      // 둥근 사각 (더 큰 반경)
      rrPath(ctx, cx, cy, cw, ch, Math.max(borderRadius, 48));
      ctx.clip();
      return true;
    }
    default:
      return false;
  }
}

// 뉴스 템플릿용 우측 "속보" 텍스트 스트림
function drawNewsBreakingStrip(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localMs: number,
  pal: GenrePalette,
): void {
  const stripW = W * 0.28;
  const stripX = W - stripW;
  const stripY = H * 0.22;
  const stripH = H * 0.5;
  ctx.save();
  ctx.fillStyle = 'rgba(11,30,74,0.75)';
  rrPath(ctx, stripX + 8, stripY, stripW - 16, stripH, 10);
  ctx.fill();
  ctx.strokeStyle = pal.accent + 'aa';
  ctx.lineWidth = 2;
  rrPath(ctx, stripX + 8, stripY, stripW - 16, stripH, 10);
  ctx.stroke();
  // 헤드라인 롤링
  const lines = ['속보', '실시간 현장', '주요 뉴스', '단독 입수', '긴급'];
  const scroll = (localMs * 0.04) % (lines.length * 60);
  ctx.font = 'bold 20px "Pretendard Variable",system-ui,sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    const yy = stripY + 40 + i * 60 - scroll + lines.length * 60;
    const wrappedY = ((yy - stripY) % (lines.length * 60)) + stripY;
    if (wrappedY > stripY + 10 && wrappedY < stripY + stripH - 10) {
      ctx.fillText(lines[i], stripX + stripW / 2, wrappedY);
    }
  }
  ctx.restore();
}

function drawVlogScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Multi-layer bokeh circles
  const bokehData = [
    { x: 0.15, y: 0.12, r: 80, alpha: 0.10 },
    { x: 0.85, y: 0.08, r: 60, alpha: 0.08 },
    { x: 0.05, y: 0.45, r: 100, alpha: 0.07 },
    { x: 0.92, y: 0.55, r: 90, alpha: 0.09 },
    { x: 0.30, y: 0.90, r: 120, alpha: 0.08 },
    { x: 0.70, y: 0.88, r: 70, alpha: 0.10 },
    { x: 0.50, y: 0.05, r: 50, alpha: 0.12 },
    { x: 0.20, y: 0.70, r: 85, alpha: 0.07 },
    { x: 0.78, y: 0.30, r: 65, alpha: 0.09 },
    { x: 0.45, y: 0.60, r: 55, alpha: 0.08 },
    { x: 0.60, y: 0.20, r: 75, alpha: 0.10 },
    { x: 0.10, y: 0.85, r: 95, alpha: 0.07 },
    { x: 0.88, y: 0.75, r: 45, alpha: 0.12 },
    { x: 0.35, y: 0.35, r: 110, alpha: 0.06 },
    { x: 0.65, y: 0.65, r: 88, alpha: 0.08 },
    { x: 0.25, y: 0.55, r: 60, alpha: 0.11 },
    { x: 0.75, y: 0.50, r: 70, alpha: 0.09 },
    { x: 0.50, y: 0.80, r: 100, alpha: 0.07 },
    { x: 0.12, y: 0.25, r: 55, alpha: 0.13 },
    { x: 0.90, y: 0.40, r: 80, alpha: 0.08 },
  ];

  for (let i = 0; i < bokehData.length; i++) {
    const b = bokehData[i];
    const ox = Math.sin(elapsed * 0.0003 + i * 0.7) * 12;
    const oy = Math.cos(elapsed * 0.0004 + i * 0.5) * 10;
    const cx = b.x * canvasW + ox;
    const cy = b.y * canvasH + oy;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
    grad.addColorStop(0, `rgba(200,180,255,${b.alpha + 0.04})`);
    grad.addColorStop(1, 'rgba(200,180,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diagonal light streaks
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const xStart = -200 + i * 150 + Math.sin(elapsed * 0.0002 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(xStart, 0);
    ctx.lineTo(xStart + canvasH * 0.6, canvasH);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNewsScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Studio floor perspective grid from bottom-center vanishing point
  ctx.save();
  ctx.strokeStyle = 'rgba(100,150,255,0.05)';
  ctx.lineWidth = 1;
  const vpX = canvasW / 2;
  const vpY = canvasH * 0.85;
  for (let i = -6; i <= 6; i++) {
    const endX = i * 80;
    ctx.beginPath();
    ctx.moveTo(vpX, vpY);
    ctx.lineTo(vpX + endX, canvasH);
    ctx.stroke();
  }
  // Horizontal floor lines
  for (let row = 0; row < 5; row++) {
    const fy = vpY + (canvasH - vpY) * (row / 5);
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(canvasW, fy);
    ctx.stroke();
  }
  ctx.restore();

  // Vertical blue light bars on sides
  const barPulse = 0.08 + Math.sin(elapsed * 0.003) * 0.04;
  ctx.fillStyle = `rgba(21,101,192,${barPulse})`;
  ctx.fillRect(0, canvasH * 0.15, 2, canvasH * 0.7);
  ctx.fillRect(canvasW - 2, canvasH * 0.15, 2, canvasH * 0.7);

  // Blue glow halos on bars
  const glowGradL = ctx.createLinearGradient(0, 0, 20, 0);
  glowGradL.addColorStop(0, `rgba(21,101,192,${barPulse * 0.8})`);
  glowGradL.addColorStop(1, 'rgba(21,101,192,0)');
  ctx.fillStyle = glowGradL;
  ctx.fillRect(0, canvasH * 0.15, 20, canvasH * 0.7);

  const glowGradR = ctx.createLinearGradient(canvasW, 0, canvasW - 20, 0);
  glowGradR.addColorStop(0, `rgba(21,101,192,${barPulse * 0.8})`);
  glowGradR.addColorStop(1, 'rgba(21,101,192,0)');
  ctx.fillStyle = glowGradR;
  ctx.fillRect(canvasW - 20, canvasH * 0.15, 20, canvasH * 0.7);

  // Scan line effect
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.02)';
  for (let y = 0; y < canvasH; y += 4) {
    ctx.fillRect(0, y, canvasW, 1);
  }
  ctx.restore();

  // Top-right network logo area
  ctx.save();
  ctx.fillStyle = 'rgba(5,15,40,0.85)';
  ctx.strokeStyle = 'rgba(21,101,192,0.5)';
  ctx.lineWidth = 1;
  const logoX = canvasW - 90;
  const logoY = 14;
  const logoW = 76;
  const logoH = 36;
  rrPath(ctx, logoX, logoY, logoW, logoH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CH NEWS', logoX + logoW / 2, logoY + 14);
  ctx.fillStyle = '#93c5fd';
  ctx.font = '9px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.fillText('24/7 LIVE', logoX + logoW / 2, logoY + 28);
  ctx.restore();
}

function drawKpopScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // City silhouette at bottom 25%
  ctx.save();
  ctx.fillStyle = 'rgba(5,0,20,0.8)';
  const buildings = [
    { x: 0, w: 60, h: 180 },
    { x: 50, w: 45, h: 240 },
    { x: 90, w: 70, h: 160 },
    { x: 155, w: 50, h: 200 },
    { x: 200, w: 80, h: 140 },
    { x: 275, w: 55, h: 220 },
    { x: 325, w: 40, h: 170 },
    { x: 360, w: 75, h: 250 },
    { x: 430, w: 50, h: 180 },
    { x: 475, w: 65, h: 130 },
    { x: 535, w: 55, h: 210 },
    { x: 585, w: 80, h: 160 },
    { x: 660, w: 60, h: 190 },
  ];
  const floorY = canvasH;
  for (const b of buildings) {
    ctx.fillRect(b.x, floorY - b.h, b.w, b.h);
  }
  ctx.restore();

  // Stage lights: cone shapes from top
  const lightColors = [
    { r: 233, g: 69, b: 96 },   // pink
    { r: 100, g: 140, b: 255 }, // blue
    { r: 255, g: 255, b: 255 }, // white
    { r: 255, g: 200, b: 0 },   // gold
    { r: 180, g: 0, b: 255 },   // purple
    { r: 0, g: 220, b: 150 },   // teal
  ];
  const lightSources = [0.1, 0.3, 0.5, 0.7, 0.85, 0.95];
  ctx.save();
  for (let i = 0; i < lightSources.length; i++) {
    const baseAngle = Math.PI / 3 + (i / lightSources.length) * Math.PI / 3;
    const sweep = Math.sin(elapsed * 0.001 + i * 1.2) * 0.3;
    const angle = baseAngle + sweep;
    const lx = lightSources[i] * canvasW;
    const ly = 0;
    const length = canvasH * 0.65;
    const ex = lx + Math.cos(angle) * length;
    const ey = ly + Math.sin(angle) * length;
    const c = lightColors[i % lightColors.length];
    const coneGrad = ctx.createLinearGradient(lx, ly, ex, ey);
    coneGrad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.18)`);
    coneGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    const perpAngle = angle + Math.PI / 2;
    const spread = length * 0.22;
    ctx.lineTo(ex + Math.cos(perpAngle) * spread, ey + Math.sin(perpAngle) * spread);
    ctx.lineTo(ex - Math.cos(perpAngle) * spread, ey - Math.sin(perpAngle) * spread);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Neon glow horizontal lines
  const glowHeights = [0.30, 0.60, 0.80];
  const glowCols = ['rgba(233,69,96,0.25)', 'rgba(100,140,255,0.20)', 'rgba(233,69,96,0.18)'];
  ctx.save();
  for (let i = 0; i < glowHeights.length; i++) {
    const gy = glowHeights[i] * canvasH;
    const pulse = Math.sin(elapsed * 0.002 + i * 2) * 0.08 + 0.15;
    ctx.shadowColor = glowCols[i];
    ctx.shadowBlur = 12;
    ctx.strokeStyle = glowCols[i].replace(/[\d.]+\)$/, `${pulse})`);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(canvasW, gy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // Falling sparkle particles
  ctx.save();
  const sparkleColors = ['#e94560', '#fbbf24', '#fff', '#a78bfa', '#60a5fa'];
  for (let i = 0; i < 15; i++) {
    const speed = 0.03 + (i % 5) * 0.015;
    const baseX = ((i * 0.137 + 0.05) % 1) * canvasW;
    const rawY = (elapsed * speed * 0.1 + i * 90) % canvasH;
    const sy = rawY;
    const sx = baseX + Math.sin(elapsed * 0.001 + i) * 18;
    const alpha = 0.5 + Math.sin(elapsed * 0.003 + i * 0.8) * 0.4;
    ctx.fillStyle = sparkleColors[i % sparkleColors.length]
      .replace(')', `, ${Math.max(0.05, alpha)})`).replace('#', 'rgba(')
      .replace('rgba(', 'rgba(')
    ;
    // Draw star shape
    const size = 3 + (i % 3);
    ctx.globalAlpha = Math.max(0.05, alpha);
    ctx.fillStyle = sparkleColors[i % sparkleColors.length];
    ctx.beginPath();
    ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.globalAlpha = Math.max(0.02, alpha * 0.3);
    ctx.fillRect(sx - 0.5, sy - size * 3, 1, size * 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawFitnessScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Animated energy bars on left & right
  const barCount = 12;
  const barW = 14;
  const maxBarH = canvasH * 0.55;
  const barSpacing = 6;

  ctx.save();
  for (let i = 0; i < barCount; i++) {
    const phase = elapsed * 0.003 + i * 0.45;
    const height = (0.4 + Math.abs(Math.sin(phase)) * 0.55) * maxBarH;
    const alpha = 0.18 + Math.abs(Math.sin(phase * 0.8)) * 0.12;
    const y = canvasH * 0.22 + (maxBarH - height) / 2;

    // Left bars
    ctx.fillStyle = `rgba(20,184,166,${alpha})`;
    ctx.fillRect(i * (barW + barSpacing), y, barW, height);

    // Right bars (mirrored)
    ctx.fillRect(canvasW - (i + 1) * (barW + barSpacing), y, barW, height);
  }
  ctx.restore();

  // Horizontal scan line (sweeping)
  const scanY = ((elapsed * 0.1) % canvasH);
  ctx.save();
  const scanGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
  scanGrad.addColorStop(0, 'rgba(20,184,166,0)');
  scanGrad.addColorStop(0.5, 'rgba(20,184,166,0.18)');
  scanGrad.addColorStop(1, 'rgba(20,184,166,0)');
  ctx.fillStyle = scanGrad;
  ctx.fillRect(0, scanY - 3, canvasW, 6);
  ctx.restore();

  // Corner bracket accents
  const bracketSize = 36;
  const bracketGap = 8;
  ctx.save();
  ctx.strokeStyle = 'rgba(20,184,166,0.5)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'square';
  // Top-left
  ctx.beginPath(); ctx.moveTo(bracketGap, bracketGap + bracketSize); ctx.lineTo(bracketGap, bracketGap); ctx.lineTo(bracketGap + bracketSize, bracketGap); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(canvasW - bracketGap - bracketSize, bracketGap); ctx.lineTo(canvasW - bracketGap, bracketGap); ctx.lineTo(canvasW - bracketGap, bracketGap + bracketSize); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(bracketGap, canvasH - bracketGap - bracketSize); ctx.lineTo(bracketGap, canvasH - bracketGap); ctx.lineTo(bracketGap + bracketSize, canvasH - bracketGap); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(canvasW - bracketGap - bracketSize, canvasH - bracketGap); ctx.lineTo(canvasW - bracketGap, canvasH - bracketGap); ctx.lineTo(canvasW - bracketGap, canvasH - bracketGap - bracketSize); ctx.stroke();
  ctx.restore();

  // Pulsing center circle (heartbeat vibe)
  const pulse = 0.3 + Math.abs(Math.sin(elapsed * 0.004)) * 0.3;
  ctx.save();
  ctx.globalAlpha = pulse * 0.15;
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  for (let r = 60; r <= 180; r += 60) {
    ctx.beginPath();
    ctx.arc(canvasW / 2, canvasH / 2, r * (1 + pulse * 0.15), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTravelScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Dusk / sunrise gradient overlay
  const sunY = canvasH * 0.75 + Math.sin(elapsed * 0.0005) * 20;
  const sunGrad = ctx.createRadialGradient(canvasW / 2, sunY, 0, canvasW / 2, sunY, canvasH * 0.6);
  sunGrad.addColorStop(0,   'rgba(249,115,22,0.25)');
  sunGrad.addColorStop(0.4, 'rgba(234,88,12,0.10)');
  sunGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Silhouette mountains
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(0, canvasH);
  ctx.lineTo(0, canvasH * 0.72);
  ctx.lineTo(canvasW * 0.12, canvasH * 0.55);
  ctx.lineTo(canvasW * 0.22, canvasH * 0.67);
  ctx.lineTo(canvasW * 0.35, canvasH * 0.48);
  ctx.lineTo(canvasW * 0.48, canvasH * 0.62);
  ctx.lineTo(canvasW * 0.60, canvasH * 0.52);
  ctx.lineTo(canvasW * 0.72, canvasH * 0.66);
  ctx.lineTo(canvasW * 0.85, canvasH * 0.54);
  ctx.lineTo(canvasW * 0.95, canvasH * 0.65);
  ctx.lineTo(canvasW, canvasH * 0.70);
  ctx.lineTo(canvasW, canvasH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Stars / floating lights
  ctx.save();
  for (let i = 0; i < 20; i++) {
    const sx = ((i * 0.137 + 0.04) % 1) * canvasW;
    const sy = ((i * 0.0731 + 0.02) % 0.45) * canvasH;
    const twinkle = 0.3 + Math.abs(Math.sin(elapsed * 0.003 + i * 1.1)) * 0.6;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5 + (i % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Subtle latitude/longitude grid
  ctx.save();
  ctx.strokeStyle = 'rgba(249,115,22,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, (i / 5) * canvasH); ctx.lineTo(canvasW, (i / 5) * canvasH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((i / 5) * canvasW, 0); ctx.lineTo((i / 5) * canvasW, canvasH); ctx.stroke();
  }
  ctx.restore();

  // Floating airplane icon (emoji)
  const planeX = ((elapsed * 0.04) % (canvasW + 60)) - 30;
  const planeY = canvasH * 0.10 + Math.sin(elapsed * 0.001) * 8;
  ctx.save();
  ctx.font = '22px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('✈️', planeX, planeY);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHiphopScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Gold sound wave at center
  const waveY = canvasH * 0.5;
  const wavePoints = 80;
  ctx.save();
  ctx.strokeStyle = 'rgba(247,183,49,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= wavePoints; i++) {
    const x = (i / wavePoints) * canvasW;
    const amplitude = 30 + Math.sin(elapsed * 0.003 + i * 0.3) * 20;
    const y = waveY + Math.sin(i * 0.25 + elapsed * 0.005) * amplitude;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Vertical graffiti-style lines
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const x = (i / 5) * canvasW;
    const alpha = 0.04 + Math.sin(elapsed * 0.002 + i) * 0.02;
    ctx.strokeStyle = `rgba(247,183,49,${Math.max(0.02, alpha)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, canvasH);
    ctx.stroke();
  }
  ctx.restore();

  // Pulsing gold dot grid
  ctx.save();
  const dotAlpha = 0.07 + Math.sin(elapsed * 0.004) * 0.03;
  ctx.fillStyle = `rgba(247,183,49,${dotAlpha})`;
  for (let gx = 30; gx < canvasW; gx += 60) {
    for (let gy = 80; gy < canvasH - 60; gy += 60) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Corner "tags" — urban graffiti feel
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = 'rgba(247,183,49,0.25)';
  ctx.textAlign = 'left';
  ctx.fillText('CHALLENGE.STUDIO', 14, canvasH - 70);
  ctx.fillText('HH_' + String(Math.floor(elapsed / 100)).padStart(4, '0'), 14, canvasH - 54);
  ctx.restore();
}

function drawEnglishScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Subtle dot grid
  ctx.save();
  ctx.fillStyle = 'rgba(191,219,254,0.06)';
  const dotSpacing = 40;
  for (let gx = dotSpacing / 2; gx < canvasW; gx += dotSpacing) {
    for (let gy = dotSpacing / 2; gy < canvasH; gy += dotSpacing) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Globe outline at top-right (partial circle)
  ctx.save();
  ctx.strokeStyle = 'rgba(52,152,219,0.12)';
  ctx.lineWidth = 2;
  const globeX = canvasW + 60;
  const globeY = -60;
  const globeR = 220;
  ctx.beginPath();
  ctx.arc(globeX, globeY, globeR, Math.PI * 0.5, Math.PI * 1.2);
  ctx.stroke();
  // Latitude lines
  for (let la = 1; la <= 3; la++) {
    ctx.strokeStyle = `rgba(52,152,219,${0.04 + la * 0.02})`;
    ctx.beginPath();
    ctx.arc(globeX, globeY, globeR * (0.6 + la * 0.12), Math.PI * 0.4, Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();

  // Book spine decorations at left edge
  ctx.save();
  const bookColors = [
    'rgba(52,152,219,0.25)',
    'rgba(41,128,185,0.20)',
    'rgba(30,100,160,0.22)',
    'rgba(52,152,219,0.18)',
    'rgba(64,170,240,0.20)',
  ];
  const bookHeights = [80, 110, 90, 120, 70];
  let bookY = canvasH * 0.30;
  for (let i = 0; i < bookColors.length; i++) {
    ctx.fillStyle = bookColors[i];
    ctx.fillRect(0, bookY, 10, bookHeights[i]);
    bookY += bookHeights[i] + 4;
  }
  ctx.restore();

  // Horizontal rule lines at 18% and 82%
  ctx.save();
  ctx.strokeStyle = 'rgba(52,152,219,0.3)';
  ctx.lineWidth = 1;
  [0.18, 0.82].forEach((yPct) => {
    ctx.beginPath();
    ctx.moveTo(0, yPct * canvasH);
    ctx.lineTo(canvasW, yPct * canvasH);
    ctx.stroke();
  });
  ctx.restore();
}

function drawFairyScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // 30 twinkling stars at fixed positions
  const starPositions = [
    [0.08, 0.05], [0.25, 0.03], [0.60, 0.07], [0.80, 0.04], [0.95, 0.09],
    [0.15, 0.14], [0.40, 0.11], [0.70, 0.13], [0.90, 0.16], [0.05, 0.18],
    [0.50, 0.02], [0.35, 0.08], [0.75, 0.06], [0.20, 0.20], [0.85, 0.12],
    [0.55, 0.17], [0.10, 0.22], [0.45, 0.15], [0.65, 0.10], [0.30, 0.24],
    [0.92, 0.22], [0.03, 0.12], [0.77, 0.20], [0.22, 0.08], [0.48, 0.25],
    [0.68, 0.03], [0.88, 0.08], [0.12, 0.28], [0.58, 0.22], [0.38, 0.18],
  ];
  const starColors = ['#fff', '#fce7f3', '#fbbf24', '#ff80ab', '#e9d5ff'];

  ctx.save();
  for (let i = 0; i < starPositions.length; i++) {
    const [xp, yp] = starPositions[i];
    const twinkle = 0.3 + (Math.sin(elapsed * 0.004 + i * 1.3) + 1) / 2 * 0.7;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = starColors[i % starColors.length];
    const size = 1.5 + (i % 3) * 0.8;
    const sx = xp * canvasW;
    const sy = yp * canvasH;
    // Simple 4-point star
    ctx.beginPath();
    ctx.moveTo(sx, sy - size * 2);
    ctx.lineTo(sx + size * 0.5, sy - size * 0.5);
    ctx.lineTo(sx + size * 2, sy);
    ctx.lineTo(sx + size * 0.5, sy + size * 0.5);
    ctx.lineTo(sx, sy + size * 2);
    ctx.lineTo(sx - size * 0.5, sy + size * 0.5);
    ctx.lineTo(sx - size * 2, sy);
    ctx.lineTo(sx - size * 0.5, sy - size * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Shooting star: resets every 5 seconds
  ctx.save();
  const cycle = elapsed % 5000;
  if (cycle < 2000) {
    const t = cycle / 2000;
    const startX = canvasW * 0.8;
    const startY = canvasH * 0.05;
    const endX = canvasW * 0.1;
    const endY = canvasH * 0.25;
    const curX = startX + (endX - startX) * t;
    const curY = startY + (endY - startY) * t;
    const tailLen = 80;
    const tailX = curX + (startX - endX) / Math.hypot(endX - startX, endY - startY) * tailLen * (1 - t);
    const tailY = curY + (startY - endY) / Math.hypot(endX - startX, endY - startY) * tailLen * (1 - t);
    const shootGrad = ctx.createLinearGradient(tailX, tailY, curX, curY);
    shootGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shootGrad.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - t)})`);
    ctx.strokeStyle = shootGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
  }
  ctx.restore();

  // Rainbow arc at top
  ctx.save();
  const rainbowColors = ['#ff0000', '#ff7700', '#ffff00', '#00cc00', '#0000ff', '#8b00ff'];
  const arcCenterX = canvasW / 2;
  const arcCenterY = -canvasH * 0.05;
  const arcR = canvasW * 0.75;
  for (let i = 0; i < rainbowColors.length; i++) {
    ctx.strokeStyle = rainbowColors[i];
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(arcCenterX, arcCenterY, arcR - i * 18, 0, Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Magic dust: 20 particles rising from bottom
  ctx.save();
  const dustColors = ['#ff80ab', '#fbbf24', '#c084fc', '#67e8f9', '#fff'];
  for (let i = 0; i < 20; i++) {
    const baseX = ((i * 0.0517 + 0.03) % 1) * canvasW;
    const speed = 0.015 + (i % 5) * 0.008;
    const rawY = canvasH - ((elapsed * speed + i * 70) % (canvasH * 0.8));
    const dx = Math.sin(elapsed * 0.001 + i * 0.9) * 25;
    const alpha = 0.3 + Math.sin(elapsed * 0.004 + i * 1.1) * 0.25;
    ctx.globalAlpha = Math.max(0.05, alpha);
    ctx.fillStyle = dustColors[i % dustColors.length];
    ctx.beginPath();
    ctx.arc(baseX + dx, rawY, 2.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
    // Sparkle cross
    ctx.globalAlpha = Math.max(0.03, alpha * 0.5);
    ctx.fillRect(baseX + dx - 1, rawY - 6, 2, 12);
    ctx.fillRect(baseX + dx - 6, rawY - 1, 12, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Mascot drawer
// ---------------------------------------------------------------------------

function drawMascot(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  elapsed: number,
): void {
  const floatY = Math.sin(elapsed * 0.002) * 6;
  const finalY = y + floatY;

  // Glow behind mascot
  const glow = ctx.createRadialGradient(x, finalY, 0, x, finalY, size * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.20)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, finalY, size * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Emoji
  ctx.save();
  ctx.font = `${size}px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, finalY);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Lower-third overlay
// ---------------------------------------------------------------------------

function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  name: string,
  title: string,
  color: string,
  alpha: number,
): void {
  const barY = canvasH * 0.78;
  const barH = 52;
  const barX = 24;
  const barW = 280;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background bar
  rrPath(ctx, barX, barY, barW, barH, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fill();

  // Accent left stripe
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, 4, barH);

  // Name
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, barX + 12, barY + 8);

  // Title
  ctx.fillStyle = '#93c5fd';
  ctx.font = '13px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.fillText(title, barX + 12, barY + 30);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Inline BGM generator
// ---------------------------------------------------------------------------

interface SimpleBGMHandle {
  stop: () => void;
}

function createSimpleBGM(
  _audioCtx: AudioContext,
  _spec: BgmSpec,
  _dest: AudioNode,
  _opts?: { introMs?: number; totalMs?: number },
): SimpleBGMHandle {
  // TEAM-TEMPLATE (2026-04-22) — 사용자 피드백 #7:
  //   "html수준 bgm 쓰거나 반복 인식 실패" 의 "html수준 bgm" 이 바로 여기 오실레이터 폴백.
  //   BPM 고정 sine/square/sawtooth 합성은 실제 음악 대비 완전 인위적 → 앱 품질 저하.
  //   본 커밋부터는 완전 무음 stub. createFileBGM 이 실패하면 BGM 없이 진행.
  //   (실제 mp3 가 public/bgm/ 에 있으므로 이 폴백이 호출될 일은 거의 없음.)
  try { console.warn('[compositor] BGM file load failed — silent fallback (was: oscillator synth).'); } catch {}
  return { stop: () => {} };
}

// 아래 dead code 는 타입 참조 때문에 남아있지만 호출되지 않음.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _deadOscillatorBGM_legacy(
  audioCtx: AudioContext,
  spec: BgmSpec,
  dest: AudioNode,
  opts?: { introMs?: number; totalMs?: number },
): SimpleBGMHandle {
  const { genre, bpm, volume } = spec;
  if (genre === 'none') return { stop: () => {} };

  const introMs   = opts?.introMs   ?? 0;
  const totalMs   = opts?.totalMs   ?? 0;
  const duckLevel = Math.max(0.0001, volume * 0.28); // intro duck (≈-11dB)
  const fullLevel = Math.max(0.0001, volume);

  const masterGain = audioCtx.createGain();
  const t0 = audioCtx.currentTime;
  // Cycle 21 — envelope: intro duck → ramp up at intro end → fade out last 0.8s
  if (introMs > 0) {
    masterGain.gain.setValueAtTime(duckLevel, t0);
    masterGain.gain.setValueAtTime(duckLevel, t0 + introMs / 1000 - 0.25);
    masterGain.gain.linearRampToValueAtTime(fullLevel, t0 + introMs / 1000 + 0.15);
  } else {
    masterGain.gain.setValueAtTime(fullLevel, t0);
  }
  if (totalMs > 0) {
    const fadeOutStart = t0 + Math.max(0, (totalMs - 800)) / 1000;
    const fadeOutEnd   = t0 + totalMs / 1000;
    masterGain.gain.setValueAtTime(fullLevel, fadeOutStart);
    masterGain.gain.linearRampToValueAtTime(0.0001, fadeOutEnd);
  }
  masterGain.connect(dest);

  const beatInterval = 60 / bpm;
  let stopped = false;
  let nextBeat = audioCtx.currentTime + 0.05;
  const nodes: AudioNode[] = [masterGain];

  function playTone(
    freq: number,
    startTime: number,
    duration: number,
    gainVal: number,
    type: OscillatorType = 'sine',
  ) {
    if (stopped) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    nodes.push(osc, g);
  }

  function playNoiseBurst(startTime: number, duration: number, gainVal: number) {
    if (stopped) return;
    const bufLen = Math.ceil(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * gainVal;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hpf = audioCtx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 6000;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(hpf);
    hpf.connect(g);
    g.connect(masterGain);
    src.start(startTime);
    nodes.push(src, hpf, g);
  }

  function scheduleGenre(beatStart: number, beatNum: number) {
    const b = beatNum % 4; // 4/4 time

    if (genre === 'lofi') {
      // Mellow chord tones
      const chords = [[196, 247, 294], [220, 277, 330], [175, 220, 262], [196, 247, 294]];
      const chord = chords[beatNum % chords.length];
      chord.forEach((freq) => playTone(freq, beatStart, beatInterval * 0.9, 0.15, 'triangle'));
      // Soft kick on 1 & 3
      if (b === 0 || b === 2) playTone(60, beatStart, 0.18, 0.3, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.12, 0.2);
      // Hi-hat every 8th
      playNoiseBurst(beatStart, 0.04, 0.08);
      playNoiseBurst(beatStart + beatInterval / 2, 0.04, 0.06);
    } else if (genre === 'news') {
      // Punchy staccato tones
      const newsMelody = [261, 293, 329, 349, 293, 261, 220, 261];
      const freq = newsMelody[beatNum % newsMelody.length];
      if (b === 0) playTone(freq, beatStart, 0.25, 0.18, 'square');
      // Kick on 1
      if (b === 0) playTone(80, beatStart, 0.2, 0.35, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.1, 0.25);
      // Closed hi-hat
      playNoiseBurst(beatStart, 0.03, 0.1);
    } else if (genre === 'kpop') {
      // Energetic synth
      const kpopMelody = [330, 392, 440, 494, 440, 392, 349, 330];
      const freq = kpopMelody[beatNum % kpopMelody.length];
      playTone(freq, beatStart, beatInterval * 0.5, 0.16, 'sawtooth');
      // Bass on 1 & 3
      if (b === 0 || b === 2) playTone(65, beatStart, 0.15, 0.3, 'sine');
      if (b === 0 || b === 2) playTone(98, beatStart + 0.02, 0.12, 0.2, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.12, 0.3);
      // Open hi-hat
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.18, 0.12);
      // 8th hi-hats
      playNoiseBurst(beatStart + beatInterval / 2, 0.04, 0.08);
    } else if (genre === 'bright') {
      // Upbeat major scale
      const brightMelody = [261, 294, 330, 349, 392, 440, 494, 523];
      const freq = brightMelody[beatNum % brightMelody.length];
      playTone(freq, beatStart, beatInterval * 0.7, 0.14, 'sine');
      // Kick on 1 & 3
      if (b === 0 || b === 2) playTone(70, beatStart, 0.18, 0.28, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.1, 0.22);
      // Bright hi-hat
      playNoiseBurst(beatStart, 0.03, 0.1);
      playNoiseBurst(beatStart + beatInterval / 2, 0.03, 0.07);
    } else if (genre === 'fairy') {
      // Delicate pentatonic
      const fairyScale = [523, 587, 659, 784, 880, 784, 659, 587];
      const freq = fairyScale[beatNum % fairyScale.length];
      playTone(freq, beatStart, beatInterval * 0.8, 0.10, 'triangle');
      playTone(freq * 2, beatStart, beatInterval * 0.4, 0.04, 'sine');
      // Soft kick
      if (b === 0) playTone(65, beatStart, 0.25, 0.18, 'sine');
      // Gentle snare
      if (b === 2) playNoiseBurst(beatStart, 0.08, 0.12);
      // Sparkle hi-hat
      playNoiseBurst(beatStart, 0.03, 0.06);
      if (beatNum % 2 === 0) playNoiseBurst(beatStart + beatInterval * 0.75, 0.02, 0.05);

    } else if (genre === 'fitness') {
      // Trap/EDM: heavy 808 kick, trap hi-hats, minor pentatonic synth
      const trapBass = [55, 55, 65, 55, 49, 55, 58, 55]; // A1, A1, C2, A1, G1, A1, Bb1 pattern
      const trapLead = [220, 261, 294, 330, 261, 220, 196, 220]; // A3-arp
      // 808 kick: very low pitched sine with fast decay
      if (b === 0) {
        playTone(90, beatStart, 0.35, 0.55, 'sine');
        playTone(55, beatStart, 0.25, 0.40, 'sine');
        playNoiseBurst(beatStart, 0.04, 0.30); // punch transient
      }
      // Ghost kick on "and-of-3" (beat 2.5 = halfway through beat index 2)
      if (b === 2) {
        playTone(85, beatStart, 0.28, 0.40, 'sine');
        playTone(50, beatStart, 0.20, 0.30, 'sine');
        playNoiseBurst(beatStart, 0.03, 0.25);
        // Second ghost on e-of-4 (+ half beat)
        playTone(75, beatStart + beatInterval * 0.5, 0.18, 0.25, 'sine');
        playNoiseBurst(beatStart + beatInterval * 0.5, 0.025, 0.18);
      }
      // Clap/snare on 2 and 4
      if (b === 1 || b === 3) {
        playNoiseBurst(beatStart, 0.14, 0.40);
        playNoiseBurst(beatStart + 0.01, 0.10, 0.25); // double clap
      }
      // Trap hi-hats: 16th notes with dynamic variation
      [0, 0.25, 0.5, 0.75].forEach((sixteenth, si) => {
        const vol = si % 2 === 0 ? 0.14 : 0.07; // loud on 8th notes
        playNoiseBurst(beatStart + sixteenth * beatInterval, 0.025, vol);
      });
      // Open hi-hat on "and" of 4
      if (b === 3) playNoiseBurst(beatStart + beatInterval * 0.5, 0.18, 0.16);
      // Sub bass groove
      const bassFreq = trapBass[beatNum % trapBass.length];
      playTone(bassFreq, beatStart, beatInterval * 0.85, 0.32, 'sine');
      // Synth lead: sawtooth + filter envelope feel (simulate with short burst)
      if (beatNum % 2 === 0) {
        const lead = trapLead[Math.floor(beatNum / 2) % trapLead.length];
        playTone(lead, beatStart, beatInterval * 0.4, 0.14, 'sawtooth');
        playTone(lead * 0.5, beatStart, beatInterval * 0.4, 0.08, 'square');
      }

    } else if (genre === 'travel') {
      // Indie/upbeat pop: bright major tonality, melodic feel
      const travelLead = [392, 440, 494, 523, 494, 440, 392, 349]; // G4-C5 major
      const travelBass = [98, 98, 110, 98, 87, 98, 110, 87];       // G2 based
      const travelChord = [[261, 329, 392], [294, 370, 440], [261, 329, 392], [220, 277, 330]];
      // Light kick on 1 and 3
      if (b === 0 || b === 2) {
        playTone(75, beatStart, 0.18, 0.30, 'sine');
        playNoiseBurst(beatStart, 0.025, 0.15);
      }
      // Snare on 2 and 4 (bright, not too heavy)
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.10, 0.28);
      // 8th note hi-hats (bright, airy)
      playNoiseBurst(beatStart, 0.025, 0.10);
      playNoiseBurst(beatStart + beatInterval * 0.5, 0.025, 0.07);
      // Tambourine accent on off-beats
      if (b === 1 || b === 3) playNoiseBurst(beatStart + beatInterval * 0.5, 0.04, 0.09);
      // Melodic lead: bright triangle (acoustic guitar/ukulele feel)
      const lead = travelLead[beatNum % travelLead.length];
      playTone(lead, beatStart, beatInterval * 0.55, 0.16, 'triangle');
      playTone(lead * 2, beatStart, beatInterval * 0.20, 0.04, 'sine'); // octave shimmer
      // Chord pad: every bar start
      if (b === 0) {
        const chord = travelChord[(beatNum / 4 | 0) % travelChord.length];
        chord.forEach((f) => playTone(f, beatStart, beatInterval * 3.5, 0.07, 'triangle'));
      }
      // Bass: warm sine, smooth
      const bassFreq = travelBass[beatNum % travelBass.length];
      playTone(bassFreq, beatStart, beatInterval * 0.75, 0.22, 'sine');

    } else if (genre === 'hiphop') {
      // Boom-bap hip-hop: classic NY sound
      const hhLead = [233, 220, 196, 175, 196, 220, 233, 262]; // Bb minor groove
      const hhBass = [58, 58, 65, 55, 58, 49, 58, 55];          // Sub Bb bass
      // HEAVY kick on 1 and "and-of-3" (boom-bap pattern)
      if (b === 0) {
        playTone(80, beatStart, 0.30, 0.65, 'sine');
        playTone(50, beatStart, 0.22, 0.50, 'sine');
        playNoiseBurst(beatStart, 0.04, 0.35);
      }
      if (b === 2) {
        // Kick on "and-of-2" (half-beat shift) = the "boom" in boom-bap
        const boomTime = beatStart + beatInterval * 0.5;
        playTone(80, boomTime, 0.28, 0.55, 'sine');
        playTone(50, boomTime, 0.20, 0.42, 'sine');
        playNoiseBurst(boomTime, 0.035, 0.30);
      }
      // Crisp snare (bap) on 2 and 4
      if (b === 1 || b === 3) {
        playNoiseBurst(beatStart, 0.15, 0.50);
        playTone(180, beatStart, 0.08, 0.12, 'sine'); // tonal body
      }
      // Hi-hat: 8th notes (simple, human feel — louder on downbeat)
      const hhVol = b % 2 === 0 ? 0.13 : 0.08;
      playNoiseBurst(beatStart, 0.03, hhVol);
      playNoiseBurst(beatStart + beatInterval * 0.5, 0.03, hhVol * 0.7);
      // Open hi-hat accent on beat 3 off-beat
      if (b === 2) playNoiseBurst(beatStart + beatInterval * 0.75, 0.20, 0.11);
      // Sub bass groove: deep sine, fat
      const bassFreq = hhBass[beatNum % hhBass.length];
      playTone(bassFreq, beatStart, beatInterval * 0.80, 0.42, 'sine');
      playTone(bassFreq * 2, beatStart, beatInterval * 0.40, 0.12, 'square'); // body
      // Sampler melody (triangle, choppy)
      if (beatNum % 2 === 0) {
        const mel = hhLead[Math.floor(beatNum / 2) % hhLead.length];
        playTone(mel, beatStart, beatInterval * 0.35, 0.13, 'triangle');
      }
    }
  }

  // Lookahead scheduler
  let beatCount = 0;
  const lookahead = 0.25; // seconds
  function schedule() {
    if (stopped) return;
    while (nextBeat < audioCtx.currentTime + lookahead) {
      scheduleGenre(nextBeat, beatCount);
      beatCount++;
      nextBeat += beatInterval;
    }
    if (!stopped) {
      setTimeout(schedule, 50);
    }
  }
  schedule();

  return {
    stop: () => {
      stopped = true;
      try { masterGain.disconnect(); } catch (_) {}
    },
  };
}

// ---------------------------------------------------------------------------
// FIX-Z8 (2026-04-22): 실제 MP3 파일을 로딩해서 BGM 으로 재생.
//   기존 createSimpleBGM 은 Web Audio oscillator 로 비트를 합성 — 사용자 피드백
//   "이상한 비트맵인지 html인지 이상한 음" 의 원인.
//   실제 mp3 가 public/bgm/ 에 존재하면 이것을 우선 사용, 실패 시 oscillator 폴백.
// ---------------------------------------------------------------------------

function resolveGenreBgmFile(genre: BgmSpec['genre']): string | null {
  // 실존 파일에 매핑. /public/bgm/ 에 실제로 존재하는 파일들만.
  switch (genre) {
    case 'kpop':
    case 'fitness':
    case 'bright':
      return '/bgm/backgroundmusicforvideos-no-copyright-music-334863.mp3';
    case 'news':
    case 'lofi':
    case 'travel':
    case 'hiphop':
      return '/bgm/atlasaudio-jazz-490623.mp3';
    case 'fairy':
      return '/bgm/diamond_tunes-no-copyright-intro-music-18457.mp3';
    default:
      return null;
  }
}

async function createFileBGM(
  audioCtx: AudioContext,
  spec: BgmSpec & { src?: string },
  dest: AudioNode,
  opts?: { introMs?: number; totalMs?: number },
): Promise<SimpleBGMHandle | null> {
  if (spec.genre === 'none') return { stop: () => {} };
  // FIX-Z21 (2026-04-22): 템플릿이 직접 지정한 bgm.src 를 최우선 사용.
  //   이전엔 mood → style → genre 의 3단 매핑을 거쳐 `pop_candy → vlog` 같은
  //   미등록 분기에서 null 리턴 → emoji-explosion 이 무음·오실레이터 폴백으로
  //   귀결되는 버그가 있었다. spec.src 가 있으면 장르 무시하고 그 파일 로딩.
  const url = (spec as any).src || resolveGenreBgmFile(spec.genre);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      try { console.warn('[compositor] BGM fetch not ok:', url, res.status); } catch {}
      return null;
    }
    // FIX-Z12: Vercel rewrites 가 정적자산도 index.html 로 돌리는 버그를 겪은 적 있음.
    //   Content-Type 이 text/html 이면 즉시 실패시켜서 원인 추적 쉽게.
    const ctype = res.headers.get('content-type') || '';
    if (ctype.includes('text/html')) {
      try { console.warn('[compositor] BGM URL returned HTML (vercel rewrite bug?):', url, ctype); } catch {}
      return null;
    }
    const ab = await res.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(ab.slice(0));

    const introMs   = opts?.introMs   ?? 0;
    const totalMs   = opts?.totalMs   ?? 0;
    const duckLevel = Math.max(0.0001, spec.volume * 0.28);
    const fullLevel = Math.max(0.0001, spec.volume);

    const masterGain = audioCtx.createGain();
    const t0 = audioCtx.currentTime;
    if (introMs > 0) {
      masterGain.gain.setValueAtTime(duckLevel, t0);
      masterGain.gain.setValueAtTime(duckLevel, t0 + introMs / 1000 - 0.25);
      masterGain.gain.linearRampToValueAtTime(fullLevel, t0 + introMs / 1000 + 0.15);
    } else {
      masterGain.gain.setValueAtTime(fullLevel, t0);
    }
    if (totalMs > 0) {
      const fadeOutStart = t0 + Math.max(0, (totalMs - 800)) / 1000;
      const fadeOutEnd   = t0 + totalMs / 1000;
      masterGain.gain.setValueAtTime(fullLevel, fadeOutStart);
      masterGain.gain.linearRampToValueAtTime(0.0001, fadeOutEnd);
    }
    masterGain.connect(dest);

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(masterGain);
    src.start(0);
    try { console.info('[compositor] BGM loaded from file:', url, 'duration=', buf.duration.toFixed(2) + 's'); } catch {}

    return {
      stop: () => {
        try { src.stop(); } catch {}
        try { masterGain.disconnect(); } catch {}
      },
    };
  } catch (e) {
    try { console.warn('[compositor] createFileBGM failed, falling back:', e); } catch {}
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLIP FRAME — genre-specific decorative overlay drawn ON TOP of user video
// Makes the clip look like it's inside a professional template frame
// ---------------------------------------------------------------------------

function drawClipFrame(
  ctx: CanvasRenderingContext2D,
  bgStyle: string,
  cx: number, cy: number, cw: number, ch: number,
  borderRadius: number,
  accentColor: string,
  elapsed: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.004);
  const pulse2 = 0.5 + 0.5 * Math.sin(elapsed * 0.006 + 1);

  ctx.save();

  if (bgStyle === 'news') {
    // ── TV broadcast frame: scanlines overlay + red LIVE badge ─────────────
    // Scanlines
    ctx.save();
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.clip();
    ctx.globalAlpha = 0.06;
    for (let sy = cy; sy < cy + ch; sy += 4) {
      ctx.fillStyle = '#000';
      ctx.fillRect(cx, sy, cw, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Sharp corner marks (broadcast style)
    const mk = 22; const mgap = 6;
    ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 3; ctx.lineCap = 'square';
    [[cx + mgap, cy + mgap, 1, 1], [cx + cw - mgap, cy + mgap, -1, 1],
     [cx + mgap, cy + ch - mgap, 1, -1], [cx + cw - mgap, cy + ch - mgap, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x as number, (y as number) + (dy as number) * mk);
      ctx.lineTo(x as number, y as number); ctx.lineTo((x as number) + (dx as number) * mk, y as number);
      ctx.stroke();
    });
    // LIVE badge top-left
    const bx = cx + 10; const by = cy + 10;
    ctx.save();
    ctx.globalAlpha = 0.9 + pulse * 0.1;
    ctx.fillStyle = '#c62828';
    rrPath(ctx, bx, by, 62, 22, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('● LIVE', bx + 7, by + 11);
    ctx.restore();

  } else if (bgStyle === 'kpop') {
    // ── K-POP neon stage frame: rainbow gradient border + star sparks ──────
    const grad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    grad.addColorStop(0,   '#e94560');
    grad.addColorStop(0.33, '#fbbf24');
    grad.addColorStop(0.66, '#7c3aed');
    grad.addColorStop(1,   '#e94560');
    rrPath(ctx, cx - 1, cy - 1, cw + 2, ch + 2, borderRadius + 1);
    ctx.strokeStyle = grad; ctx.lineWidth = 3 + pulse * 2;
    ctx.shadowColor = '#e94560'; ctx.shadowBlur = 16 + pulse * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Star sparks at corners
    const stars = [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]];
    stars.forEach(([sx, sy], i) => {
      const phase = elapsed * 0.005 + i * 1.57;
      const sparkAlpha = 0.5 + 0.5 * Math.sin(phase);
      ctx.save(); ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = '#fbbf24'; ctx.font = '16px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', sx as number, sy as number);
      ctx.restore();
    });
    // NOW PLAYING badge top-right
    ctx.save();
    ctx.globalAlpha = 0.88;
    const npx = cx + cw - 100; const npy = cy + 8;
    ctx.fillStyle = 'rgba(233,69,96,0.9)';
    rrPath(ctx, npx, npy, 95, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♪ NOW PLAYING', npx + 47, npy + 11);
    ctx.restore();

  } else if (bgStyle === 'fitness') {
    // ── Fitness HUD: corner brackets + heartbeat line + energy readout ──────
    const bk = 30; const bg = 5;
    ctx.strokeStyle = accentColor; ctx.lineWidth = 3; ctx.lineCap = 'square';
    // Corner brackets
    [[cx + bg, cy + bg, 1, 1], [cx + cw - bg, cy + bg, -1, 1],
     [cx + bg, cy + ch - bg, 1, -1], [cx + cw - bg, cy + ch - bg, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x as number, (y as number) + (dy as number) * bk);
      ctx.lineTo(x as number, y as number); ctx.lineTo((x as number) + (dx as number) * bk, y as number);
      ctx.stroke();
    });
    // Pulsing glow on border
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.25;
    ctx.shadowColor = accentColor; ctx.shadowBlur = 20;
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = accentColor; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Heartbeat line at bottom of clip
    const hbY = cy + ch - 18;
    ctx.save(); ctx.globalAlpha = 0.7;
    ctx.strokeStyle = accentColor; ctx.lineWidth = 2;
    ctx.beginPath();
    const hbLen = cw * 0.6; const hbX = cx + cw * 0.2;
    const t = (elapsed * 0.003) % (Math.PI * 2);
    for (let i = 0; i <= 60; i++) {
      const px = hbX + (i / 60) * hbLen;
      const phase = t + i * 0.3;
      // Heartbeat waveform: mostly flat with sharp spike every cycle
      const spike = Math.max(0, 1 - Math.abs(((i / 60 * 3 + elapsed * 0.003) % 1) - 0.5) * 8) * 12;
      const hy = hbY - spike;
      i === 0 ? ctx.moveTo(px, hy) : ctx.lineTo(px, hy);
    }
    ctx.stroke();
    ctx.restore();
    // REC indicator
    ctx.save(); ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx + cw - 20, cy + 18, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('REC', cx + cw - 28, cy + 18);
    ctx.restore();

  } else if (bgStyle === 'travel') {
    // ── Travel: polaroid-style thick white bottom bar + location pin ─────────
    // Polaroid-style bottom caption area
    const polH = 36; const polY = cy + ch - polH;
    ctx.save(); ctx.globalAlpha = 0.88;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx, polY, cw, polH);
    ctx.globalAlpha = 1;
    ctx.restore();
    // Warm gradient border
    const tGrad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    tGrad.addColorStop(0, 'rgba(249,115,22,0.8)');
    tGrad.addColorStop(0.5, 'rgba(234,88,12,0.3)');
    tGrad.addColorStop(1, 'rgba(249,115,22,0.8)');
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = tGrad; ctx.lineWidth = 3; ctx.stroke();
    // Location pin top-left
    ctx.save(); ctx.globalAlpha = 0.92;
    const lpx = cx + 12; const lpy = cy + 10;
    ctx.fillStyle = 'rgba(249,115,22,0.9)';
    rrPath(ctx, lpx, lpy, 90, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('📍 CHALLENGE', lpx + 6, lpy + 11);
    ctx.restore();
    // Animated airplane watermark
    const apx = cx + ((elapsed * 0.025) % (cw + 30)) - 15;
    ctx.save(); ctx.globalAlpha = 0.15;
    ctx.font = '18px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✈', apx, cy + 28);
    ctx.restore();

  } else if (bgStyle === 'hiphop') {
    // ── Hiphop: gold graffiti corner marks + VU meter dots ──────────────────
    // Gold gradient border with glow
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = accentColor; ctx.shadowBlur = 12 + pulse2 * 8;
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = accentColor; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Angled corner decorations (graffiti slash marks)
    const cs = 40;
    [[cx + 8, cy + 8], [cx + cw - 8, cy + 8], [cx + 8, cy + ch - 8], [cx + cw - 8, cy + ch - 8]].forEach(([x, y], i) => {
      ctx.save(); ctx.globalAlpha = 0.7;
      ctx.strokeStyle = accentColor; ctx.lineWidth = 2.5;
      ctx.beginPath();
      const dx = i % 2 === 0 ? 1 : -1;
      const dy = i < 2 ? 1 : -1;
      ctx.moveTo(x as number, y as number);
      ctx.lineTo((x as number) + dx * cs, y as number);
      ctx.moveTo(x as number, y as number);
      ctx.lineTo(x as number, (y as number) + dy * cs);
      ctx.moveTo((x as number) + dx * cs * 0.4, (y as number) + dy * cs * 0.6);
      ctx.lineTo((x as number) + dx * cs * 0.7, (y as number) + dy * cs * 0.2);
      ctx.stroke();
      ctx.restore();
    });
    // VU meter dots along right edge
    const dotCount = 12;
    for (let di = 0; di < dotCount; di++) {
      const dotY = cy + (di + 0.5) * (ch / dotCount);
      const active = Math.sin(elapsed * 0.005 + di * 0.5) > 0;
      ctx.save(); ctx.globalAlpha = active ? 0.85 : 0.2;
      ctx.fillStyle = di < dotCount * 0.6 ? '#22c55e' : di < dotCount * 0.85 ? '#fbbf24' : '#ef4444';
      ctx.beginPath(); ctx.arc(cx + cw - 8, dotY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // CYPHER badge
    ctx.save(); ctx.globalAlpha = 0.88;
    const cpx = cx + 10; const cpy = cy + 10;
    ctx.fillStyle = 'rgba(247,183,49,0.9)';
    rrPath(ctx, cpx, cpy, 72, 20, 3); ctx.fill();
    ctx.fillStyle = '#0a0a0a'; ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('🎧 CYPHER', cpx + 5, cpy + 10);
    ctx.restore();

  } else if (bgStyle === 'vlog') {
    // ── Vlog: soft gradient border + REC dot + "DAILY VLOG" badge ───────────
    const vGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    vGrad.addColorStop(0, 'rgba(155,89,182,0.8)');
    vGrad.addColorStop(0.5, 'rgba(103,126,234,0.4)');
    vGrad.addColorStop(1, 'rgba(155,89,182,0.8)');
    ctx.save(); ctx.shadowColor = 'rgba(155,89,182,0.5)'; ctx.shadowBlur = 14 + pulse * 8;
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = vGrad; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
    // REC dot
    ctx.save(); ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx + cw - 20, cy + 18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('REC', cx + cw - 28, cy + 18);
    ctx.restore();

  } else if (bgStyle === 'fairy') {
    // ── Fairy: sparkle corner flowers + pastel glow border ──────────────────
    const fGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    fGrad.addColorStop(0, 'rgba(255,128,171,0.9)');
    fGrad.addColorStop(0.5, 'rgba(200,80,220,0.4)');
    fGrad.addColorStop(1, 'rgba(255,128,171,0.9)');
    ctx.save(); ctx.shadowColor = 'rgba(255,128,171,0.6)'; ctx.shadowBlur = 16 + pulse * 10;
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = fGrad; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
    // Sparkle emoji corners
    const corners = [[cx + 4, cy + 4], [cx + cw - 12, cy + 4], [cx + 4, cy + ch - 16], [cx + cw - 12, cy + ch - 16]];
    corners.forEach(([sx, sy], i) => {
      const phase = elapsed * 0.004 + i * 0.8;
      ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(phase);
      ctx.font = '14px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('✨', sx as number, sy as number);
      ctx.restore();
    });

  } else {
    // ── english / default: clean accent gradient border ─────────────────────
    const dGrad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    dGrad.addColorStop(0, accentColor + 'cc');
    dGrad.addColorStop(0.5, accentColor + '44');
    dGrad.addColorStop(1, accentColor + 'cc');
    rrPath(ctx, cx, cy, cw, ch, borderRadius);
    ctx.strokeStyle = dGrad; ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// INTRO phase (elapsed 0 → INTRO_MS):  countdown 3-2-1-GO! + branding
// ---------------------------------------------------------------------------

function drawIntroFrame(
  ctx: CanvasRenderingContext2D,
  template: VideoTemplate,
  elapsed: number,
  canvasW: number,
  canvasH: number,
): void {
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // 풀스크린 어두운 그라데이션 오버레이 (드라마틱)
  const darkGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, canvasH * 0.7);
  darkGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  darkGrad.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = darkGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Cycle 32 — 시네마 레터박스 바 (처음 400ms 슬라이드 인, 마지막 400ms 슬라이드 아웃)
  const barTarget = canvasH * 0.12;
  const introSlideIn  = Math.min(1, elapsed / 400);
  const introSlideOut = elapsed > 4600 ? Math.min(1, (elapsed - 4600) / 400) : 0;
  const barH = barTarget * (introSlideIn - introSlideOut);
  if (barH > 0) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, barH);
    ctx.fillRect(0, canvasH - barH, canvasW, barH);
    // 바 안쪽 가장자리에 accent 라인
    ctx.fillStyle = template.accentColor + 'cc';
    ctx.fillRect(0, barH - 2, canvasW, 2);
    ctx.fillRect(0, canvasH - barH, canvasW, 2);
    ctx.restore();
  }

  // 필름 그레인 — 전체 프레임에 deterministic noise
  ctx.save();
  ctx.globalAlpha = 0.08;
  const grainCols = 64;
  const grainRows = Math.ceil((canvasH / canvasW) * grainCols);
  const gw = canvasW / grainCols;
  const gh = canvasH / grainRows;
  const grainT = Math.floor(elapsed / 66); // 15fps변경
  for (let r = 0; r < grainRows; r++) {
    for (let c = 0; c < grainCols; c++) {
      const v = Math.sin((c * 12.9898 + r * 78.233 + grainT * 43.7) * 1.0) * 43758.5453;
      const n = v - Math.floor(v);
      if (n > 0.65) {
        ctx.fillStyle = n > 0.9 ? '#ffffff' : '#aaa';
        ctx.fillRect(c * gw, r * gh, gw * 0.8, gh * 0.8);
      }
    }
  }
  ctx.restore();

  // Accent color rays (방사 광선)
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + elapsed * 0.0008;
    const len = canvasH * 0.65;
    const grad = ctx.createLinearGradient(
      centerX, centerY,
      centerX + Math.cos(a) * len, centerY + Math.sin(a) * len,
    );
    grad.addColorStop(0, template.accentColor + '33');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    const spread = 0.06;
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(a + spread) * len,
      centerY + Math.sin(a + spread) * len,
    );
    ctx.lineTo(
      centerX + Math.cos(a - spread) * len,
      centerY + Math.sin(a - spread) * len,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Countdown: 3 (0-1s) → 2 (1-2s) → 1 (2-3s) → GO! (3-5s, 2초 임팩트)
  const rawIdx  = Math.floor(elapsed / 1000);
  const secIdx  = Math.min(3, rawIdx);
  const isGo    = secIdx === 3;
  // GO! 구간은 2초이므로 진행도 0-1로 다시 매핑
  const secProg = isGo
    ? Math.min(1, (elapsed - 3000) / 2000)
    : (elapsed % 1000) / 1000;
  const labels  = ['3', '2', '1', 'GO!'];
  const label   = labels[secIdx];

  // 숫자는 "튕기면서 들어옴" — easeOutBack
  const easeOutBack = (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const inProg = Math.min(1, secProg / 0.3);
  const outProg = secProg > 0.7 ? (secProg - 0.7) / 0.3 : 0;
  const countScale = isGo
    ? 0.3 + easeOutBack(inProg) * 1.4 + outProg * 0.8
    : 0.3 + easeOutBack(inProg) * 0.9;
  const alpha = isGo ? Math.max(0, 1 - outProg) : 1 - outProg * 0.3;

  // 링: 1초마다 한 번씩 회전하며 줄어드는 시계
  const ringR = 140;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = template.accentColor;
  ctx.lineWidth   = 12;
  ctx.lineCap     = 'round';
  ctx.shadowColor = template.accentColor;
  ctx.shadowBlur  = 24;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringR, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * secProg);
  ctx.stroke();
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();

  // 방사 글로우
  const glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, ringR + 80);
  glowGrad.addColorStop(0, template.accentColor + '88');
  glowGrad.addColorStop(0.4, template.accentColor + '33');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringR + 80, 0, Math.PI * 2);
  ctx.fill();

  // 카운트 숫자
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(countScale, countScale);
  ctx.globalAlpha = alpha;
  ctx.font        = `900 ${isGo ? 110 : 180}px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth   = 12;
  ctx.strokeText(label, 0, 0);
  // 그라데이션 텍스트
  const textGrad = ctx.createLinearGradient(0, -100, 0, 100);
  textGrad.addColorStop(0, isGo ? '#FFE55C' : '#ffffff');
  textGrad.addColorStop(1, isGo ? '#FF6B35' : template.accentColor);
  ctx.fillStyle   = textGrad;
  ctx.shadowColor = template.accentColor;
  ctx.shadowBlur  = 30;
  ctx.fillText(label, 0, 0);
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();

  // 상단 배지: "CHALLENGE STUDIO · 시작" (Claude 톤)
  const badgeAlpha = Math.min(1, elapsed / 600);
  const badgeY = canvasH * 0.15;
  ctx.save();
  ctx.globalAlpha = badgeAlpha;
  // 배지 바디 (잉크)
  ctx.fillStyle = '#1F1B16';
  rrPath(ctx, centerX - 120, badgeY - 20, 240, 40, 20);
  ctx.fill();
  // 앰버 테두리
  ctx.strokeStyle = '#CC785C';
  ctx.lineWidth = 1.5;
  rrPath(ctx, centerX - 120, badgeY - 20, 240, 40, 20);
  ctx.stroke();
  // 브랜드 도트
  ctx.fillStyle = '#CC785C';
  ctx.beginPath();
  ctx.arc(centerX - 96, badgeY, 4, 0, Math.PI * 2);
  ctx.fill();
  // 텍스트
  ctx.font = '800 13px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.fillStyle = '#F7F3EB';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CHALLENGE  STUDIO · 시작', centerX + 10, badgeY);
  ctx.globalAlpha = 1;
  ctx.restore();

  // 하단 템플릿명 + emoji (kinetic reveal)
  const nameY = centerY + ringR + 100;
  const nameProg = Math.min(1, elapsed / 1500);
  ctx.save();
  ctx.globalAlpha = nameProg;
  // 이모지
  if (template.mascotEmoji) {
    ctx.font = 'bold 56px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(template.mascotEmoji, centerX, nameY - 20);
  }
  // 제목: 세리프 (프리미엄 매거진 느낌)
  ctx.font        = '700 42px Georgia, "Times New Roman", serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0,0,0,0.78)';
  ctx.lineWidth = 6;
  ctx.strokeText(template.name, centerX, nameY + 20);
  ctx.shadowColor = template.accentColor;
  ctx.shadowBlur  = 16;
  ctx.fillStyle   = '#fff';
  ctx.fillText(template.name, centerX, nameY + 20);
  ctx.shadowBlur  = 0;
  // 앰버 언더라인
  const underW = Math.min(canvasW * 0.5, 300);
  ctx.fillStyle = '#CC785C';
  ctx.fillRect(centerX - underW / 2, nameY + 72, underW, 2);
  // 메타 정보 (small caps)
  ctx.font = '800 14px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const metaLine = `${template.duration_ms / 1000} SECOND CHALLENGE`;
  ctx.fillText(metaLine, centerX, nameY + 85);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// OUTRO phase (elapsed MAIN_END → END):  trophy celebration + hashtags + CTA
// ---------------------------------------------------------------------------

function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  template: VideoTemplate,
  outroElapsed: number,
  canvasW: number,
  canvasH: number,
): void {
  const progress  = Math.min(1, outroElapsed / OUTRO_MS);
  const centerX   = canvasW / 2;
  const centerY   = canvasH * 0.42;

  // 풀스크린 어두운 그라데이션 + 골드 글로우
  const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, canvasH * 0.7);
  bgGrad.addColorStop(0, `rgba(80,60,0,${0.55 * progress})`);
  bgGrad.addColorStop(1, `rgba(0,0,0,${0.90 * progress})`);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Cycle 32 — 아웃트로 시네마 레터박스 (바로 들어와서 끝까지 유지)
  const outroBarH = canvasH * 0.12 * Math.min(1, progress * 2.5);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, outroBarH);
  ctx.fillRect(0, canvasH - outroBarH, canvasW, outroBarH);
  // 골드 에지 라인
  ctx.fillStyle = `rgba(255,215,0,${0.85 * progress})`;
  ctx.fillRect(0, outroBarH - 2, canvasW, 2);
  ctx.fillRect(0, canvasH - outroBarH, canvasW, 2);
  ctx.restore();

  // 폭죽 파티클 (랜덤한 위치에 반짝이는 점)
  const particles = 40;
  for (let i = 0; i < particles; i++) {
    const seed = i * 7.31;
    const pX = ((Math.sin(seed) + 1) / 2) * canvasW;
    const pY = ((Math.cos(seed * 1.7) + 1) / 2) * canvasH;
    const pPhase = (outroElapsed * 0.001 + seed) % 1;
    const pAlpha = Math.sin(pPhase * Math.PI) * Math.min(1, progress * 2);
    const pSize = 2 + ((i % 4)) * 2;
    const colors = ['#FFD700', '#FFA500', '#FF6B35', '#FFE55C', '#ffffff'];
    ctx.save();
    ctx.globalAlpha = Math.max(0, pAlpha) * 0.85;
    ctx.fillStyle = colors[i % colors.length];
    ctx.shadowColor = colors[i % colors.length];
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pX, pY, pSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 방사 골드 스파이크 (회전)
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + outroElapsed * 0.0015;
    const len   = 300 * progress;
    const grad  = ctx.createLinearGradient(
      centerX, centerY,
      centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len,
    );
    grad.addColorStop(0, 'rgba(255,215,0,0.5)');
    grad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // 트로피 이모지 (스프링 스케일 인)
  const easeOutBack = (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const trophyProg = Math.min(1, progress * 1.8);
  const trophyScale = 0.1 + easeOutBack(trophyProg) * 1.3;
  ctx.save();
  ctx.translate(centerX, centerY - 40);
  ctx.scale(trophyScale, trophyScale);
  ctx.globalAlpha = Math.min(1, progress * 2);
  ctx.font        = '140px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 40;
  ctx.fillText('🏆', 0, 0);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();

  // "챌린지 완료!" 타이틀 (두 번째 단계)
  if (progress > 0.25) {
    const titleProg = (progress - 0.25) / 0.4;
    const titleAlpha = Math.min(1, titleProg * 2);
    const titleScale = 0.5 + easeOutBack(Math.min(1, titleProg)) * 0.6;
    ctx.save();
    ctx.translate(centerX, centerY + 120);
    ctx.scale(titleScale, titleScale);
    ctx.globalAlpha = titleAlpha;
    ctx.font         = '700 60px Georgia, "Times New Roman", serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
    ctx.lineWidth    = 8;
    ctx.strokeText('챌린지 완료!', 0, 0);
    const titleGrad = ctx.createLinearGradient(0, -40, 0, 40);
    titleGrad.addColorStop(0, '#FFE55C');
    titleGrad.addColorStop(1, '#FF6B35');
    ctx.fillStyle    = titleGrad;
    ctx.shadowColor  = '#FFD700';
    ctx.shadowBlur   = 30;
    ctx.fillText('챌린지 완료!', 0, 0);
    ctx.shadowBlur   = 0;
    ctx.globalAlpha  = 1;
    ctx.restore();
  }

  // 템플릿 이름 배지
  if (progress > 0.4) {
    const nameAlpha = Math.min(1, (progress - 0.4) / 0.3);
    ctx.save();
    ctx.globalAlpha = nameAlpha;
    ctx.fillStyle = template.accentColor;
    rrPath(ctx, centerX - 140, centerY + 180, 280, 44, 22);
    ctx.fill();
    ctx.font         = '800 20px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.fillStyle    = '#fff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${template.mascotEmoji ?? '✨'}  ${template.name}`,
      centerX, centerY + 202,
    );
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 해시태그 + CTA
  if (progress > 0.55) {
    const hashAlpha = (progress - 0.55) / 0.45;
    const tags = template.hashtags.slice(0, 4).map(h => '#' + h).join('   ');
    ctx.save();
    ctx.globalAlpha    = hashAlpha;
    // 얇은 디바이더 라인 (amber)
    ctx.fillStyle = 'rgba(204,120,92,0.7)';
    ctx.fillRect(centerX - 60, canvasH * 0.70, 120, 1);
    // 태그 라인 — 앰버 톤
    ctx.font           = '700 16px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.fillStyle      = '#F7E4D9';
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'top';
    ctx.shadowColor    = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur     = 4;
    ctx.fillText(tags, canvasW / 2, canvasH * 0.715);
    ctx.shadowBlur     = 0;

    // 펄싱 CTA — Claude ink + amber edge pill
    const pulse = 0.92 + 0.08 * Math.sin(outroElapsed * 0.008);
    ctx.globalAlpha = hashAlpha * pulse;
    // 바디 (ink)
    ctx.fillStyle = '#1F1B16';
    rrPath(ctx, centerX - 140, canvasH * 0.78, 280, 54, 27);
    ctx.fill();
    // 앰버 엣지
    ctx.strokeStyle = '#CC785C';
    ctx.lineWidth = 2;
    rrPath(ctx, centerX - 140, canvasH * 0.78, 280, 54, 27);
    ctx.stroke();
    // 브랜드 도트
    ctx.fillStyle = '#CC785C';
    ctx.beginPath();
    ctx.arc(centerX - 108, canvasH * 0.78 + 27, 4, 0, Math.PI * 2);
    ctx.fill();
    // 텍스트 (크림 + 스페이싱)
    ctx.font         = '800 15px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.fillStyle    = '#F7F3EB';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHALLENGE  STUDIO · FOLLOW', canvasW / 2 + 12, canvasH * 0.78 + 27);
    ctx.globalAlpha  = 1;
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Zone drawing helpers
// ---------------------------------------------------------------------------

// Scrolling text state per zone
const scrollOffsets: Map<string, number> = new Map();

function drawTopZone(
  ctx: CanvasRenderingContext2D,
  zone: TemplateZone,
  canvasW: number,
): void {
  const zoneH = 76;
  ctx.save();
  ctx.fillStyle = zone.bgColor;
  ctx.fillRect(0, 0, canvasW, zoneH);

  // Logo emoji on left
  if (zone.logoEmoji) {
    ctx.font = '22px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.logoEmoji, 12, zoneH * 0.38);
  }

  // Main text
  ctx.fillStyle = zone.textColor;
  ctx.font = `${zone.bold ? 'bold ' : ''}${zone.fontSize ?? 20}px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(zone.text, canvasW / 2, zoneH * 0.36);

  // Subtext
  if (zone.subtext) {
    ctx.font = `13px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
    ctx.fillStyle = zone.textColor;
    ctx.globalAlpha = 0.85;
    ctx.fillText(zone.subtext, canvasW / 2, zoneH * 0.70);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBottomZone(
  ctx: CanvasRenderingContext2D,
  zone: TemplateZone,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  templateId: string,
): void {
  const zoneH = 52;
  const zoneY = canvasH - zoneH;
  ctx.save();
  ctx.fillStyle = zone.bgColor;
  ctx.fillRect(0, zoneY, canvasW, zoneH);

  ctx.fillStyle = zone.textColor;
  const fontSize = zone.fontSize ?? 15;
  ctx.font = `${fontSize}px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textBaseline = 'middle';

  if (zone.scrolling) {
    // Measure full text width (with spacer for seamless loop)
    const textW = ctx.measureText(zone.text).width;
    const loopW = textW + 60;
    // Phase-based scroll (deterministic, not frame-rate dependent): 80 px/sec
    const SPEED = 80;
    const offset = ((elapsed * SPEED) / 1000) % loopW;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, zoneY, canvasW, zoneH);
    ctx.clip();
    ctx.textAlign = 'left';
    const drawX = canvasW - offset;
    ctx.fillText(zone.text, drawX, zoneY + zoneH / 2);
    ctx.fillText(zone.text, drawX + loopW, zoneY + zoneH / 2);
    ctx.fillText(zone.text, drawX - loopW, zoneY + zoneH / 2);
    ctx.restore();
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(zone.text, canvasW / 2, zoneY + zoneH / 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Text overlay renderer
// ---------------------------------------------------------------------------

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  canvasW: number,
  canvasH: number,
  elapsed: number,
): void {
  const { start_ms, end_ms } = overlay;
  if (elapsed < start_ms || elapsed > end_ms) return;

  const duration = end_ms - start_ms;
  const localT = (elapsed - start_ms) / duration; // 0..1
  const localMs = elapsed - start_ms;

  let alpha = 1;
  let offsetY = 0;
  let offsetX = 0;
  let displayText = overlay.text;

  const ANIM_IN = 0.12;  // first 12% = animation in
  const ANIM_OUT = 0.88; // last 12% = animation out

  // Kinetic word-by-word reveal (CapCut-style) — takes over rendering entirely
  if (overlay.animation === 'kinetic') {
    let kAlpha = 1;
    if (localT > ANIM_OUT) kAlpha = Math.max(0, (1 - localT) / (1 - ANIM_OUT));
    if (kAlpha <= 0) return;
    const words = computeKineticReveal(overlay.text, 0, localMs, 110, 260);
    ctx.save();
    ctx.globalAlpha = kAlpha;
    const cx = overlay.xPct * canvasW;
    const cy = overlay.yPct * canvasH;
    const maxW = Math.min(canvasW - 60, 640);
    drawKineticText(ctx, words, cx, cy, overlay.fontSize, overlay.color, overlay.bold ?? true, maxW);
    ctx.restore();
    return;
  }

  switch (overlay.animation) {
    case 'fade': {
      if (localT < ANIM_IN) alpha = localT / ANIM_IN;
      else if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'slide_up': {
      const slideProgress = Math.min(1, localT / ANIM_IN);
      offsetY = (1 - slideProgress) * 30;
      alpha = slideProgress;
      if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'slide_left': {
      const slideProgress = Math.min(1, localT / ANIM_IN);
      offsetX = (1 - slideProgress) * 60;
      alpha = slideProgress;
      if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'bounce': {
      const bounceProgress = Math.min(1, localT / ANIM_IN);
      const bounce = Math.sin(bounceProgress * Math.PI * 2.5) * (1 - bounceProgress) * 10;
      offsetY = -bounce;
      alpha = bounceProgress;
      if (localT > ANIM_OUT) alpha = Math.max(0, (1 - localT) / (1 - ANIM_OUT));
      break;
    }
    case 'typewriter': {
      // First 30% of duration = type in, rest = stay
      const typeProgress = Math.min(1, localT / 0.30);
      const charCount = Math.floor(typeProgress * overlay.text.length);
      displayText = overlay.text.slice(0, charCount);
      alpha = 1;
      break;
    }
    default:
      break;
  }

  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const x = overlay.xPct * canvasW + offsetX;
  const y = overlay.yPct * canvasH + offsetY;
  const fontSize = overlay.fontSize;
  const fontWeight = overlay.bold ? '900 ' : '600 ';
  // Pro stack: Pretendard (Korean) → Inter (Latin) → system fallbacks
  ctx.font = `${fontWeight}${fontSize}px "Pretendard Variable","Inter","Segoe UI",system-ui,-apple-system,sans-serif`;
  ctx.textBaseline = 'top';

  // Determine text align
  switch (overlay.align) {
    case 'left': ctx.textAlign = 'left'; break;
    case 'right': ctx.textAlign = 'right'; break;
    default: ctx.textAlign = 'center'; break;
  }

  // Background box
  if (overlay.bgColor && displayText.length > 0) {
    const metrics = ctx.measureText(displayText);
    const textW = metrics.width;
    const padX = 10;
    const padY = 5;
    let bgX = x - padX;
    if (overlay.align === 'center') bgX = x - textW / 2 - padX;
    if (overlay.align === 'right') bgX = x - textW - padX;
    rrPath(ctx, bgX, y - padY, textW + padX * 2, fontSize + padY * 2, 6);
    ctx.fillStyle = overlay.bgColor;
    ctx.fill();
  }

  // Outline
  if (overlay.outlineColor) {
    ctx.strokeStyle = overlay.outlineColor;
    ctx.lineWidth = 2;
    ctx.strokeText(displayText, x, y);
  }

  // Main text — with drop shadow for legibility against video
  if (!overlay.bgColor) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
  }
  ctx.fillStyle = overlay.color;
  ctx.fillText(displayText, x, y);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Vignette
// ---------------------------------------------------------------------------

function drawVignette(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
  const grad = ctx.createRadialGradient(
    canvasW / 2, canvasH / 2, canvasH * 0.3,
    canvasW / 2, canvasH / 2, canvasH * 0.78,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

// ---------------------------------------------------------------------------
// Progress bar at bottom
// ---------------------------------------------------------------------------

function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  duration: number,
  accentColor: string,
  bpm: number = 0,
): void {
  const barH = 4;
  const barY = canvasH - barH;
  const progress = Math.min(1, elapsed / duration);
  // Dark track
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, barY, canvasW, barH);
  // Gradient fill
  const grad = ctx.createLinearGradient(0, barY, canvasW, barY);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, barY, canvasW * progress, barH);
  // Leading edge glow dot
  if (progress > 0 && progress < 1) {
    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(canvasW * progress, barY + barH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Beat markers (BGM sync) — small ticks above the bar at each beat
  if (bpm > 0) {
    const beatMs = 60000 / bpm;
    const totalBeats = Math.floor(duration / beatMs);
    const markerY = barY - 6;
    for (let i = 1; i < totalBeats; i++) {
      const bx = (i * beatMs) / duration * canvasW;
      const past = elapsed >= i * beatMs;
      // Accent on every 4th beat
      const isDown = i % 4 === 0;
      ctx.fillStyle = past ? (isDown ? '#ffffff' : accentColor) : 'rgba(255,255,255,0.22)';
      ctx.fillRect(bx - 0.5, markerY, 1, isDown ? 5 : 3);
    }
    // Beat pulse ring on the leading edge at downbeats
    const beatPhase = (elapsed % beatMs) / beatMs;
    const pulseR = 6 + (1 - beatPhase) * 8;
    ctx.save();
    ctx.globalAlpha = (1 - beatPhase) * 0.6;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvasW * progress, barY + barH / 2, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Cycle 7 — Cinematic studio wrap (main phase only):
//   • Top/bottom gradient scrims (readability + CapCut cinematic feel)
//   • Template watermark with tracking
//   • Scrolling hashtag ticker above progress bar
//   • Subtle film grain texture
// ---------------------------------------------------------------------------
function drawStudioWrap(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  template: VideoTemplate,
  elapsed: number,
): void {
  const accent = template.accentColor || '#ffffff';

  // ── Top scrim (for readability of time/overlays) ─────────────────────────
  const topH = 120;
  const topGrad = ctx.createLinearGradient(0, 0, 0, topH);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, topH);

  // ── Bottom scrim (for hashtag ticker + progress bar) ─────────────────────
  const botH = 150;
  const botGrad = ctx.createLinearGradient(0, H - botH, 0, H);
  botGrad.addColorStop(0, 'rgba(0,0,0,0)');
  botGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, H - botH, W, botH);

  // ── Corner cinematic marks (CapCut-style crop guides) ────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const ml = 20; const mi = 16;
  // TL
  ctx.beginPath(); ctx.moveTo(mi, mi + ml); ctx.lineTo(mi, mi); ctx.lineTo(mi + ml, mi); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(W - mi - ml, mi); ctx.lineTo(W - mi, mi); ctx.lineTo(W - mi, mi + ml); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(mi, H - mi - ml); ctx.lineTo(mi, H - mi); ctx.lineTo(mi + ml, H - mi); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(W - mi - ml, H - mi); ctx.lineTo(W - mi, H - mi); ctx.lineTo(W - mi, H - mi - ml); ctx.stroke();
  ctx.restore();

  // ── Top-left: template name watermark (modern tracking) ──────────────────
  ctx.save();
  ctx.font = '600 13px "Inter", "SF Pro Display", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const wmText = (template.name || template.id || '').toUpperCase();
  // Letter-spacing via character-by-character draw
  const wmSpacing = 3;
  let wx = 40;
  const wy = 28;
  for (const ch of wmText.slice(0, 28)) {
    ctx.fillText(ch, wx, wy);
    wx += ctx.measureText(ch).width + wmSpacing;
  }
  // Accent underline bar
  ctx.fillStyle = accent;
  ctx.fillRect(40, wy + 22, 28, 3);
  ctx.restore();

  // ── Top-right: live timecode ─────────────────────────────────────────────
  ctx.save();
  const tcSec = Math.max(0, (elapsed / 1000));
  const tcM = Math.floor(tcSec / 60);
  const tcS = Math.floor(tcSec % 60);
  const tcF = Math.floor((tcSec * 30) % 30);
  const tc = `${tcM.toString().padStart(2, '0')}:${tcS.toString().padStart(2, '0')}:${tcF.toString().padStart(2, '0')}`;
  ctx.font = '600 12px "SF Mono", "Menlo", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // Pill background
  const tcW = ctx.measureText(tc).width + 18;
  rrPath(ctx, W - 40 - tcW, 24, tcW, 22, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tc, W - 50, 29);
  // Red REC dot
  const pulse = 0.6 + 0.4 * Math.sin(elapsed * 0.008);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(W - 40 - tcW - 8, 35, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Hashtag ticker above progress bar ────────────────────────────────────
  if (template.hashtags && template.hashtags.length > 0) {
    const tickerY = H - 24;
    const tagStr = template.hashtags.map(h => '#' + h).join('    •    ') + '    •    ';
    ctx.save();
    ctx.font = '500 12px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const tagW = ctx.measureText(tagStr).width;
    const scroll = (elapsed * 0.04) % tagW;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    // Draw twice so it wraps seamlessly
    ctx.fillText(tagStr, -scroll, tickerY);
    ctx.fillText(tagStr, -scroll + tagW, tickerY);
    ctx.restore();
  }

  // ── Subtle film grain (low-alpha noise dots) ─────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#ffffff';
  // Seeded by time so it shimmers
  const seed = Math.floor(elapsed / 33);
  for (let i = 0; i < 60; i++) {
    // Deterministic pseudo-random based on seed + i
    const r = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const rx = ((r - Math.floor(r)) * W);
    const r2 = Math.sin(seed * 39.346 + i * 11.135) * 21732.123;
    const ry = ((r2 - Math.floor(r2)) * H);
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main compositor helpers
// ---------------------------------------------------------------------------

function layeredToLegacy(lt: LayeredTemplate): VideoTemplate {
  const map: Record<string, string> = {
    neon_cyberpunk: 'kpop',
    cinematic_news: 'news',
    pop_candy: 'vlog',
    warm_asmr: 'english',
    luxury_night: 'hiphop',
  };
  const style = map[lt.mood] || 'vlog';
  const colors: Record<string, string> = {
    kpop: '#e94560', news: '#1565c0', vlog: '#7c3aed', english: '#3498db', hiphop: '#f7b731',
  };

  return {
    id: lt.id,
    name: lt.title,
    style: style as any,
    accentColor: colors[style] || '#7c3aed',
    gradientColors: [colors[style] || '#7c3aed', '#000000'],
    bgStyle: style as any,
    duration_ms: lt.duration * 1000,
    bgm: {
      // FIX-Z21 (2026-04-22): 레이어드 템플릿이 명시한 src 를 그대로 레거시로 전달.
      //   mood→style→genre 의 불완전 매핑으로 `vlog` 같은 미등록 분기가 null 을 만들어
      //   emoji-explosion 등이 무음이 되던 문제 해결.
      src: lt.bgm.src,
      genre: style as any,
      bpm: 128,
      volume: lt.bgm.volume,
    },
    clipArea: { xPct: 0.1, yPct: 0.15, wPct: 0.8, hPct: 0.7, borderRadius: 20 },
    clip_slots: [
      { id: 'main', start_ms: 0, end_ms: lt.duration * 1000 },
    ],
    text_overlays: [],
    hashtags: lt.hashtags || [],
  };
}

// FIX-Z22 (2026-04-22): 테스트에서 각 템플릿 시점별 합성 결과 차별화를
// 검증하기 위해 export. 기존 내부 호출 경로에는 영향 없음.
export function renderLayeredFrame(
  ctx: CanvasRenderingContext2D,
  template: LayeredTemplate,
  tMs: number,
  state: { videoEl?: HTMLVideoElement }
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const sortedLayers = [...template.layers].sort((a, b) => a.zIndex - b.zIndex);

  // Focused Session-3 Candidate G: liveState 병합 — speechTranscript/beatIntensity/missionState
  // 레이어 렌더러가 state 에서 읽을 수 있도록 주입. 호출자 state 키가 있으면 그 값이 우선.
  const mergedState = mergeLiveIntoState(state as Record<string, unknown>);

  for (const layer of sortedLayers) {
    if (!layer.enabled) continue;
    
    // Check active range
    if (layer.activeRange) {
      const tSec = tMs / 1000;
      if (tSec < layer.activeRange.startSec || tSec > layer.activeRange.endSec) {
        continue;
      }
    }

    // Focused Session-2 Candidate E: dispatcher 경유 — 단일 지점에서 타입→렌더러 해석.
    const fn = dispatchLayer(layer.type);
    if (!fn) continue;   // 미지원 타입은 조용히 스킵
    try {
      fn(ctx, layer, tMs, mergedState);
    } catch (e) {
      console.warn(`[Compositor] Error rendering layer ${layer.id}:`, e);
    }
  }

  // Focused Session-2 Candidate F: 모든 레이어 렌더 후 템플릿 postProcess 체인 적용.
  // bloom / vignette / film_grain 만 이번 세션 대상 (Canvas 2D 폴백).
  try {
    applyTemplatePostProcess(
      ctx,
      (template as unknown as { postProcess?: Array<{ kind: string } & Record<string, unknown>> }).postProcess,
      tMs,
      mergedState as { beatIntensity?: number },
    );
  } catch (e) {
    console.warn('[Compositor] postProcess chain failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Main compositor
// ---------------------------------------------------------------------------

export async function composeVideo(
  templateOrLayered: VideoTemplate | LayeredTemplate,
  clips: RecordedClip[],
  onProgress: (p: CompositorProgress) => void,
): Promise<Blob> {
  const isLayered = 'layers' in templateOrLayered;
  
  // For legacy internal logic, we might still need a VideoTemplate mapping
  const legacyTemplate = isLayered 
    ? layeredToLegacy(templateOrLayered as LayeredTemplate)
    : templateOrLayered as VideoTemplate;

  return new Promise<Blob>((resolve, reject) => {
    if (!clips || clips.length === 0) {
      reject(new Error('No clips provided'));
      return;
    }

    const clip = clips[0];
    const clipUrl = URL.createObjectURL(clip.blob);
    const video = document.createElement('video');
    video.src = clipUrl;
    // FIX-V (2026-04-22): 합성 중 source video 는 **반드시 muted**.
    //   muted=false 면 HTMLMediaElement 가 기본 스피커로 오디오를 재생해
    //   유저가 "시킨적도 없는데 촬영 음성이 자동 재생" 현상 발생.
    //   muted 해도 createMediaElementSource 로 뽑은 오디오는 destination 에 들어가므로
    //   최종 합성 mp4 에는 원본 마이크 음성이 정상 포함된다.
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    scrollOffsets.clear();

    const TIMEOUT_MS = 8 * 60 * 1000;
    let timeoutId: ReturnType<typeof setTimeout>;
    let rafId = 0;
    let audioCtx: AudioContext | null = null;
    let bgmHandle: SimpleBGMHandle | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let startTime = 0;
    let lastFrameTime = 0;
    const chunks: Blob[] = [];
    let finished = false;
    let videoStarted = false;
    let videoStopped = false;

    function cleanup() {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      bgmHandle?.stop();
      try { audioCtx?.close(); } catch (_) {}
      URL.revokeObjectURL(clipUrl);
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Compositor timeout'));
    }, TIMEOUT_MS);

    function renderFrame(now: DOMHighResTimeStamp) {
      if (finished) return;

      const elapsed = now - startTime;
      const duration = isLayered 
        ? (templateOrLayered as LayeredTemplate).duration * 1000
        : legacyTemplate.duration_ms;

      if (now - lastFrameTime < FRAME_MS - 1) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      lastFrameTime = now;

      if (elapsed >= duration) {
        mediaRecorder?.stop();
        return;
      }

      onProgress({
        phase: '🎥 영상 합성 중...',
        percent: Math.min(99, Math.round((elapsed / duration) * 100)),
      });

      if (isLayered) {
        renderLayeredFrame(ctx, templateOrLayered as LayeredTemplate, elapsed, { videoEl: video });
      } else {
        // --- 1. Background gradient ---
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, legacyTemplate.gradientColors[0]);
        bgGrad.addColorStop(1, legacyTemplate.gradientColors[1]);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // FIX-Z16 (2026-04-22): 장르별 다이내믹 그라디언트 오버레이
        try {
          const pal = getGenrePalette(legacyTemplate.bgStyle);
          drawGenreBackground(ctx, W, H, elapsed, pal);
        } catch {}

        // --- 2. Scene background ---
        switch (legacyTemplate.bgStyle) {
          case 'vlog': drawVlogScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'news': drawNewsScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'kpop': drawKpopScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'fitness': drawFitnessScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'travel': drawTravelScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'hiphop': drawHiphopScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'english': drawEnglishScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
          case 'fairy': drawFairyScene(ctx, W, H, elapsed, legacyTemplate.accentColor); break;
        }

        // --- 3. Main Clip Area ---
        const mainStart = INTRO_MS;
        const mainEnd   = duration - OUTRO_MS;
        
        if (elapsed < mainStart) {
          drawIntroFrame(ctx, legacyTemplate, elapsed, W, H);
        } else if (elapsed >= mainEnd) {
          drawOutroFrame(ctx, legacyTemplate, elapsed - mainEnd, W, H);
        } else {
          const ca = legacyTemplate.clipArea;
          const cx = ca.xPct * W; const cy = ca.yPct * H;
          const cw = ca.wPct * W; const ch = ca.hPct * H;
          
          ctx.save();
          // FIX-Z16: 장르별 프레이밍 (원형/하트/둥근사각) — 기본은 rrPath
          const framed = applyGenreFraming(ctx, legacyTemplate.bgStyle, cx, cy, cw, ch, ca.borderRadius);
          if (!framed) {
            rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
            ctx.clip();
          }
          try {
            const vw = video.videoWidth || 720;
            const vh = video.videoHeight || 1280;
            const srcAR = vw / vh; const dstAR = cw / ch;
            let sx = 0, sy = 0, sw = vw, sh = vh;
            if (srcAR > dstAR) { sw = vh * dstAR; sx = (vw - sw) / 2; }
            else { sh = vw / dstAR; sy = (vh - sh) / 2; }
            ctx.drawImage(video, sx, sy, sw, sh, cx, cy, cw, ch);
          } catch (_) {
            ctx.fillStyle = '#000'; ctx.fillRect(cx, cy, cw, ch);
          }
          ctx.restore();

          drawClipFrame(ctx, legacyTemplate.bgStyle, cx, cy, cw, ch, ca.borderRadius, legacyTemplate.accentColor, elapsed);

          // FIX-Z16: 뉴스 템플릿용 우측 "속보" 스트립
          try {
            if (legacyTemplate.bgStyle === 'news') {
              const palN = getGenrePalette('news');
              drawNewsBreakingStrip(ctx, W, H, elapsed, palN);
            }
          } catch {}
        }
      }

      // FIX-Z15 (2026-04-22): 범용 시네마틱 액센트 레이어.
      //   모든 템플릿에 공통 적용되는 후처리 고도화 — BGM bpm 에 맞춘 펄스,
      //   상승 입자, 비트 플래시, 비네트 컬러 액센트.
      try {
        if (!isLayered && elapsed >= INTRO_MS && elapsed < (duration - OUTRO_MS)) {
          drawCinematicAccents(
            ctx, W, H,
            elapsed - INTRO_MS,
            legacyTemplate.accentColor,
            legacyTemplate.bgm?.bpm ?? 120,
          );
        }
      } catch (e) { try { console.warn('[compositor] accents error:', e); } catch {} }

      // FIX-Z16 (2026-04-22): 장르별 스티커 레이어 + 오디오 바 비주얼라이저
      try {
        if (!isLayered && elapsed >= INTRO_MS && elapsed < (duration - OUTRO_MS)) {
          const pal = getGenrePalette(legacyTemplate.bgStyle);
          const bpm = legacyTemplate.bgm?.bpm ?? 120;
          drawStickers(ctx, W, H, elapsed - INTRO_MS, legacyTemplate.bgStyle, bpm);
          drawAudioBars(ctx, W, H, elapsed - INTRO_MS, pal, bpm);
        }
      } catch (e) { try { console.warn('[compositor] stickers/bars error:', e); } catch {} }

      // FIX-Z15 (2026-04-22): non-layered main 구간에 text_overlays 타임라인 렌더.
      //   기존엔 drawTextOverlay 정의만 있고 호출이 없어서 자막이 mp4 에 박히지 않았다.
      //   사용자 피드백: "화면 효과, 이미지, 이팩트, 자막 여러 레이어로"
      try {
        if (!isLayered && legacyTemplate.text_overlays && elapsed >= INTRO_MS && elapsed < (duration - OUTRO_MS)) {
          const pal = getGenrePalette(legacyTemplate.bgStyle);
          for (const ov of legacyTemplate.text_overlays) {
            // FIX-Z16: 자막 진입 애니 + 액센트 1px 라인 + 장르별 폰트 사이즈 보정
            if (elapsed >= ov.start_ms && elapsed <= ov.end_ms) {
              const localT = (elapsed - ov.start_ms) / Math.max(1, (ov.end_ms - ov.start_ms));
              const ANIM_IN = 0.12;
              const riseOffset = localT < ANIM_IN ? (1 - localT / ANIM_IN) * 18 : 0;
              const lineAlpha = Math.min(1, localT / ANIM_IN) * 0.85;
              if (!ov.bgColor) {
                // 기본 bgColor 없는 자막 아래에만 얇은 액센트 라인
                ctx.save();
                ctx.globalAlpha = lineAlpha;
                const xx = ov.xPct * W;
                const yy = ov.yPct * H + ov.fontSize + 6 + riseOffset;
                const lineW = Math.min(W * 0.55, 340);
                const lx = ov.align === 'left' ? xx : (ov.align === 'right' ? xx - lineW : xx - lineW / 2);
                ctx.fillStyle = pal.accent;
                ctx.fillRect(lx, yy, lineW, 1.5);
                ctx.restore();
              }
            }
            // 장르별 폰트 사이즈 보정 (원본 수정 금지 → 임시 래퍼)
            const boosted: TextOverlay = {
              ...ov,
              fontSize: Math.max(14, ov.fontSize + pal.textFontSize),
              bold: ov.bold ?? pal.textWeightBoost,
            };
            drawTextOverlay(ctx, boosted, W, H, elapsed);
          }
        }
      } catch (e) { try { console.warn('[compositor] text_overlays draw error:', e); } catch {} }

      // FIX-Z15: 해시태그 스트립 (main 구간 하단, outro 이전)
      try {
        if (!isLayered && legacyTemplate.hashtags?.length && elapsed >= INTRO_MS && elapsed < (duration - OUTRO_MS)) {
          const tags = legacyTemplate.hashtags.slice(0, 4).map(t => '#' + t).join('  ');
          ctx.save();
          ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
          const m = ctx.measureText(tags);
          const pad = 14;
          const bw = m.width + pad * 2;
          const bh = 40;
          const bx = (W - bw) / 2;
          const by = H - 110;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          rrPath(ctx, bx, by, bw, bh, 14);
          ctx.fill();
          ctx.strokeStyle = legacyTemplate.accentColor + 'aa';
          ctx.lineWidth = 1.5;
          rrPath(ctx, bx, by, bw, bh, 14);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText(tags, W / 2, by + bh / 2);
          ctx.restore();
        }
      } catch {}

      // Cinematic post-processing (Post-process is always applied for consistency)
      drawFilmGrain(ctx, W, H, elapsed, 0.05);
      drawVignette(ctx, W, H);
      drawProgressBar(ctx, W, H, elapsed, duration, legacyTemplate.accentColor, legacyTemplate.bgm?.bpm ?? 0);

      // Playback control
      if (!isLayered) {
        if (elapsed >= INTRO_MS && !videoStarted) {
          videoStarted = true;
          video.play().catch(e => console.warn(e));
        }
        if (elapsed >= (duration - OUTRO_MS) && !videoStopped) {
          videoStopped = true;
          video.pause();
        }
      } else {
        if (!videoStarted) {
          videoStarted = true;
          video.play().catch(e => console.warn(e));
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    }

    video.addEventListener('loadedmetadata', () => {
      (async () => {
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        // FIX-Z8: 실제 MP3 파일 우선 사용, 실패 시 oscillator 합성 폴백.
        // FIX-Z17 (2026-04-22): layered 경로에도 인트로 duck → 타이틀 등장 싱크 맞춤.
        //   레이어드 템플릿 인트로는 2.5s (각 템플릿 intro_title activeRange 기준),
        //   duration 은 템플릿 자체의 duration*1000 을 우선 사용.
        const layeredIntroMs = 2500;
        const layeredDurationMs = isLayered
          ? Math.round((templateOrLayered as LayeredTemplate).duration * 1000)
          : legacyTemplate.duration_ms;
        const bgmOpts = {
          introMs: isLayered ? layeredIntroMs : INTRO_MS,
          totalMs: layeredDurationMs,
        };
        const fileBgm = await createFileBGM(audioCtx, legacyTemplate.bgm, dest, bgmOpts);
        bgmHandle = fileBgm ?? createSimpleBGM(audioCtx, legacyTemplate.bgm, dest, bgmOpts);

        // FIX-Y10 (2026-04-22): 원본 마이크 음성 복원.
        //   이전(FIX-Y1): createMediaElementSource 가 일부 브라우저에서 blob URL +
        //     crossOrigin + muted 조합으로 실패 → video 'error' → "Video load error".
        //   해결: video element 를 경유하지 않고, blob 자체를 decodeAudioData 로 디코드해
        //     AudioBufferSourceNode 로 스케줄. video 는 순수 비디오 렌더용으로만 사용.
        //   BGM 이 합성 시작 시점(now) 에 맞춰 재생되므로, 마이크 오디오도 동일하게
        //     audioCtx.currentTime 기준으로 start(0) 로 맞춘다.
        try {
          const clipArrayBuffer = await clip.blob.arrayBuffer();
          // decodeAudioData 는 일부 브라우저에서 ArrayBuffer 를 consume(detach) 하므로
          //   복사본 만들 필요 없음 (Chrome/Safari 공통). 실패 시 catch 에서 폴백.
          const audioBuffer = await audioCtx.decodeAudioData(clipArrayBuffer.slice(0));
          const src = audioCtx.createBufferSource();
          src.buffer = audioBuffer;
          const micGain = audioCtx.createGain();
          micGain.gain.value = 1.0;  // 마이크 음성 원음
          src.connect(micGain).connect(dest);
          // video.currentTime 과 동기: video.play() 가 조만간 호출될 것이므로
          //   시작 시점을 0 으로 맞춘다. 약간의 드리프트 (~10ms) 허용 범위.
          src.start(0);
        } catch (decodeErr) {
          // webm/opus 를 일부 Safari 구버전에서 decodeAudioData 실패 가능.
          //   실패 시 BGM 만 합성 (기존 FIX-Y1 동작과 동일).
          try { console.warn('[compositor] mic audio decode failed, BGM-only:', decodeErr); } catch {}
        }

        const canvasStream = canvas.captureStream(FPS);
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

        // FIX-KAKAO-HANG (2026-04-24): route through the canonical MIME picker
        //   (engine/recording/codecNegotiator.pickRecordingMimeType), which uses
        //   MIME_CANDIDATES order — mp4/H.264 first, webm last. The previous
        //   inline list drifted out of sync and produced webm on newer Android
        //   Chrome builds that *do* support mp4.
        const chosenMime = pickRecordingMimeType() || '';

        mediaRecorder = new MediaRecorder(canvasStream, {
          mimeType: chosenMime || undefined,
          videoBitsPerSecond: 3500000
        });

        // Surface what the MediaRecorder actually chose — this is the most
        // reliable signal for field debugging (mediaRecorder.mimeType may
        // differ from `chosenMime` if the browser renegotiates).
        try {
          // eslint-disable-next-line no-console
          console.info('[compositor] recorder started', {
            requested: chosenMime,
            actual: mediaRecorder.mimeType,
            videoBitsPerSecond: 3500000,
          });
        } catch {}

        mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
          finished = true;
          cleanup();
          onProgress({ phase: '완료!', percent: 100 });
          const actualMime = mediaRecorder?.mimeType || chosenMime || 'video/webm';
          const blob = new Blob(chunks, { type: actualMime });
          try {
            // eslint-disable-next-line no-console
            console.info('[compositor] compose done', {
              mime: actualMime,
              size: blob.size,
              sizeMB: (blob.size / (1024 * 1024)).toFixed(2),
              chunkCount: chunks.length,
            });
            // Expose for /debug/share — lets user test their ACTUAL composed
            // file without re-recording.
            if (typeof window !== 'undefined') {
              (window as any).__lastComposedVideo = blob;
              (window as any).__lastComposedMime = actualMime;
              (window as any).__lastComposedAt = Date.now();
            }
          } catch {}
          resolve(blob);
        };

        mediaRecorder.start(100);
        startTime = performance.now();
        lastFrameTime = startTime;
        rafId = requestAnimationFrame(renderFrame);
      } catch (err) {
        cleanup();
        reject(err);
      }
      })();
    });

    video.addEventListener('error', (e) => {
      cleanup();
      reject(new Error(`Video load error: ${String(e)}`));
    });
  });
}
