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

function drawGenreEffect(
  ctx: CanvasRenderingContext2D,
  genre: string,
  elapsed: number,
) {
  if (genre === 'kpop' || genre === 'hiphop') {
    // 비트 동기화 네온 보더 + 스파클
    const beat = Math.sin(elapsed * 0.008) * 0.5 + 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(233,69,96,${(0.3 + beat * 0.6).toFixed(2)})`;
    ctx.lineWidth = 6 + beat * 8;
    ctx.shadowColor = 'rgba(233,69,96,0.7)';
    ctx.shadowBlur = 20;
    ctx.strokeRect(6, 6, CW - 12, CH - 12);
    ctx.shadowBlur = 0;
    // 모서리 장식
    const corner = 40;
    ctx.strokeStyle = `rgba(255,215,0,${(0.6 + beat * 0.4).toFixed(2)})`;
    ctx.lineWidth = 4;
    [[0,0],[CW,0],[0,CH],[CW,CH]].forEach(([x,y],i)=>{
      const sx = i%2===0 ? 1 : -1;
      const sy = i<2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + sx*20, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy*20);
      ctx.stroke();
    });
    ctx.restore();
  } else if (genre === 'news') {
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, CH - 80, CW, 6);
    ctx.fillStyle = 'rgba(13,28,53,0.85)';
    ctx.fillRect(0, CH - 74, CW, 74);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#e3f2fd'; ctx.textAlign = 'left';
    ctx.fillText('● LIVE NEWS', 20, CH - 28);
    // 시간 표시
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    ctx.textAlign = 'right';
    ctx.fillText(`${hh}:${mm}`, CW - 20, CH - 28);
  } else if (genre === 'fitness') {
    // 양쪽 바: 펄스 프로그레스
    const pct = Math.sin(elapsed * 0.001) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(20,184,166,0.3)';
    ctx.fillRect(0, 92, 8, CH - 92);
    ctx.fillRect(CW - 8, 92, 8, CH - 92);
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(0, 92 + (CH - 92) * (1 - pct), 8, (CH - 92) * pct);
    ctx.fillRect(CW - 8, 92 + (CH - 92) * (1 - pct), 8, (CH - 92) * pct);
  } else if (genre === 'daily' || genre === 'travel') {
    // 하단 vlog 자막 스트립
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CH - 50, CW, 50);
    ctx.font = '600 16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText(`📅 ${new Date().toLocaleDateString('ko-KR')}`, 18, CH - 20);
    ctx.textAlign = 'right';
    ctx.fillText('My Vlog', CW - 18, CH - 20);
  }
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

      const drawFrame = () => {
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video) { rafRef.current = requestAnimationFrame(drawFrame); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx) { rafRef.current = requestAnimationFrame(drawFrame); return; }

        const tmpl    = templateRef.current;
        const elap    = elapsedRef.current;
        const isRec   = isRecordingRef.current;
        const mission = currentMissionRef.current;
        const score   = missionScoreRef.current;
        const lms     = landmarksRef.current;
        const face    = facingRef.current;

        // 1. Camera
        drawCamera(ctx, video, face);

        // 2. Genre effect
        if (tmpl) drawGenreEffect(ctx, tmpl.genre ?? '', elap);

        // 3. Header
        if (tmpl) drawHeader(ctx, tmpl, elap, isRec);

        // 4. Subtitle
        if (tmpl) {
          const timeline: { start_ms: number; end_ms: number; text: string; style?: string }[] =
            tmpl.subtitle_timeline ?? [];
          const sub = timeline.find((s) => elap >= s.start_ms && elap < s.end_ms);
          if (sub) drawSubtitle(ctx, sub.text, sub.style, genreColor(tmpl.genre ?? ''));
        }

        // 5. Mission card
        if (isRec && mission) drawMissionCard(ctx, mission, score);

        // 6. Skeleton — 숨김 처리 (판정용으로만 사용, 화면/최종 영상에 노출 금지)
        void lms; void drawSkeleton;

        // 7. Live judgement overlays
        if (isRec) {
          const nowMs = performance.now();
          drawCombo(ctx, comboRef.current, elap);
          if (tmpl?.genre === 'fitness') drawSquatCount(ctx, squatCountRef.current);
          if (voiceTranscriptRef.current) drawVoiceTicker(ctx, voiceTranscriptRef.current, genreColor(tmpl?.genre ?? ''));
          drawTagStamp(ctx, currentTagRef.current, tagTimestampRef.current, nowMs);
        }

        rafRef.current = requestAnimationFrame(drawFrame);
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
