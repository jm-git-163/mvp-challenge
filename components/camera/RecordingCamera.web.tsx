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
import { swapCameraStream } from '../../engine/session/cameraSwap';
import { ensureMediaSession, getMediaSession } from '../../engine/session/mediaSession';
import { pickRecordingMimeType } from '../../engine/recording/codecNegotiator';
import { getBgmPlayer } from '../../utils/bgmLibrary';
import { resourceTracker } from '../../utils/resourceTracker';
import { drawDiagnosticsOverlay } from '../../utils/diagnosticsOverlay';
import {
  drawLiveCaption,
  drawJudgementToast,
  drawSquatPlusOne,
  drawMicPermissionBanner,
  type JudgementTier,
} from '../../utils/liveCaption';
// 2026-05-02 Phase 5 production wiring: layerEngine 합성 경로.
//   resolveLayeredTemplate(activeTemplate) 가 매칭되면 매 프레임 renderLayeredFrame
//   으로 17+ 레이어를 한 캔버스에 그린다. cam_feed 레이어가 카메라 video 를 그려주므로
//   기존 drawCamera 호출은 이 경로에서 스킵.
import { renderLayeredFrame } from '../../utils/videoCompositor';
import { resolveLayeredTemplate } from '../../utils/templateBridge';
import { extractBodyAnchor } from '../../engine/ar/bodyAnchor';
import { setBeatIntensity as setLiveBeatIntensity } from '../../engine/composition/liveState';
import { synthesizeBeats } from '../../engine/beat/beatClock';

// ---------------------------------------------------------------------------
// Canvas dimensions (9:16 portrait)
// ---------------------------------------------------------------------------
const CW = 720;
const CH = 1280;

// ---------------------------------------------------------------------------
// Stream cache singleton — persists across navigations
// ---------------------------------------------------------------------------
let _streamCache: { stream: MediaStream; facing: 'front' | 'back' } | null = null;
// FIX-AA (2026-04-22): facing 토글 경쟁 직렬화 — 빠르게 두 번 누르거나
//   useEffect cleanup/setup 이 겹칠 때 두 개의 getUserMedia 가 동시에
//   같은 카메라 장치를 잡으면 iOS/Android 에서 NotReadableError/OverconstrainedError
//   가 터지면서 스트림 둘 다 사용불가. promise-queue 로 직렬화.
let _acquireQueue: Promise<MediaStream> = Promise.resolve() as any;

async function acquireStream(facing: 'front' | 'back'): Promise<MediaStream> {
  // 이전 acquire 완료(성공/실패 무관) 이후 내 차례 실행
  const prev = _acquireQueue.catch(() => undefined);
  const next = prev.then(() => doAcquire(facing));
  _acquireQueue = next.catch(() => undefined) as any;
  return next;
}

