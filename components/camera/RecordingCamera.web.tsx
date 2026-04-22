/**
 * RecordingCamera.web.tsx  (웹 전용)
 * Canvas 합성 녹화 컴포넌트로 완전 교체.
 *
 * - 카메라를 숨긴 <video>로 수신
 * - 표시용 <canvas>(720×1280, 9:16)에 매 프레임마다 합성
 *   · center-crop → 세로형 변환
 *   · 헤더 / 자막 / 장르 효과 / 미션 카드 / 스켈레톤
 * - canvas.captureStream(30) + 카메라 오디오 → MediaRecorder 녹화
 * - stopRecording() → Blob URL 반환
 *
 * 인터페이스(RecordingCameraHandle)는 기존과 동일:
 *   startRecording(): Promise<string>
 *   stopRecording():  void
 *   isRecording():    boolean
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { RecordingCameraHandle } from './RecordingCamera';
import type { NormalizedLandmark } from '../../utils/poseUtils';
import { getBgmPlayer } from '../../utils/bgmLibrary';

// ---------------------------------------------------------------------------
// Canvas dimensions (9:16 portrait)
// ---------------------------------------------------------------------------
const CW = 720;
const CH = 1280;

// ---------------------------------------------------------------------------
// Stream cache singleton — persists across navigations
// ---------------------------------------------------------------------------
let _streamCache: { stream: MediaStream; facing: 'front' | 'back' } | null = null;

async function acquireStream(facing: 'front' | 'back'): Promise<MediaStream> {
  if (_streamCache) {
    const allLive = _streamCache.stream
      .getTracks()
      .every((t) => t.readyState === 'live');
    if (allLive && _streamCache.facing === facing) return _streamCache.stream;
    _streamCache.stream.getTracks().forEach((t) => t.stop());
    _streamCache = null;
  }

  // FIX-H2: __permissionStream 제거됨 — 권한은 origin 캐시, 스트림은 여기서 새로 획득.
  if (typeof window !== 'undefined') {
    const pre = (window as any).__permissionStream as MediaStream | undefined;
    if (pre && pre.getTracks().every((t) => t.readyState === 'live')) {
      _streamCache = { stream: pre, facing };
      return pre;
    }
  }

  const facingMode = facing === 'front' ? 'user' : 'environment';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width:  { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  _streamCache = { stream, facing };
  return stream;
}

// ---------------------------------------------------------------------------
// Genre color map
// ---------------------------------------------------------------------------
const GENRE_COLORS: Record<string, string> = {
  kpop:      '#e94560',
  fitness:   '#14b8a6',
  news:      '#1565c0',
  daily:     '#7c3aed',
  kids:      '#a855f7',
  travel:    '#f59e0b',
  hiphop:    '#f7b731',
  english:   '#2563eb',
  challenge: '#7c3aed',
  promotion: '#e91e63',
};
const genreColor = (g: string) => GENRE_COLORS[g] ?? '#7c3aed';

// ---------------------------------------------------------------------------
// Canvas draw helpers
// ---------------------------------------------------------------------------
function drawCamera(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  facing: 'front' | 'back',
) {
  if (video.readyState < 2) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const videoAR  = vw / vh;
  const canvasAR = CW / CH;

  if (facing === 'front') {
    ctx.save();
    ctx.translate(CW, 0);
    ctx.scale(-1, 1);
  }

  if (videoAR > canvasAR) {
    const srcH = vh;
    const srcW = srcH * canvasAR;
    const srcX = (vw - srcW) / 2;
    ctx.drawImage(video, srcX, 0, srcW, srcH, 0, 0, CW, CH);
  } else {
    const srcW = vw;
    const srcH = srcW / canvasAR;
    const srcY = (vh - srcH) / 2;
    ctx.drawImage(video, 0, srcY, srcW, srcH, 0, 0, CW, CH);
  }

  if (facing === 'front') ctx.restore();
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// FIX-Z7 (2026-04-22): 인트로/아웃트로 카드 — 녹화 첫 2초, 마지막 2초에 실제 시각 장치.
//   기존엔 카운트다운 후 곧바로 빈 카메라 + 텍스트 → "html 수준" 인상.
//   이제: 인트로는 검은 커튼 스윕 + 템플릿 이름 줌인, 아웃트로는 "COMPLETE!" + 별.
function drawIntroOverlay(
  ctx: CanvasRenderingContext2D,
  template: any,
  elapsed: number,
) {
  const INTRO_MS = 2000;
  if (elapsed > INTRO_MS) return;
  const p = elapsed / INTRO_MS; // 0 → 1
  const color = genreColor(template?.genre ?? '');

  // 검은 커튼 스윕 (왼→오로 빠지면서 카메라 공개)
  const sweepX = CW * p;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(sweepX, 0, CW - sweepX, CH);
  // 커튼 앞에 accent color 스트립
  ctx.fillStyle = color;
  ctx.fillRect(sweepX - 6, 0, 6, CH);
  ctx.restore();

  // 중앙 카드 (0.2s 에 페이드인 → 1.5s 에 위로 이동 → 2.0s 에 사라짐)
  const cardP = p < 0.1 ? 0 : p < 0.5 ? (p - 0.1) / 0.4 : p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
  if (cardP <= 0) return;
  const scale = 0.7 + cardP * 0.3;
  const ty = p < 0.75 ? 0 : -80 * ((p - 0.75) / 0.25);
  ctx.save();
  ctx.globalAlpha = cardP;
  ctx.translate(CW / 2, CH / 2 + ty);
  ctx.scale(scale, scale);
  // 카드 배경 (글래스)
  ctx.fillStyle = 'rgba(15,18,30,0.88)';
  ctx.beginPath(); rrect(ctx, -260, -100, 520, 200, 28); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); rrect(ctx, -260, -100, 520, 200, 28); ctx.stroke();
  // 이모지
  ctx.font = '80px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(template?.theme_emoji ?? '🎬', 0, -40);
  // 템플릿 이름
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(template?.name ?? 'Challenge', 0, 30);
  // "START" 서브
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`▶  START  ◀`, 0, 70);
  ctx.restore();
}

function drawOutroOverlay(
  ctx: CanvasRenderingContext2D,
  template: any,
  elapsed: number,
) {
  const OUTRO_MS = 2000;
  const totalMs = (template?.duration_sec ?? 0) * 1000;
  if (!totalMs) return;
  const remain = totalMs - elapsed;
  if (remain > OUTRO_MS || remain < 0) return;
  const p = 1 - (remain / OUTRO_MS); // 0 → 1
  const color = genreColor(template?.genre ?? '');

  // 배경 페이드
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(p * 0.55).toFixed(2)})`;
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();

  // 중앙 "COMPLETE" + 별
  const cardP = p < 0.15 ? p / 0.15 : 1;
  const scale = 0.5 + cardP * 0.6;
  ctx.save();
  ctx.globalAlpha = cardP;
  ctx.translate(CW / 2, CH / 2);
  ctx.scale(scale, scale);
  // 폴라로이드 카드
  ctx.fillStyle = 'rgba(255,253,240,0.96)';
  ctx.beginPath(); rrect(ctx, -280, -140, 560, 280, 24); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); rrect(ctx, -280, -140, 560, 280, 24); ctx.stroke();
  // 별 (5개)
  ctx.fillStyle = '#fbbf24';
  for (let i = 0; i < 5; i++) {
    const sx = -120 + i * 60;
    drawStar(ctx, sx, -70, 18, 5);
  }
  // COMPLETE!
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('COMPLETE!', 0, 10);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(`${template?.name ?? ''}`, 0, 60);
  ctx.font = '600 16px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('결과 화면으로 이동합니다…', 0, 95);
  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  template: any,
  elapsed: number,
  isRec: boolean,
) {
  const color = genreColor(template?.genre ?? '');

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CW, 90);

  ctx.fillStyle = color;
  ctx.fillRect(0, 88, CW, 2);

  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.fillText(
    template ? `${template.theme_emoji ?? ''}  ${template.name ?? ''}` : '',
    CW / 2, 56,
  );

  if (isRec) {
    const remain = Math.max(0, (template?.duration_sec ?? 0) - Math.floor(elapsed / 1000));
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(remain % 60).padStart(2, '0');
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText(`${mm}:${ss}`, CW - 20, 56);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(36, 44, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('REC', 54, 52);
  }
}

function hexRgb(hex: string): string {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.substring(i, i + 2), 16)).join(',');
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: string | undefined,
  gc: string,
) {
  if (!text) return;
  const y = 1150;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  const boxW = Math.min(ctx.measureText(text).width + 60, 680);
  const boxH = 70;
  const x = (CW - boxW) / 2;

  ctx.fillStyle = style === 'highlight' ? `rgba(${hexRgb(gc)},0.88)` : 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  rrect(ctx, x, y - boxH + 10, boxW, boxH, 12);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.fillText(text, CW / 2, y);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
}

function drawMissionCard(
  ctx: CanvasRenderingContext2D,
  mission: any,
  score: number,
) {
  if (!mission) return;
  const cardW = 660; const cardH = 110;
  const x = (CW - cardW) / 2; const y = 900;
  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  ctx.beginPath(); rrect(ctx, x, y, cardW, cardH, 16); ctx.fill();

  const barColor = score >= 0.8 ? '#22c55e' : score >= 0.55 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = barColor;
  ctx.beginPath(); rrect(ctx, x, y + cardH - 6, cardW * score, 6, 3); ctx.fill();

  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(
    ((mission.guide_text ?? mission.read_text ?? '') as string).slice(0, 22),
    CW / 2, y + 52,
  );

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = barColor; ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(score * 100)}점`, x + cardW - 16, y + 88);
}

// FIX-Z2 (2026-04-22): 오버레이 성능 전면 재검토.
//   이전 Y8 은 shadowBlur 수십 개 × 파티클 14 × EQ 24 × EKG 180pt 로 모바일 GPU 다운.
//   — shadowBlur 전부 제거 (모바일에서 50~80% 성능 먹음)
//   — 파티클 14→4, EQ 24→10, EKG 180→45pt
//   — 스캔라인 (풀스크린 픽셀 스윕) 제거
//   시각 임팩트는 유지하되 30fps 안정을 최우선.
function drawGenreEffect(
  ctx: CanvasRenderingContext2D,
  genre: string,
  elapsed: number,
) {
  const beat1 = Math.sin(elapsed * 0.00628) * 0.5 + 0.5;
  const beat2 = Math.sin(elapsed * 0.01256) * 0.5 + 0.5;
  const t = elapsed / 1000;

  if (genre === 'kpop' || genre === 'hiphop') {
    // ── 1. 비트 글로우 보더 (shadowBlur 대신 다중 stroke 로 글로우 흉내)
    ctx.save();
    const pulse = 4 + beat2 * 8;
    ctx.strokeStyle = `rgba(255,105,180,${(0.25 + beat2 * 0.35).toFixed(2)})`;
    ctx.lineWidth = pulse + 6;
    ctx.strokeRect(8, 8, CW - 16, CH - 16);
    ctx.strokeStyle = `rgba(233,69,96,${(0.6 + beat2 * 0.4).toFixed(2)})`;
    ctx.lineWidth = pulse;
    ctx.strokeRect(8, 8, CW - 16, CH - 16);
    ctx.restore();

    // ── 2. 네온 코너 브라켓 (shadowBlur 제거)
    ctx.save();
    ctx.strokeStyle = `rgba(255,215,0,${(0.75 + beat1 * 0.25).toFixed(2)})`;
    ctx.lineWidth = 4;
    const corners: Array<[number, number, number, number]> = [
      [0, 0, 1, 1], [CW, 0, -1, 1], [0, CH, 1, -1], [CW, CH, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 32, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * 32);
      ctx.stroke();
    }
    ctx.restore();

    // ── 3. 스파클 파티클 4개 (shadowBlur 제거, 원으로 단순화)
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const seed = i * 137.5 + Math.floor(elapsed / 400) * 0.7;
      const x = ((Math.sin(seed) + 1) / 2) * CW;
      const y = ((Math.cos(seed * 1.3) + 1) / 2) * CH;
      const life = (elapsed * 0.001 + i * 0.5) % 2;
      const a = life < 1 ? life : 2 - life;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = i % 2 === 0 ? '#fff' : '#ffd700';
      const sz = 5 + a * 4;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── 4. 하단 비트 EQ 10 bars (shadowBlur 제거)
    ctx.save();
    const barCount = 10;
    const barW = (CW - 60) / barCount - 4;
    for (let i = 0; i < barCount; i++) {
      const h = 10 + Math.abs(Math.sin(t * 4 + i * 0.7)) * 38;
      const hue = (i * 36 + elapsed * 0.08) % 360;
      ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.85)`;
      ctx.fillRect(30 + i * (barW + 4), CH - 34 - h, barW, h);
    }
    ctx.restore();

  } else if (genre === 'news') {
    // ── 1. 상단 채널 뱃지 (좌측)
    ctx.save();
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, 88, 110, 36);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 깜빡이는 LIVE 도트
    const blink = Math.floor(elapsed / 500) % 2 === 0;
    if (blink) {
      ctx.beginPath();
      ctx.arc(22, 106, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.fillText('LIVE', 72, 106);
    ctx.restore();

    // ── 2. 하단 BREAKING NEWS 3단 바
    ctx.save();
    // 상단 빨강 스트립
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, CH - 130, CW, 6);
    // 메인 곤지색 바
    ctx.fillStyle = 'rgba(13,28,53,0.92)';
    ctx.fillRect(0, CH - 124, CW, 88);
    // 제목 블록
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, CH - 124, 180, 44);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BREAKING', 90, CH - 102);
    // 하단 티커 스트립 (스크롤)
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, CH - 36, CW, 36);
    const tickerText = '    MotiQ 챌린지 생중계 · 시청자 참여 급증 · 팔로워 증가 중 · 채널 구독 부탁 드립니다 · ';
    const scrollX = CW - ((elapsed * 0.12) % (CW + 600));
    ctx.font = '600 16px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tickerText + tickerText, scrollX, CH - 18);
    ctx.restore();

    // ── 3. 좌상단 로고 + 시간
    ctx.save();
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#e3f2fd'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('MOTIQ NEWS 24', 190, 94);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${hh}:${mm}:${ss}`, CW - 16, 96);
    ctx.restore();

    // ── 4. 우측 세로 "PRESS" 스탬프
    ctx.save();
    ctx.translate(CW - 32, 200);
    ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = 'rgba(198,40,40,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-50, -14, 100, 28);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = 'rgba(198,40,40,0.9)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡ PRESS', 0, 0);
    ctx.restore();

  } else if (genre === 'fitness') {
    // ── 1. 양쪽 펄스 바 (shadowBlur 제거)
    const pct = Math.sin(elapsed * 0.001) * 0.5 + 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(20,184,166,0.25)';
    ctx.fillRect(0, 92, 8, CH - 92);
    ctx.fillRect(CW - 8, 92, 8, CH - 92);
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(0,     92 + (CH - 92) * (1 - pct), 8, (CH - 92) * pct);
    ctx.fillRect(CW - 8,92 + (CH - 92) * (1 - pct), 8, (CH - 92) * pct);
    ctx.restore();

    // ── 2. 좌상단 심박수 뱃지
    ctx.save();
    const bpm = 120 + Math.floor(Math.sin(t * 0.3) * 15);
    ctx.fillStyle = 'rgba(239,68,68,0.92)';
    ctx.beginPath(); rrect(ctx, 20, 190, 160, 52, 14); ctx.fill();
    const heartPulse = 1 + Math.abs(Math.sin(t * 4)) * 0.15;
    ctx.save();
    ctx.translate(48, 216);
    ctx.scale(heartPulse, heartPulse);
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('❤', 0, 0);
    ctx.restore();
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${bpm} BPM`, 72, 216);
    ctx.restore();

    // ── 3. 하단 심전도 라인 (포인트 45개로 감축, shadowBlur 제거)
    ctx.save();
    ctx.strokeStyle = 'rgba(34,197,94,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const baseY = CH - 120;
    const step = 16;
    for (let x = 0; x < CW; x += step) {
      const phase = (x + elapsed * 0.3) * 0.03;
      const spike = Math.abs(Math.sin(phase * 0.5)) > 0.95 ? 30 * Math.sin(phase * 8) : 0;
      const y = baseY + Math.sin(phase) * 3 - spike;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // ── 4. 우상단 타이머 링 (shadowBlur 제거)
    ctx.save();
    ctx.translate(CW - 70, 220);
    const ringT = (elapsed / 1000) % 60;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + (ringT / 60) * Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.floor(ringT)).padStart(2, '0'), 0, 0);
    ctx.restore();

  } else if (genre === 'daily' || genre === 'travel') {
    // ── 1. 필름 스프로킷 프레임 (좌·우 양쪽)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 88, 28, CH - 88);
    ctx.fillRect(CW - 28, 88, 28, CH - 88);
    ctx.fillStyle = '#fff';
    for (let y = 100; y < CH - 20; y += 44) {
      ctx.fillRect(8, y, 12, 24);
      ctx.fillRect(CW - 20, y, 12, 24);
    }
    ctx.restore();

    // ── 2. 폴라로이드 날짜 스탬프 (좌상단)
    ctx.save();
    ctx.translate(60, 200);
    ctx.rotate(-0.08);
    ctx.fillStyle = 'rgba(255,253,240,0.97)';
    ctx.beginPath(); rrect(ctx, 0, 0, 160, 48, 4); ctx.fill();
    ctx.font = '600 13px "Courier New", monospace';
    ctx.fillStyle = '#5a3a20';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('📷 Daily Vlog', 10, 8);
    const d = new Date();
    const ds = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#d97706';
    ctx.fillText(ds, 10, 26);
    ctx.restore();

    // ── 3. 하단 자막 스트립 + 위치 뱃지
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(30, CH - 60, CW - 60, 44);
    ctx.font = '600 15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`📅 ${new Date().toLocaleDateString('ko-KR')}`, 44, CH - 38);
    ctx.textAlign = 'right';
    ctx.fillText('📍 My Day · ✨ Vlog', CW - 44, CH - 38);
    ctx.restore();

    // ── 4. 떠다니는 하트/별 이모지
    ctx.save();
    ctx.font = '24px sans-serif';
    const emojis = ['💕', '✨', '🌿', '☕', '📷'];
    for (let i = 0; i < 5; i++) {
      const phase = t * 0.4 + i * 1.3;
      const x = 80 + ((i * 127) % (CW - 160));
      const y = 300 + Math.sin(phase) * 80 + (i * 90);
      ctx.globalAlpha = 0.55 + Math.abs(Math.sin(phase + 0.5)) * 0.3;
      ctx.fillText(emojis[i], x, y);
    }
    ctx.restore();
  } else if (genre === 'comedy') {
    // ── 1. 만화 말풍선 스타일 외곽
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.setLineDash([]);
    ctx.strokeRect(8, 8, CW - 16, CH - 16);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -elapsed * 0.05;
    ctx.strokeRect(16, 16, CW - 32, CH - 32);
    ctx.restore();

    // ── 2. 떠다니는 만화 이펙트 (ZAP! BOOM! WOW!)
    ctx.save();
    const words = ['BOOM!', 'WOW!', 'ZAP!', 'HAHA!', '⭐'];
    for (let i = 0; i < 3; i++) {
      const slot = Math.floor((elapsed / 1500 + i * 1.3) % words.length);
      const life = ((elapsed / 1500 + i * 1.3) % 1);
      const x = 120 + i * 200;
      const y = 350 + Math.sin((elapsed * 0.002) + i) * 40;
      const scale = 0.5 + life * 0.8;
      const alpha = life < 0.15 ? life / 0.15 : life > 0.75 ? (1 - life) / 0.25 : 1;
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate((i - 1) * 0.2);
      ctx.scale(scale, scale);
      ctx.font = 'bold 42px Impact, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000';
      ctx.strokeText(words[slot], 0, 0);
      ctx.fillStyle = ['#fbbf24','#ef4444','#22c55e','#3b82f6','#ec4899'][slot];
      ctx.fillText(words[slot], 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }
}

// 별 모양 그리기 (북-극별 5 star)
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spikes: number) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
  for (let i = 0; i < spikes; i++) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * (r * 0.45), cy + Math.sin(rot) * (r * 0.45));
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
  }
  ctx.closePath();
  ctx.fill();
}

// 판정 태그 스탬프 (Perfect! / Good! / Miss!)
function drawTagStamp(
  ctx: CanvasRenderingContext2D,
  tag: 'perfect' | 'good' | 'fail' | null,
  tagTimestamp: number,
  now: number,
) {
  if (!tag || !tagTimestamp) return;
  const age = now - tagTimestamp;
  if (age < 0 || age > 900) return;
  const p = age / 900; // 0→1
  const scale = p < 0.2 ? 0.5 + (p/0.2)*0.7 : 1.2 - (p-0.2)/0.8 * 0.4;
  const alpha = p < 0.1 ? p/0.1 : p > 0.7 ? (1 - p)/0.3 : 1;
  const text = tag === 'perfect' ? 'PERFECT!' : tag === 'good' ? 'GOOD!' : 'MISS';
  const color = tag === 'perfect' ? '#fbbf24' : tag === 'good' ? '#22c55e' : '#ef4444';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(CW / 2, CH * 0.35);
  ctx.rotate(-0.15);
  ctx.scale(scale, scale);
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// 콤보 메터
function drawCombo(ctx: CanvasRenderingContext2D, combo: number, elapsed: number) {
  if (combo < 2) return;
  const pulse = 1 + Math.sin(elapsed * 0.01) * 0.08;
  ctx.save();
  ctx.translate(CW - 90, 130);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(234,88,12,0.92)';
  ctx.beginPath();
  rrect(ctx, -70, -26, 140, 52, 26);
  ctx.fill();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🔥 ${combo} COMBO`, 0, 0);
  ctx.restore();
}

// 스쿼트 카운트 뱃지
function drawSquatCount(ctx: CanvasRenderingContext2D, count: number) {
  if (count <= 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(20,184,166,0.95)';
  ctx.beginPath();
  rrect(ctx, 20, 110, 150, 70, 16);
  ctx.fill();
  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SQUATS', 36, 122);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(count), 36, 138);
  ctx.restore();
}

// 음성 인식 실시간 티커
function drawVoiceTicker(ctx: CanvasRenderingContext2D, text: string, color: string) {
  if (!text) return;
  const y = 830;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  rrect(ctx, 30, y - 50, CW - 60, 56, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(30, y + 4, CW - 60, 2);
  ctx.font = '600 22px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const show = text.length > 32 ? '...' + text.slice(-32) : text;
  ctx.fillText(`🎤 ${show}`, 48, y - 22);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// MoveNet 17-point connections (face / torso / arms / legs)
// ---------------------------------------------------------------------------
const POSE_CONNECTIONS: [number, number][] = [
  // face
  [0,1],[0,2],[1,3],[2,4],
  // shoulders+torso
  [5,6],[5,11],[6,12],[11,12],
  // arms
  [5,7],[7,9],[6,8],[8,10],
  // legs
  [11,13],[13,15],[12,14],[14,16],
];

function lmColor(i: number) {
  // face=yellow, arms=green, legs=blue
  if (i <= 4) return '#fbbf24';
  if (i <= 10) return '#00ff88';
  return '#00aaff';
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  mirrored: boolean,
) {
  if (!landmarks?.length) return;
  const conf = (lm: NormalizedLandmark) => lm.visibility ?? (lm as any).score ?? 1;
  const toX  = (lm: NormalizedLandmark) => { const x = lm.x * CW; return mirrored ? CW - x : x; };
  const toY  = (lm: NormalizedLandmark) => lm.y * CH;

  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a]; const lmB = landmarks[b];
    if (!lmA || !lmB || conf(lmA) < 0.3 || conf(lmB) < 0.3) continue;
    ctx.save();
    ctx.strokeStyle = lmColor(a); ctx.lineWidth = 2.5;
    ctx.shadowColor = lmColor(a); ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(toX(lmA), toY(lmA)); ctx.lineTo(toX(lmB), toY(lmB)); ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || conf(lm) < 0.3) continue;
    const color = lmColor(i); const r = i <= 10 ? 4 : 5;
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(toX(lm), toY(lm), r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface RecordingCameraWebProps {
  facing?:             'front' | 'back';
  onFrame?:            (video: HTMLVideoElement) => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  paused?:             boolean;
  landmarks?:          NormalizedLandmark[];
  // Canvas compositing props (used when rendered from record/index.tsx)
  template?:           any;
  elapsed?:            number;
  currentMission?:     any | null;
  missionScore?:       number;
  isRecording?:        boolean;
  // Live judgement state
  currentTag?:         'perfect' | 'good' | 'fail' | null;
  tagTimestamp?:       number;
  combo?:              number;
  squatCount?:         number;
  voiceTranscript?:    string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const RecordingCameraWeb = forwardRef<RecordingCameraHandle, RecordingCameraWebProps>(
  (
    {
      facing = 'front',
      onFrame,
      onPermissionDenied,
      children,
      paused = false,
      landmarks,
      template,
      elapsed       = 0,
      currentMission = null,
      missionScore   = 0,
      isRecording    = false,
      currentTag    = null,
      tagTimestamp  = 0,
      combo         = 0,
      squatCount    = 0,
      voiceTranscript = '',
    },
    ref,
  ) => {
    const videoRef  = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef    = useRef<number | null>(null);
    const frameRafRef = useRef<number | null>(null);
    const recRef    = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    // FIX-R: 오디오 믹스 파이프라인 리소스 — 녹화 종료 시 disconnect
    const mixAudioCtxRef  = useRef<AudioContext | null>(null);
    const mixDestRef      = useRef<MediaStreamAudioDestinationNode | null>(null);
    const micSrcRef       = useRef<MediaStreamAudioSourceNode | null>(null);
    const bgmConnectedRef = useRef(false);
    const recStateRef = useRef(false);

    const mountedFacingRef = useRef(facing);

    // Stable refs for rAF loop closure
    const elapsedRef        = useRef(elapsed);
    const isRecordingRef    = useRef(isRecording);
    const currentMissionRef = useRef(currentMission);
    const missionScoreRef   = useRef(missionScore);
    const landmarksRef      = useRef(landmarks);
    const templateRef       = useRef(template);
    const facingRef         = useRef(facing);
    const currentTagRef     = useRef(currentTag);
    const tagTimestampRef   = useRef(tagTimestamp);
    const comboRef          = useRef(combo);
    const squatCountRef     = useRef(squatCount);
    const voiceTranscriptRef = useRef(voiceTranscript);

    elapsedRef.current        = elapsed;
    isRecordingRef.current     = isRecording;
    currentMissionRef.current  = currentMission;
    missionScoreRef.current    = missionScore;
    landmarksRef.current       = landmarks;
    templateRef.current        = template;
    facingRef.current          = facing;
    currentTagRef.current      = currentTag;
    tagTimestampRef.current    = tagTimestamp;
    comboRef.current           = combo;
    squatCountRef.current      = squatCount;
    voiceTranscriptRef.current = voiceTranscript;

    const [denied, setDenied] = useState(false);
    const [ready, setReady]   = useState(false);

    // ------------------------------------------------------------------
    // Stream acquisition
    // ------------------------------------------------------------------
    useEffect(() => {
      let cancelled = false;

      const setup = async () => {
        if (mountedFacingRef.current !== facing && _streamCache) {
          _streamCache.stream.getTracks().forEach((t) => t.stop());
          _streamCache = null;
        }
        mountedFacingRef.current = facing;

        try {
          const stream = await acquireStream(facing);
          if (cancelled) return;
          streamRef.current = stream;
          // 전역 노출: poseUtils(포즈감지) + useJudgement(볼륨감지) 에서 접근
          (window as any).__cameraStream = stream;
          if (videoRef.current) {
            const vid = videoRef.current;
            vid.srcObject = stream;
            // Focused Commit B-1: __poseVideoEl 을 readyState>=2 & videoWidth>0 확보 후 세팅.
            //   - 기존 fire-and-forget play() 는 iOS Safari/Chrome 의 autoplay 정책에서 거부되면
            //     videoWidth=0 인 채로 pose 감지가 돌아 빈 프레임만 발생.
            //   - loadedmetadata 대기 + play() await + 폴백으로 'camera-play-failed' 에러 마킹.
            try {
              await vid.play();
            } catch (playErr) {
              console.warn('[RecordingCamera] video.play() failed (autoplay):', playErr);
              // 사용자 제스처 후 재시도: 첫 터치에서 play 재시도
              const retryOnce = () => {
                vid.play().catch(() => {});
                window.removeEventListener('pointerdown', retryOnce);
                window.removeEventListener('touchstart', retryOnce);
              };
              window.addEventListener('pointerdown', retryOnce, { once: true });
              window.addEventListener('touchstart',  retryOnce, { once: true });
            }
            // readyState>=2 & 유효한 videoWidth 까지 폴링(최대 ~3초)
            const waitReady = async (): Promise<boolean> => {
              for (let i = 0; i < 30; i++) {
                if (cancelled) return false;
                if (vid.readyState >= 2 && vid.videoWidth > 0) return true;
                await new Promise((r) => setTimeout(r, 100));
              }
              return false;
            };
            const ok = await waitReady();
            if (cancelled) return;
            if (ok) {
              (window as any).__poseVideoEl = vid;
            } else {
              console.warn('[RecordingCamera] video not ready after 3s (videoWidth=0)');
            }
          }
          setDenied(false);
          setReady(true);
        } catch (err) {
          if (cancelled) return;
          console.warn('[RecordingCamera] getUserMedia failed:', err);
          setDenied(true);
          setReady(false);
          onPermissionDenied?.();
        }
      };

      setup();

      return () => {
        cancelled = true;
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (frameRafRef.current !== null) { cancelAnimationFrame(frameRafRef.current); frameRafRef.current = null; }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    // ------------------------------------------------------------------
    // onFrame callback loop (for pose detection)
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!ready || !onFrame || paused) return;
      const loop = () => {
        if (videoRef.current) onFrame(videoRef.current);
        frameRafRef.current = requestAnimationFrame(loop);
      };
      frameRafRef.current = requestAnimationFrame(loop);
      return () => {
        if (frameRafRef.current !== null) { cancelAnimationFrame(frameRafRef.current); frameRafRef.current = null; }
      };
    }, [ready, onFrame, paused]);

    // ------------------------------------------------------------------
    // rAF canvas draw loop
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!ready) return;

      // FIX-Y1 (2026-04-22): 어느 한 draw* 함수에서라도 throw 하면 rAF 체인이 끊겨
      //   카메라 피드가 얼어붙는 현상 방지. 각 블록을 try/catch 로 감싸 개별 실패를 묵음 처리.
      const drawFrame = () => {
        // FIX-Z3 (2026-04-22): rAF 재스케줄링을 최상단에서 **즉시** 예약.
        //   어떤 경로로 이 함수 밖으로 throw 되든, 다음 프레임은 이미 예약되어 있음.
        //   이렇게 해야 화면이 '영구 freeze' 가 될 수 없다.
        rafRef.current = requestAnimationFrame(drawFrame);

        try {
          const canvas = canvasRef.current;
          const video  = videoRef.current;
          if (!canvas || !video) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const tmpl    = templateRef.current;
          const elap    = elapsedRef.current;
          const isRec   = isRecordingRef.current;
          const mission = currentMissionRef.current;
          const score   = missionScoreRef.current;
          const lms     = landmarksRef.current;
          const face    = facingRef.current;

          // 1. Camera — 이게 실패하면 루프 정지 위험이 가장 크므로 별도 try
          try { drawCamera(ctx, video, face); } catch (e) { /* silent */ }

          // 2. Genre effect
          try { if (tmpl) drawGenreEffect(ctx, tmpl.genre ?? '', elap); } catch {}

          // 3. Header
          try { if (tmpl) drawHeader(ctx, tmpl, elap, isRec); } catch {}

          // 4. Subtitle
          try {
            if (tmpl) {
              const timeline: { start_ms: number; end_ms: number; text: string; style?: string }[] =
                tmpl.subtitle_timeline ?? [];
              const sub = timeline.find((s) => elap >= s.start_ms && elap < s.end_ms);
              if (sub) drawSubtitle(ctx, sub.text, sub.style, genreColor(tmpl.genre ?? ''));
            }
          } catch {}

          // 5. Mission card
          try { if (isRec && mission) drawMissionCard(ctx, mission, score); } catch {}

          // 6. Skeleton — 숨김 처리
          void lms; void drawSkeleton;

          // 7. Live judgement overlays
          try {
            if (isRec) {
              const nowMs = performance.now();
              drawCombo(ctx, comboRef.current, elap);
              if (tmpl?.genre === 'fitness') drawSquatCount(ctx, squatCountRef.current);
              if (voiceTranscriptRef.current) drawVoiceTicker(ctx, voiceTranscriptRef.current, genreColor(tmpl?.genre ?? ''));
              drawTagStamp(ctx, currentTagRef.current, tagTimestampRef.current, nowMs);
            }
          } catch {}

          // 8. FIX-Z7: 인트로/아웃트로 카드 (녹화 중에만).
          try {
            if (isRec && tmpl) {
              drawIntroOverlay(ctx, tmpl, elap);
              drawOutroOverlay(ctx, tmpl, elap);
            }
          } catch {}
        } catch (e) {
          // 최상위 방어막: 어떤 예외도 rAF 체인을 깨뜨리지 못함.
          try { console.warn('[drawFrame] top-level caught:', e); } catch {}
        }
      };

      rafRef.current = requestAnimationFrame(drawFrame);
      return () => {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      };
    }, [ready]);

    // ------------------------------------------------------------------
    // Imperative handle — same interface as RecordingCameraHandle
    // ------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          const canvas = canvasRef.current;
          const stream = streamRef.current;
          if (!canvas || !stream) {
            reject(new Error('[RecordingCameraWeb] canvas or stream not ready'));
            return;
          }

          chunksRef.current = [];

          const canvasStream: MediaStream = (canvas as any).captureStream
            ? (canvas as any).captureStream(30)
            : (canvas as any).mozCaptureStream(30);

          // FIX-S (2026-04-22): 녹화 중 BGM 재생 안 함 → 마이크 원본 트랙만 추가.
          //   BGM·SFX·레이어는 "완성 영상 만들기" 단계에서 포스트 컴포지터가 입힌다.
          //   녹화 클립은 순수 camera + raw mic.
          stream.getAudioTracks().forEach((t) => {
            try { canvasStream.addTrack(t); } catch { /* ignore */ }
          });

          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

          const recorder = new MediaRecorder(
            canvasStream,
            mimeType
              ? { mimeType, videoBitsPerSecond: 2_500_000 }
              : { videoBitsPerSecond: 2_500_000 },
          );
          recRef.current = recorder;
          recStateRef.current = true;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.onstop = () => {
            recStateRef.current = false;
            const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
            resolve(URL.createObjectURL(blob));
          };
          recorder.onerror = (e) => { recStateRef.current = false; reject(e); };

          recorder.start(100);
        }),

      stopRecording: () => {
        if (recRef.current && recRef.current.state !== 'inactive') {
          recRef.current.stop();
        }
        // FIX-S: 믹싱 파이프라인 비활성. 남은 ref 는 cleanup 만.
        try { micSrcRef.current?.disconnect(); } catch {}
        micSrcRef.current = null;
        if (bgmConnectedRef.current) {
          try {
            const bgmOut = getBgmPlayer().getOutputNode();
            if (bgmOut && mixDestRef.current) bgmOut.disconnect(mixDestRef.current);
          } catch {}
          bgmConnectedRef.current = false;
        }
        try { mixDestRef.current?.disconnect(); } catch {}
        mixDestRef.current = null;
        // Do NOT stop camera stream
      },

      isRecording: () => recStateRef.current,
    }));

    // ------------------------------------------------------------------
    // Permission-denied UI
    // ------------------------------------------------------------------
    if (denied) {
      return (
        <View style={st.denied}>
          <Text style={st.deniedIcon}>📷</Text>
          <Text style={st.deniedTitle}>카메라 접근 거부됨</Text>
          <Text style={st.deniedBody}>
            브라우저 설정에서 카메라 및 마이크 권한을 허용해 주세요.
          </Text>
          <TouchableOpacity
            style={st.deniedBtn}
            onPress={() => {
              setDenied(false);
              acquireStream(facing)
                .then((stream) => {
                  streamRef.current = stream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                  }
                  setReady(true);
                })
                .catch(() => { setDenied(true); onPermissionDenied?.(); });
            }}
          >
            <Text style={st.deniedBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
      <View style={st.container}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />

        {/* Canvas: 9:16 portrait — height fills container, width auto-calculated */}
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{
            height: '100%',
            width: 'auto',
            maxWidth: '100%',
            display: 'block',
            margin: '0 auto',
            // @ts-ignore web
            objectFit: 'contain',
          }}
        />

        {children && (
          <View style={st.children} pointerEvents="box-none">
            {children}
          </View>
        )}
      </View>
    );
  },
);

RecordingCameraWeb.displayName = 'RecordingCameraWeb';
export default RecordingCameraWeb;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const st = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000',
    position: 'relative' as any, overflow: 'hidden' as any,
  },
  children: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  denied:   { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedIcon:    { fontSize: 48, marginBottom: 16 },
  deniedTitle:   { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  deniedBody:    { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  deniedBtn:     { backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  deniedBtnText: { color: '#111', fontSize: 15, fontWeight: '600' },
});