async function doAcquire(facing: 'front' | 'back'): Promise<MediaStream> {
  // FIX-MIC-SINGLETON (2026-04-23): 로컬 _streamCache 도 유지하지만 **진실의 원천**은
  //   mediaSession 싱글톤이다. 로컬 캐시가 살아있으면 그대로 반환 (재호출 0).
  //   없으면 ensureMediaSession() → 싱글톤에게 위임.
  //   facing 전환은 swapCameraStream (별도 경로) 을 쓰므로 여기선 facing 변경을
  //   자체 재요청하지 않는다. 같은 facing 재호출은 캐시 hit.
  if (_streamCache) {
    const allLive = _streamCache.stream
      .getTracks()
      .every((t) => t.readyState === 'live');
    if (allLive) return _streamCache.stream;
    // 죽은 스트림 — 로컬 캐시만 비우고 (싱글톤 track 이 ended 상태면 싱글톤이 재요청함)
    _streamCache = null;
  }

  const facingMode: 'user' | 'environment' = facing === 'front' ? 'user' : 'environment';
  const stream = await ensureMediaSession({
    video: {
      facingMode: { ideal: facingMode } as any,
      // FIX-CAMERA-ZOOM (2026-04-24, v2): 캔버스(720×1280, 9:16) 와 동일한 세로
      //   비율로 요청. 전면 카메라 네이티브 포맷이라 COVER 가 crop 0 이 된다.
      width:  { ideal: 720, max: 1080 },
      height: { ideal: 1280, max: 1920 },
      aspectRatio: { ideal: 9 / 16 } as any,
    },
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  _streamCache = { stream, facing };
  return stream;
}

/**
 * FIX-MIC-SINGLETON (2026-04-23): 기존 동작(트랙 stop)은 권한 팝업 재유발의 원인이었다.
 * 이제는 로컬 캐시 참조만 해제한다. 실제 스트림 생명주기는 mediaSession 싱글톤 소유.
 */
export function stopCachedStream(): void {
  _streamCache = null;
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
// FIX-CAMERA-PORTRAIT (2026-04-24, v4): COVER + 블러 안전망.
//   v3 의 CONTAIN 은 landscape 웹캠(1280×720) 을 9:16 캔버스에 fit 시키면
//   전경 draw 가 1080×607 짜리 가로 영상이 캔버스 중앙에 띠처럼 박히고
//   위·아래 656px 가 블러 배경만 보이는 결과 → 사용자: "쇼츠 중간에
//   가로로 조그만 영상이 생기고". 사용자는 명시적으로 "창 구조 금지,
//   화면을 채워달라" 라고 요구. 정답은 COVER (양쪽 살짝 crop, 가로 웹캠은
//   어쩔 수 없음. 모바일 전면 카메라는 portrait 으로 들어오므로 crop 0).
//   블러 배경은 COVER 가 캔버스를 가득 채우므로 사실상 보이지 않지만,
//   readyState 경계나 일시적 타이밍 케이스의 안전망으로 유지.
function drawCamera(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  facing: 'front' | 'back',
  state?: { cameraRect?: { x: number; y: number; w: number; h: number } },
) {
  if (video.readyState < 2) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  if (facing === 'front') {
    ctx.save();
    ctx.translate(CW, 0);
    ctx.scale(-1, 1);
  }

  // 1) 배경: 전체 캔버스를 COVER 로 채우되 강한 블러. 여백이 시각적으로 채워짐.
  ctx.save();
  try { (ctx as any).filter = 'blur(30px) brightness(0.7)'; } catch { /* ignore */ }
  const srcAR = vw / vh;
  const dstAR = CW / CH;
  if (srcAR > dstAR) {
    const srcH = vh;
    const srcW = srcH * dstAR;
    const srcX = (vw - srcW) / 2;
    ctx.drawImage(video, srcX, 0, srcW, srcH, 0, 0, CW, CH);
  } else {
    const srcW = vw;
    const srcH = srcW / dstAR;
    const srcY = (vh - srcH) / 2;
    ctx.drawImage(video, 0, srcY, srcW, srcH, 0, 0, CW, CH);
  }
  ctx.restore();

  // 2) 전경: COVER fit — 캔버스를 가득 채움. 가로 웹캠은 좌우 crop, 세로
  //    소스는 crop 0. dx/dy/dw/dh 는 항상 캔버스 전면.
  let sx: number, sy: number, sw: number, sh: number;
  if (srcAR > dstAR) {
    // landscape: 좌우 crop
    sh = vh;
    sw = vh * dstAR;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    // portrait: 상하 crop (세로 폰 소스에서는 거의 0)
    sw = vw;
    sh = vw / dstAR;
    sx = 0;
    sy = (vh - sh) / 2;
  }
  const dx = 0, dy = 0, dw = CW, dh = CH;
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);

  if (facing === 'front') ctx.restore();

  if (state) state.cameraRect = { x: dx, y: dy, w: dw, h: dh };
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
  // FIX-SCRIPT-POOL (2026-04-23): read_text 가 배열 가능 → 첫 엔트리 폴백.
  const rtFirst = Array.isArray(mission.read_text) ? mission.read_text[0] : mission.read_text;
  const rt = typeof rtFirst === 'string' ? rtFirst : (rtFirst?.text ?? '');
  ctx.fillText(
    ((mission.guide_text ?? rt ?? '') as string).slice(0, 22),
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
    const tickerText = '    챌린지 뉴스 생중계 · 시청자 참여 급증 · 팔로워 증가 중 · 채널 구독 부탁 드립니다 · ';
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
  // FIX-Z22 (2026-04-22): 온캔버스 라이브 인식 진단 오버레이.
  //   DOM 뱃지는 풀스크린 촬영 중 잘 안보여 유저가 "인식 됐는지" 확인 불가.
  //   이 prop 들은 녹화 캔버스 자체에 박혀 유저가 즉시 눈으로 본다.
  //   모두 optional — 기존 사용처 훼손 없음.
  showDiagnostics?:      boolean;             // default true
  diagVoiceListening?:   boolean;
  diagVoiceTranscript?:  string;
  diagVoiceError?:       string | null;
  diagVoicePreCheckOk?:  boolean | null;     // null=아직 체크 전
  diagVoiceSupported?:   boolean;            // false=iOS Safari 등
  diagPoseStatus?:       string;             // 'ready-real'|'ready-mock'|'loading'|'error'|...
  diagPoseLandmarkCount?: number;
  diagIsRealPose?:       boolean;
  diagSquatCount?:       number;
  diagSquatTarget?:      number;             // 목표 rep (default 10)
  diagSquatPhase?:       string;             // 'up'|'down'|'unknown'|'idle'
  diagSquatReady?:       boolean;
  diagSquatFaceOk?:      boolean;
  diagSquatBodyOk?:      boolean;
  // FIX-Z25 (2026-04-22): 라이브 자막 + 발화 판정 + 스쿼트 +1 + 마이크 권한 배너.
  //   RecordingCamera 가 drawFrame 안에서 순수함수(utils/liveCaption) 로 직접 캔버스에 박는다.
  latestJudgement?:          { tier: JudgementTier; at: number } | null;
  lastSquatCountAt?:         number | null;
  micPermissionDeniedAt?:    number | null;
  /** 라이브 자막으로 쓸 텍스트 (default: voiceTranscript). 명시하면 우선. */
  liveCaptionText?:          string;
  /** 자막 좌측 accent 색상. tier 있으면 tier 색 우선. */
  liveCaptionAccent?:        string;
  /** 자막 표시 on/off. default true (미션 없어도 노출 — 인식 확인 용). */
  showLiveCaption?:          boolean;
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
      showDiagnostics = true,
      diagVoiceListening = false,
      diagVoiceTranscript = '',
      diagVoiceError = null,
      diagVoicePreCheckOk = null,
      diagVoiceSupported = true,
      diagPoseStatus = 'idle',
      diagPoseLandmarkCount = 0,
      diagIsRealPose = false,
      diagSquatCount = 0,
      diagSquatTarget = 10,
      diagSquatPhase = 'idle',
      diagSquatReady = false,
      diagSquatFaceOk = false,
      diagSquatBodyOk = false,
      latestJudgement = null,
      lastSquatCountAt = null,
      micPermissionDeniedAt = null,
      liveCaptionText,
      liveCaptionAccent,
      showLiveCaption = true,
    },
    ref,
  ) => {
    const videoRef  = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef    = useRef<number | null>(null);
    const frameRafRef = useRef<number | null>(null);
    const frameCounterRef = useRef(0);
    const recRef    = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    // FIX-R: 오디오 믹스 파이프라인 리소스 — 녹화 종료 시 disconnect
    const mixAudioCtxRef  = useRef<AudioContext | null>(null);
    const mixDestRef      = useRef<MediaStreamAudioDestinationNode | null>(null);
    const micSrcRef       = useRef<MediaStreamAudioSourceNode | null>(null);
    const bgmConnectedRef = useRef(false);
    const recStateRef = useRef(false);

    // POSE+THEME (2026-04-22): ?debug=1 URL 플래그 감지 + landmark fps 집계.
    const __debugFlagRef = useRef<boolean>(
      typeof window !== 'undefined'
        ? /[?&]debug=1\b/.test(window.location.search || '')
        : false,
    );
    const __lmFpsRef = useRef<{ frames: number; lastReset: number; fps: number }>(
      { frames: 0, lastReset: typeof performance !== 'undefined' ? performance.now() : 0, fps: 0 },
    );

    const mountedFacingRef = useRef(facing);
    // CAMERA-SWAP (2026-04-23): 전환 중 플래그. true 동안 draw 루프는 직전 프레임
    //   위에 "📷 전환 중…" 오버레이를 그려 사용자 혼동을 최소화한다.
    const swappingRef   = useRef<{ active: boolean; startedAt: number; toFacing: 'front'|'back' } | null>(null);
    // FIX-AA: facing 토글 race-guard 용 generation counter + cleanup 저장소.
    const generationRef = useRef(0);
    const cleanupsRef   = useRef<Array<() => void>>([]);

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
    // FIX-Z25: 라이브 자막/판정/스쿼트+1/마이크 배너용 refs
    const liveCaptionTextRef    = useRef<string | undefined>(liveCaptionText);
    const liveCaptionAccentRef  = useRef<string | undefined>(liveCaptionAccent);
    const showLiveCaptionRef    = useRef<boolean>(showLiveCaption);
    const latestJudgementRef    = useRef(latestJudgement);
    const lastSquatCountAtRef   = useRef<number | null>(lastSquatCountAt);
    const micDeniedAtRef        = useRef<number | null>(micPermissionDeniedAt);
    // FIX-Z22: 온캔버스 진단 오버레이용 refs (매 render 최신값 주입)
    const diagRef = useRef({
      show: showDiagnostics,
      vListen: diagVoiceListening,
      vText: diagVoiceTranscript,
      vErr: diagVoiceError,
      vPre: diagVoicePreCheckOk,
      vSup: diagVoiceSupported,
      pStat: diagPoseStatus,
      pLm: diagPoseLandmarkCount,
      pReal: diagIsRealPose,
      sCnt: diagSquatCount,
      sTgt: diagSquatTarget,
      sPh: diagSquatPhase,
      sRdy: diagSquatReady,
      sFace: diagSquatFaceOk,
      sBody: diagSquatBodyOk,
    });

    elapsedRef.current        = elapsed;
    isRecordingRef.current     = isRecording;
    currentMissionRef.current  = currentMission;
    missionScoreRef.current    = missionScore;
    landmarksRef.current       = landmarks;
    templateRef.current        = template;
    // 2026-05-02 Phase 5 wiring: layered 템플릿 해석 결과를 ref 에 캐시.
    //   매 프레임 새로 룩업하지 않도록 template 변경 시에만 갱신.
    //   resolve 가 null 이면 layered 경로 비활성 → 기존 drawCamera fallback.
    const layeredTemplateRef   = useRef<ReturnType<typeof resolveLayeredTemplate>>(null);
    layeredTemplateRef.current = resolveLayeredTemplate(template);
    // 비트 합성 폴백 (BGM 분석 JSON 없을 때) — template duration + bpm 로 1회 생성.
    //   bpm hint 가 없으면 120, duration 없으면 30 사용. 안전한 기본값.
    const synthBeatsRef = useRef<{ key: string; beats: number[] } | null>(null);
    {
      const lt = layeredTemplateRef.current;
      const bpm = (lt as any)?.bgm?.bpm ?? (template as any)?.bpm ?? 120;
      const dur = lt?.duration ?? (template as any)?.duration_sec ?? 30;
      const key = `${lt?.id ?? '_none'}|${bpm}|${dur}`;
      if (!synthBeatsRef.current || synthBeatsRef.current.key !== key) {
        try { synthBeatsRef.current = { key, beats: synthesizeBeats(bpm, dur).beats }; }
        catch { synthBeatsRef.current = { key, beats: [] }; }
      }
    }
    facingRef.current          = facing;
    currentTagRef.current      = currentTag;
    tagTimestampRef.current    = tagTimestamp;
    comboRef.current           = combo;
    squatCountRef.current      = squatCount;
    voiceTranscriptRef.current = voiceTranscript;
    liveCaptionTextRef.current   = liveCaptionText;
    liveCaptionAccentRef.current = liveCaptionAccent;
    showLiveCaptionRef.current   = showLiveCaption;
    latestJudgementRef.current   = latestJudgement;
    lastSquatCountAtRef.current  = lastSquatCountAt;
    micDeniedAtRef.current       = micPermissionDeniedAt;
    diagRef.current = {
      show: showDiagnostics,
      vListen: diagVoiceListening,
      vText: diagVoiceTranscript,
      vErr: diagVoiceError,
      vPre: diagVoicePreCheckOk,
      vSup: diagVoiceSupported,
      pStat: diagPoseStatus,
      pLm: diagPoseLandmarkCount,
      pReal: diagIsRealPose,
      sCnt: diagSquatCount,
      sTgt: diagSquatTarget,
      sPh: diagSquatPhase,
      sRdy: diagSquatReady,
      sFace: diagSquatFaceOk,
      sBody: diagSquatBodyOk,
    };

    const [denied, setDenied] = useState(false);
    const [ready, setReady]   = useState(false);
    // FIX-AA (2026-04-22): 카메라 진단 뱃지용 상태. 사용자가 실기기에서
    //   어느 단계에서 카메라가 멈추는지 한눈에 확인할 수 있도록 노출.
    const [camDiag, setCamDiag] = useState<{
      phase: 'idle' | 'acquiring' | 'attached' | 'playing' | 'frozen' | 'error';
      facing: 'front' | 'back';
      vw: number; vh: number; ready: number; paused: boolean;
      msg: string;
      // FIX-Z25 (2026-04-22): 최근 video 이벤트 3개 (loadedmetadata→playing→pause…)
      //   실기기에서 프리징이 어느 단계인지 한눈에 식별하기 위함.
      events: string[];
    }>({ phase: 'idle', facing, vw: 0, vh: 0, ready: 0, paused: true, msg: '', events: [] });
    const setCamDiagSafe = (patch: Partial<typeof camDiag>) =>
      setCamDiag((prev) => ({ ...prev, ...patch }));

    // ------------------------------------------------------------------
    // Stream acquisition
    // ------------------------------------------------------------------
    useEffect(() => {
      let cancelled = false;
      // FIX-AA: facing 전환마다 generation 증가 — 이전 setup 의 late-resolve 가
      //   최신 상태를 덮어쓰지 않게 함 (race 방어).
      const myGen = ++generationRef.current;

      const setup = async () => {
        setCamDiagSafe({ phase: 'acquiring', facing, msg: `${facing} getUserMedia…` });
        // FIX-MIC-SINGLETON (2026-04-23): facing 전환에서 로컬 트랙을 stop 하지 않는다.
        //   실제 카메라 교체는 swapCameraStream 경로가 담당. 여기선 로컬 참조만 비우고
        //   ensureMediaSession 이 facing override 로 결정. 스트림 소유권은 싱글톤.
        if (mountedFacingRef.current !== facing && _streamCache) {
          _streamCache = null;
        }
        mountedFacingRef.current = facing;

        let stream: MediaStream;
        try {
          stream = await acquireStream(facing);
        } catch (err) {
          if (cancelled || myGen !== generationRef.current) return;
          console.warn('[RecordingCamera] getUserMedia failed:', err);
          setCamDiagSafe({ phase: 'error', msg: (err as any)?.name ?? String(err) });
          setDenied(true);
          setReady(false);
          onPermissionDenied?.();
          return;
        }
        if (cancelled || myGen !== generationRef.current) {
          // 이미 다음 facing 전환이 발생 → 방금 받은 stream 은 버림.
          //   (이미 _streamCache 에 등록되어 있으므로 stop 하지 않음 — 후속 setup 이 사용)
          return;
        }
        streamRef.current = stream;
        (window as any).__cameraStream = stream;

        if (!videoRef.current) return;
        const vid = videoRef.current;
        // 기존 srcObject 가 다르면 교체. 같으면 play() 만 재시도 (iOS 에서 srcObject
        //   재할당 하면 readyState 가 일시 0 으로 떨어지며 preview 가 점멸).
        if (vid.srcObject !== stream) {
          try { vid.srcObject = stream; } catch {}
        }
        setCamDiagSafe({ phase: 'attached', msg: 'srcObject attached' });

        // loadedmetadata 이벤트로 __poseVideoEl + ready 를 "즉시" 세팅.
        //   이전엔 10s polling 루프가 끝나야 setReady(true) 호출되어 rAF 가 지연됨.
        const markReady = () => {
          if (cancelled || myGen !== generationRef.current) return;
          (window as any).__poseVideoEl = vid;
          setCamDiagSafe({
            phase: 'playing', vw: vid.videoWidth, vh: vid.videoHeight,
            ready: vid.readyState, paused: vid.paused, msg: 'ok',
          });
          setDenied(false);
          setReady(true);
        };

        const onMeta = () => { markReady(); };
        vid.addEventListener('loadedmetadata', onMeta, { once: true });
        vid.addEventListener('playing', onMeta, { once: true });

        // FIX-Z25 (2026-04-22): video 생명주기 이벤트를 모두 camDiag.events 에 누적.
        //   실기기에서 어느 이벤트가 누락/중단됐는지 실시간 확인. ring buffer 최근 3개.
        const pushEvent = (name: string) => {
          setCamDiag((prev) => {
            const next = [...prev.events, name];
            if (next.length > 3) next.shift();
            return { ...prev, events: next };
          });
        };
        const evNames = [
          'loadedmetadata', 'loadeddata', 'canplay', 'playing',
          'pause', 'waiting', 'stalled', 'ended', 'error', 'emptied', 'suspend',
        ] as const;
        const evHandlers: Array<[string, () => void]> = evNames.map((n) => {
          const h = () => pushEvent(n);
          vid.addEventListener(n, h);
          return [n, h];
        });
        cleanupsRef.current.push(() => {
          for (const [n, h] of evHandlers) vid.removeEventListener(n, h);
        });

        try {
          await vid.play();
        } catch (playErr) {
          console.warn('[RecordingCamera] video.play() failed (autoplay):', playErr);
          const retryOnce = () => {
            vid.play().catch(() => {});
            window.removeEventListener('pointerdown', retryOnce);
            window.removeEventListener('touchstart', retryOnce);
          };
          window.addEventListener('pointerdown', retryOnce, { once: true });
          window.addEventListener('touchstart',  retryOnce, { once: true });
        }

        // 이미 metadata 가 올라와 있을 수도 있음 (캐시된 stream 재사용 시).
        if (vid.readyState >= 1 && vid.videoWidth > 0) {
          markReady();
        }

        // 안전망: 3초 내에도 playing/loadedmetadata 가 안 오면 강제로 ready 처리 +
        //   진단 뱃지에 frozen 상태 표시. rAF 는 무조건 돌게 해서 UI freeze 피함.
        const fallbackTimer = setTimeout(() => {
          if (cancelled || myGen !== generationRef.current) return;
          if (!(window as any).__poseVideoEl) {
            (window as any).__poseVideoEl = vid;
          }
          setCamDiagSafe({
            phase: vid.readyState >= 2 ? 'playing' : 'frozen',
            vw: vid.videoWidth, vh: vid.videoHeight,
            ready: vid.readyState, paused: vid.paused,
            msg: vid.readyState >= 2 ? 'late-ready' : `late vw=${vid.videoWidth} rs=${vid.readyState}`,
          });
          setDenied(false);
          setReady(true);
        }, 3000);

        cleanupsRef.current.push(() => {
          clearTimeout(fallbackTimer);
          vid.removeEventListener('loadedmetadata', onMeta);
          vid.removeEventListener('playing', onMeta);
        });
      };

      setup();

      return () => {
        cancelled = true;
        // rAF 는 ready effect 가 별도로 관리 — 여기선 setup 용 cleanup 만.
        const list = cleanupsRef.current;
        cleanupsRef.current = [];
        for (const fn of list) { try { fn(); } catch {} }
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

      // FIX-AA (2026-04-22): draw 루프에서도 video 상태를 주기적으로 체크해
      //   paused 면 play() 재시도, readyState 가 2 미만이면 마지막 프레임 유지 +
      //   진단 뱃지 갱신. 이 루프 자체는 절대 끊기지 않는다.
      let lastDiagUpdate = 0;
      let lastPlayKick   = 0;

      // FIX-Y1 (2026-04-22): 어느 한 draw* 함수에서라도 throw 하면 rAF 체인이 끊겨
      //   카메라 피드가 얼어붙는 현상 방지. 각 블록을 try/catch 로 감싸 개별 실패를 묵음 처리.
      // FIX-Z25 (2026-04-22): draw 본체는 paintOnce(), 스케줄링은 rAF + rVFC 두 경로
      //   각각이 담당 → 중복 스케줄 방지.
      const paintOnce = () => {
        try {
          const canvas = canvasRef.current;
          const video  = videoRef.current;
          if (!canvas || !video) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // FIX-Z25 (2026-04-22): video.paused 면 100ms 간격으로 play() 재시도.
          //   Android Chrome 의 autoplay gesture 정책은 페이지 내 어떤 탭이라도
          //   이미 발생했다면 풀린다 → 자주 때릴수록 복귀가 빨라진다. 1초→100ms.
          const now = performance.now();
          if (video.paused && now - lastPlayKick > 100) {
            lastPlayKick = now;
            try { video.play().catch(() => {}); } catch {}
          }
          // 0.5s 마다 진단 뱃지 업데이트.
          if (now - lastDiagUpdate > 500) {
            lastDiagUpdate = now;
            setCamDiag((prev) => {
              const vw = video.videoWidth, vh = video.videoHeight;
              const rs = video.readyState;
              const paused = video.paused;
              // 값 변화가 있을 때만 업데이트 (리렌더 억제)
              if (prev.vw === vw && prev.vh === vh && prev.ready === rs && prev.paused === paused) {
                return prev;
              }
              return { ...prev, vw, vh, ready: rs, paused,
                phase: rs >= 2 && !paused ? 'playing' : prev.phase === 'error' ? 'error' : 'frozen' };
            });
          }

          const tmpl    = templateRef.current;
          const elap    = elapsedRef.current;
          const isRec   = isRecordingRef.current;
          const mission = currentMissionRef.current;
          const score   = missionScoreRef.current;
          const lms     = landmarksRef.current;
          const face    = facingRef.current;

          // FIX-Z11 (2026-04-22): 촬영 캔버스는 "순수 카메라" 만 그린다.
          //   템플릿/인트로/아웃트로/장르 이펙트/자막/HUD 는 모두 후처리 단계
          //   (utils/videoCompositor.ts) 에서 레이어 합성. 사용자 피드백 명확:
          //   "촬영 다 된 촬영 분을 사전에 완성된 템플릿 지정 부위에 들어가서
          //    여러 겹의 레이어가 촬영화면 위에 있고".
          //   촬영 중 실시간 UX 피드백(스쿼트 카운트/음성 자막)은
          //   app/record/index.tsx 의 DOM 뱃지로 이미 노출 — 이것은 captureStream
          //   에 들어가지 않으므로 녹화본은 오염되지 않음.
          // FIX-Z21 (2026-04-22): 이전엔 drawCamera 가 early-return 하면 캔버스에
          //   이전 프레임이 그대로 남아 "카메라 멈춤" 으로 보였음. 매 프레임 먼저
          //   검은 배경 + 부드러운 펄스 힌트로 초기화 → drawCamera 가 그리지 못한
          //   경우에도 "현재 로딩 중" 상태가 시각적으로 드러난다.
          if (video.readyState < 2 || !video.videoWidth) {
            // FIX-Z24: "진짜 멈춤" vs "rAF 는 돌지만 video 만 안 풀림" 을 유저가
            //   구분할 수 있도록 회전하는 스피너 + 프레임 카운터 표시.
            ctx.fillStyle = '#0a0a12';
            ctx.fillRect(0, 0, CW, CH);
            frameCounterRef.current++;
            const t = performance.now() * 0.002;
            // 회전 원형 스피너
            const cx = CW / 2, cy = CH / 2 - 40;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(performance.now() * 0.003);
            for (let i = 0; i < 12; i++) {
              ctx.rotate(Math.PI / 6);
              ctx.fillStyle = `rgba(127,255,212,${((i + 1) / 12).toFixed(3)})`;
              ctx.fillRect(-3, -40, 6, 14);
            }
            ctx.restore();
            const pulse = 0.5 + 0.5 * Math.sin(t);
            ctx.fillStyle = `rgba(255,255,255,${(0.6 + 0.4 * pulse).toFixed(3)})`;
            ctx.font = 'bold 40px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('카메라 준비 중…', CW / 2, CH / 2 + 60);
            ctx.font = '20px monospace';
            ctx.fillStyle = 'rgba(127,255,212,0.9)';
            ctx.fillText(
              `frame #${frameCounterRef.current}  rs=${video.readyState} ${video.videoWidth}×${video.videoHeight} ${video.paused ? '⏸' : '▶'}`,
              CW / 2, CH / 2 + 110,
            );
          } else {
            // 2026-05-02 Phase 5 wiring: layered 템플릿이 매칭되면 17+ 레이어 합성.
            //   cam_feed 레이어가 video 를 그리므로 drawCamera 호출은 생략.
            //   매칭 안 되면 기존 단순 drawCamera 경로 (회귀 0).
            const lt = layeredTemplateRef.current;
            if (lt && isRecordingRef.current) {
              // 비트 강도 계산 (synth 폴백) → liveState 에 푸시 → mergeLiveIntoState 로 레이어가 읽음.
              try {
                const tSec = elapsedRef.current / 1000;
                const beats = synthBeatsRef.current?.beats ?? [];
                let lastBeat = 0;
                for (let i = 0; i < beats.length; i++) {
                  if (beats[i] <= tSec) lastBeat = beats[i];
                  else break;
                }
                const dt = tSec - lastBeat;
                const intensity = Math.max(0, 1 - dt / 0.15);
                setLiveBeatIntensity(intensity);
              } catch { /* silent */ }

              // AR 좌표 — pose landmarks → bodyAnchor (face_sticker 의 faceAnchor 유사 폴백).
              //   FaceLandmarker 통합 전이라 정밀 얼굴 anchor 는 nose 포인트로 근사.
              const lmsNow = landmarksRef.current;
              const bodyAnchor = (lmsNow && lmsNow.length >= 33)
                ? extractBodyAnchor(lmsNow as any)
                : null;
              const noseLm = (lmsNow && lmsNow.length > 0) ? lmsNow[0] : null;
              const faceAnchorFallback = noseLm
                ? { nose: { x: noseLm.x * CW, y: noseLm.y * CH }, forehead: { x: noseLm.x * CW, y: (noseLm.y - 0.06) * CH } }
                : null;

              try {
                renderLayeredFrame(
                  ctx,
                  lt as any,
                  elapsedRef.current,
                  {
                    videoEl: video,
                    bodyAnchor: bodyAnchor as any,
                    faceAnchor: faceAnchorFallback as any,
                    landmarks: lmsNow as any,
                    squatCount: squatCountRef.current,
                    totalScore: missionScoreRef.current,
                    scriptText: voiceTranscriptRef.current,
                    facing: face,
                  } as any,
                );
              } catch (e) { /* per-layer 격리는 renderLayeredFrame 내부에서 수행 */ }
            } else {
              // 기존 fallback — 단순 카메라 fullscreen.
              try { drawCamera(ctx, video, face); } catch (e) { /* silent */ }
            }
          }

          // CAMERA-SWAP (2026-04-23): 전환 중 오버레이. 캔버스 captureStream 은 계속
          //   동작하므로 녹화본에도 이 프레임이 박힘(=블랙아웃 아님).
          //   200ms 페이드인, 1.5s 후 자동 종료 (안전장치).
          try {
            const sw = swappingRef.current;
            if (sw && sw.active) {
              const nowMs = performance.now();
              const dt = nowMs - sw.startedAt;
              if (dt > 1500) {
                // 안전장치: 1.5s 넘으면 강제 해제
                swappingRef.current = null;
              } else {
                const fadeIn = Math.min(1, dt / 200);
                ctx.save();
                ctx.fillStyle = `rgba(8,10,18,${(0.58 * fadeIn).toFixed(3)})`;
                ctx.fillRect(0, 0, CW, CH);
                ctx.globalAlpha = fadeIn;
                ctx.font = 'bold 44px system-ui, sans-serif';
                ctx.fillStyle = '#FFD95E';
                ctx.textAlign = 'center';
                ctx.fillText('📷 전환 중…', CW / 2, CH / 2 - 20);
                ctx.font = 'bold 26px system-ui, sans-serif';
                ctx.fillStyle = '#E6E6E6';
                const label = sw.toFacing === 'front' ? '전면 카메라' : '후면 카메라';
                ctx.fillText(label, CW / 2, CH / 2 + 32);
                ctx.restore();
              }
            }
          } catch { /* silent */ }

          // POSE+THEME (2026-04-22): ?debug=1 일 때 랜드마크 스켈레톤 + pose FPS 오버레이.
          //   녹화 본에는 박히지 않는 것이 아니라, DOM 대체가 아닌 디버그 전용 캔버스 오버레이로
          //   개발자가 포즈 인식 전반 동작을 눈으로 즉시 확인. URL ?debug=1 없으면 비활성.
          try {
            if (__debugFlagRef.current) {
              const lmsNow = landmarksRef.current;
              if (Array.isArray(lmsNow) && lmsNow.length > 0) {
                drawSkeleton(ctx, lmsNow, face === 'front');
                // landmark fps 카운터 갱신
                const nowT = performance.now();
                const last = __lmFpsRef.current;
                last.frames++;
                if (nowT - last.lastReset > 1000) {
                  last.fps = last.frames;
                  last.frames = 0;
                  last.lastReset = nowT;
                }
              }
              // 좌측 하단 FPS/카운트 뱃지
              ctx.save();
              ctx.fillStyle = 'rgba(0,0,0,0.55)';
              ctx.fillRect(20, CH - 90, 360, 70);
              ctx.fillStyle = '#7fffd4';
              ctx.font = 'bold 26px monospace';
              ctx.textAlign = 'left';
              ctx.fillText(`POSE lm=${(landmarksRef.current||[]).length}  fps=${__lmFpsRef.current.fps}`, 30, CH - 58);
              ctx.fillStyle = '#ffd700';
              ctx.font = '20px monospace';
              ctx.fillText(`debug=1 · skeleton ON`, 30, CH - 32);
              ctx.restore();
            }
          } catch (e) { /* silent */ }

          // FIX-Z22: 온캔버스 라이브 인식 진단 오버레이 (녹화본에도 박힘).
          try {
            drawDiagnosticsOverlay(ctx, diagRef.current, {
              elapsedSec: elap / 1000,
              isRecording: isRec,
            });
          } catch (e) { /* silent */ }

          // FIX-Z25: 라이브 자막 (캔버스 하단 78~92%, 폰트 46px bold).
          //   유저가 말한 발화가 즉시 눈에 보여야 "인식 되는지" 확인 가능.
          // FIX-SUBTITLE-DUP v3 (2026-04-23): voice_read 미션 중엔 상단 텔레프롬프터
          //   (VoiceTranscriptOverlay, app/record/index.tsx) 가 이미 전체 대본+transcript
          //   를 큼직하게 표시. 하단 라이브 캡션은 중복 → 완전 제거.
          try {
            const missionType = currentMissionRef.current?.type;
            if (showLiveCaptionRef.current && missionType !== 'voice_read') {
              const captionText = (liveCaptionTextRef.current !== undefined
                ? liveCaptionTextRef.current
                : voiceTranscriptRef.current) || '';
              if (captionText.trim().length > 0) {
                const lj = latestJudgementRef.current;
                // 판정 팝업이 활성 중이면 자막 accent 도 tier 색으로 동기화
                const tierActive = lj && (performance.now() - lj.at) < 800 ? lj.tier : null;
                drawLiveCaption(ctx, {
                  canvasW: CW, canvasH: CH,
                  text: captionText,
                  accentColor: liveCaptionAccentRef.current,
                  judgementTier: tierActive,
                });
              }
            }
          } catch (e) { /* silent */ }

          // FIX-Z25: 발화 판정 토스트 (우측 상단, 0.8s).
          try {
            const lj = latestJudgementRef.current;
            if (lj) {
              drawJudgementToast(ctx, {
                canvasW: CW, canvasH: CH,
                tier: lj.tier, at: lj.at,
              });
            }
          } catch (e) { /* silent */ }

          // FIX-Z25: 스쿼트 +1 팝업 (중앙, 500ms).
          try {
            const sqAt = lastSquatCountAtRef.current;
            if (typeof sqAt === 'number') {
              drawSquatPlusOne(ctx, { canvasW: CW, canvasH: CH, at: sqAt });
            }
          } catch (e) { /* silent */ }

          // FIX-Z25: 마이크 권한 필요 빨간 배너 (3s).
          try {
            const micAt = micDeniedAtRef.current;
            if (typeof micAt === 'number') {
              drawMicPermissionBanner(ctx, { canvasW: CW, canvasH: CH, at: micAt });
            }
          } catch (e) { /* silent */ }

          // 미사용 참조 억제 (post-production 으로 이동)
          void tmpl; void mission; void score; void lms; void isRec;
          void drawGenreEffect; void drawHeader; void drawSubtitle;
          void drawMissionCard; void drawCombo; void drawSquatCount; void drawVoiceTicker;
          void drawTagStamp; void drawIntroOverlay; void drawOutroOverlay;
          void genreColor;
        } catch (e) {
          // 최상위 방어막: 어떤 예외도 rAF 체인을 깨뜨리지 못함.
          try { console.warn('[paintOnce] top-level caught:', e); } catch {}
        }
      };

      // rAF 경로: 항상 돌며, 비디오 준비 전에도 스피너/진단을 그려 UI freeze 를 절대 피한다.
      const drawFrame = () => {
        rafRef.current = requestAnimationFrame(drawFrame);
        paintOnce();
      };
      rafRef.current = requestAnimationFrame(drawFrame);

      // FIX-Z25 (2026-04-22): requestVideoFrameCallback 은 video 디코더가 실제로
      //   새 프레임을 뱉은 시점에만 콜백을 준다 → drawImage 가 "항상 최신 프레임"
      //   을 그리게 되어 rAF 단독 대비 iOS/Android 모두에서 훨씬 안정적. rVFC 경로는
      //   paintOnce 만 호출 (rAF 와 중복 스케줄 금지).
      const v = videoRef.current;
      let rvfcCancelled = false;
      let rvfcHandle: number | null = null;
      if (v && typeof (v as any).requestVideoFrameCallback === 'function') {
        const tick = () => {
          if (rvfcCancelled) return;
          paintOnce();
          const vv = videoRef.current;
          if (vv && typeof (vv as any).requestVideoFrameCallback === 'function') {
            rvfcHandle = (vv as any).requestVideoFrameCallback(tick);
          }
        };
        rvfcHandle = (v as any).requestVideoFrameCallback(tick);
      }

      return () => {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        rvfcCancelled = true;
        if (rvfcHandle !== null && v && typeof (v as any).cancelVideoFrameCallback === 'function') {
          try { (v as any).cancelVideoFrameCallback(rvfcHandle); } catch {}
        }
      };
    }, [ready]);

    // ------------------------------------------------------------------
    // Unmount-only cleanup (Team RELIABILITY 2026-04-22)
    //   - 녹화 중 언마운트 시 MediaRecorder.stop() 보장
    //   - 오디오 믹스 노드 disconnect
    //   - window 전역 스트림 참조 해제
    //   2회 연속 챌린지에서 프리즈 현상의 주된 원인 중 하나가 MediaRecorder 가
    //   stop 되지 않은 채 컴포넌트가 재마운트되어 canvas.captureStream 이
    //   중복 점유되는 것이었음.
    // ------------------------------------------------------------------
    useEffect(() => {
      return () => {
        try {
          if (recRef.current && recRef.current.state !== 'inactive') {
            recRef.current.stop();
          }
        } catch {}
        recRef.current = null;
        if (recStateRef.current) {
          try { resourceTracker.dec('mediaRecorder'); } catch {}
          recStateRef.current = false;
        }
        try { micSrcRef.current?.disconnect(); } catch {}
        micSrcRef.current = null;
        try { mixDestRef.current?.disconnect(); } catch {}
        mixDestRef.current = null;
        if (mixAudioCtxRef.current) {
          try { mixAudioCtxRef.current.close(); } catch {}
          try { resourceTracker.dec('audioCtx'); } catch {}
          mixAudioCtxRef.current = null;
        }
        if (frameRafRef.current !== null) {
          cancelAnimationFrame(frameRafRef.current);
          frameRafRef.current = null;
        }
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, []);

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

          // FIX-KAKAO-MP4 (2026-04-24): mp4 우선 probe. 기존엔 webm 만 검사해서
          //   Android Chrome 에서 항상 webm 녹화 → 카톡 공유 시 Play Store 리다이렉트.
          const requestedMime = pickRecordingMimeType() || '';

          const recorder = new MediaRecorder(
            canvasStream,
            requestedMime
              ? { mimeType: requestedMime, videoBitsPerSecond: 2_500_000 }
              : { videoBitsPerSecond: 2_500_000 },
          );
          recRef.current = recorder;
          recStateRef.current = true;
          try { resourceTracker.inc('mediaRecorder'); } catch {}

          // FIX-KAKAO-HANG (2026-04-24, v5): see CanvasRecorder.web.tsx note —
          //   trust `recorder.mimeType` (post-negotiation), not the requested
          //   one. Mislabeled blobs were a key Kakao "stuck mid-send" cause.
          try {
            // eslint-disable-next-line no-console
            console.info('[RecordingCameraWeb] started', {
              requested: requestedMime,
              actual: recorder.mimeType,
            });
          } catch {}

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.onstop = () => {
            recStateRef.current = false;
            try { resourceTracker.dec('mediaRecorder'); } catch {}
            const actualMime =
              (recorder.mimeType || requestedMime || 'video/webm').toLowerCase();
            const blob = new Blob(chunksRef.current, { type: actualMime });
            try {
              // eslint-disable-next-line no-console
              console.info('[RecordingCameraWeb] stopped', {
                actualMime,
                size: blob.size,
                chunkCount: chunksRef.current.length,
              });
            } catch {}
            resolve(URL.createObjectURL(blob));
          };
          recorder.onerror = (e) => {
            recStateRef.current = false;
            try { resourceTracker.dec('mediaRecorder'); } catch {}
            reject(e);
          };

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

      // FIX-Z25 (2026-04-22): 부모 컴포넌트가 유저 제스처 콜백 안에서
      //   직접 호출 → iOS Safari autoplay gesture 정책 우회. setup() 의 play()
      //   가 거부됐더라도 여기서 제스처 스택 위에서 한번 더 찔러주면 풀린다.
      kickPlay: () => {
        const vid = videoRef.current;
        if (!vid) return;
        try {
          const p = vid.play();
          if (p && typeof (p as any).catch === 'function') {
            (p as Promise<void>).catch((err) => {
              try { console.warn('[RecordingCamera] kickPlay rejected:', err); } catch {}
            });
          }
        } catch (err) {
          try { console.warn('[RecordingCamera] kickPlay threw:', err); } catch {}
        }
      },

      // CAMERA-SWAP (2026-04-23): 녹화 중 전/후면 카메라 전환.
      //   - MediaRecorder 는 canvas captureStream 을 녹화 중 → 카메라 <video> 만 교체해도 녹화 끊기지 않음.
      //   - 중복 호출 차단 (이미 swapping 이면 noop).
      //   - 실패 시 reject → 부모가 토스트로 노출.
      swapCamera: async (target: 'front' | 'back') => {
        if (swappingRef.current?.active) {
          throw new Error('이미 카메라 전환 중입니다.');
        }
        const vid = videoRef.current;
        if (!vid) throw new Error('video element 미준비');

        swappingRef.current = { active: true, startedAt: performance.now(), toFacing: target };
        setCamDiagSafe({ phase: 'acquiring', facing: target, msg: `swap → ${target}` });

        try {
          const prev = streamRef.current;
          const result = await swapCameraStream({
            prevStream: prev,
            target,
            onPrevStop: () => {
              // 모듈 내부 _streamCache 일관성 유지 (RecordingCamera.web.tsx 의 캐시).
              if (_streamCache) {
                try { resourceTracker.dec('mediaStream'); } catch {}
                _streamCache = null;
              }
            },
          });

          if (!result.ok) {
            // 원복 stream 이 있으면 복원
            if (result.revertedStream && result.revertedFacing) {
              streamRef.current = result.revertedStream;
              _streamCache = { stream: result.revertedStream, facing: result.revertedFacing };
              try { resourceTracker.inc('mediaStream'); } catch {}
              try { vid.srcObject = result.revertedStream; } catch {}
              try { await vid.play(); } catch {}
              facingRef.current = result.revertedFacing;
              mountedFacingRef.current = result.revertedFacing;
            }
            throw (result.error instanceof Error ? result.error : new Error(String(result.error)));
          }

          // 성공 — 캐시 + videoRef 갱신, facingRef 즉시 갱신(캔버스 mirror 플래그)
          streamRef.current = result.stream;
          _streamCache = { stream: result.stream, facing: result.facing };
          try { resourceTracker.inc('mediaStream'); } catch {}
          (window as any).__cameraStream = result.stream;
          try { vid.srcObject = result.stream; } catch {}

          // loadedmetadata 대기 — 최대 1.2s
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            const onMeta = () => { vid.removeEventListener('loadedmetadata', onMeta); finish(); };
            vid.addEventListener('loadedmetadata', onMeta, { once: true });
            setTimeout(finish, 1200);
            if (vid.readyState >= 1 && vid.videoWidth > 0) finish();
          });
          try { await vid.play(); } catch {}

          facingRef.current = result.facing;
          mountedFacingRef.current = result.facing;
          setCamDiagSafe({ phase: 'playing', facing: result.facing, msg: 'swap ok' });
        } finally {
          // 페이드아웃 여유 200ms 후 오버레이 해제
          setTimeout(() => { swappingRef.current = null; }, 200);
        }
      },
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
        {/* FIX-Z24 (2026-04-22): off-screen (-9999px) 로 옮긴 FIX-Z21 이 실기기에서
              여전히 디코더 culling 을 유발 → videoWidth=0 고착. iOS/Android 웹뷰는
              viewport 내 visible 여부를 디코더 활성 조건으로 삼는다. 해법: 실제
              viewport 안에 full-size 로 위치시키되 canvas 가 위를 덮게 해 유저에게는
              안 보이게 한다. visibility:hidden 은 iOS 에서 동일 culling, opacity:0
              도 마찬가지 → 화면에 그려지되 canvas 가 가리는 방식이 가장 안전. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          style={{
            position: 'absolute' as any,
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            // @ts-ignore web
            objectFit: 'cover',
            zIndex: 0,
            pointerEvents: 'none' as any,
          }}
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
            position: 'relative' as any,
            zIndex: 1,
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

        {/* FIX-AA (2026-04-22): 카메라 진단 뱃지. 실기기에서 프리뷰가 멈췄을 때
              어느 단계인지 즉시 식별. 좌상단 한 줄 모노스페이스. */}
        <View pointerEvents="none" style={st.camDiag}>
          <Text style={st.camDiagText}>
            📷 {camDiag.facing}{camDiag.phase==='playing' && ' ✓'} {camDiag.phase}
            {' '}{camDiag.vw}×{camDiag.vh} rs{camDiag.ready}
            {camDiag.paused ? ' ⏸' : ' ▶'}
            {camDiag.msg ? ` · ${camDiag.msg.slice(0, 24)}` : ''}
            {camDiag.events.length ? `\nev: ${camDiag.events.join(' → ')}` : ''}
          </Text>
        </View>
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
  // FIX-Z26: canvas 에 zIndex:1 을 부여한 이후 DOM children (미션 카드·
  //   PoseCalibration·RecognitionStatusPanel) 이 canvas 아래로 깔려 안 보이던
  //   리그레션. 명시적 zIndex:10 으로 항상 canvas 위에 올린다.
  children: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 } as any,
  denied:   { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedIcon:    { fontSize: 48, marginBottom: 16 },
  deniedTitle:   { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  deniedBody:    { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  deniedBtn:     { backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  deniedBtnText: { color: '#111', fontSize: 15, fontWeight: '600' },
  camDiag: {
    position: 'absolute' as any,
    top: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4,
    zIndex: 9999,
  } as any,
  camDiagText: {
    color: '#7fffd4',
    fontSize: 10,
    fontFamily: 'monospace' as any,
    letterSpacing: 0.3,
  } as any,
});
