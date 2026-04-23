/**
 * CanvasRecorder.web.tsx
 * Canvas 합성 녹화 컴포넌트 (웹 전용)
 *
 * - 숨긴 <video>로 카메라 피드 수신
 * - 표시용 <canvas>(720×1280, 9:16) 에 매 프레임마다 합성
 * - canvas.captureStream(30) + 카메라 오디오 → MediaRecorder 녹화
 * - stopRecording() → Blob URL 반환
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

// ---------------------------------------------------------------------------
// Canvas dimensions (9:16 portrait)
// ---------------------------------------------------------------------------
const CW = 720;
const CH = 1280;

// ---------------------------------------------------------------------------
// Stream cache (singleton) — same pattern as RecordingCamera.web.tsx
// ---------------------------------------------------------------------------
let _canvasStreamCache: { stream: MediaStream; facing: 'front' | 'back' } | null = null;

async function acquireStream(facing: 'front' | 'back'): Promise<MediaStream> {
  if (_canvasStreamCache) {
    const allLive = _canvasStreamCache.stream
      .getTracks()
      .every((t) => t.readyState === 'live');
    if (allLive && _canvasStreamCache.facing === facing) {
      return _canvasStreamCache.stream;
    }
    _canvasStreamCache.stream.getTracks().forEach((t) => t.stop());
    _canvasStreamCache = null;
  }

  if (typeof window !== 'undefined') {
    const preStream = (window as any).__permissionStream as MediaStream | undefined;
    if (preStream && preStream.getTracks().every((t) => t.readyState === 'live')) {
      _canvasStreamCache = { stream: preStream, facing };
      return preStream;
    }
  }

  const facingMode = facing === 'front' ? 'user' : 'environment';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width:  { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  _canvasStreamCache = { stream, facing };
  return stream;
}

// ---------------------------------------------------------------------------
// Genre colors
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
function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#7c3aed';
}

// ---------------------------------------------------------------------------
// Canvas draw helpers
// ---------------------------------------------------------------------------
function drawCamera(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  facing: 'front' | 'back',
) {
  if (video.readyState < 2) return; // HAVE_CURRENT_DATA
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return;

  const videoAR  = vw / vh;
  const canvasAR = CW / CH; // 9/16

  if (facing === 'front') {
    ctx.save();
    ctx.translate(CW, 0);
    ctx.scale(-1, 1);
  }

  if (videoAR > canvasAR) {
    // Video wider than canvas → crop left/right
    const srcH = vh;
    const srcW = srcH * canvasAR;
    const srcX = (vw - srcW) / 2;
    ctx.drawImage(video, srcX, 0, srcW, srcH, 0, 0, CW, CH);
  } else {
    // Video taller than canvas → crop top/bottom
    const srcW = vw;
    const srcH = srcW / canvasAR;
    const srcY = (vh - srcH) / 2;
    ctx.drawImage(video, 0, srcY, srcW, srcH, 0, 0, CW, CH);
  }

  if (facing === 'front') {
    ctx.restore();
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  template: any,
  elapsed: number,
  isRec: boolean,
) {
  const color = getGenreColor(template?.genre ?? '');

  // Dark background bar
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CW, 90);

  // Accent line at bottom of bar
  ctx.fillStyle = color;
  ctx.fillRect(0, 88, CW, 2);

  // Template name (center)
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  const name = template ? `${template.theme_emoji ?? ''}  ${template.name ?? ''}` : '';
  ctx.fillText(name, CW / 2, 56);

  if (isRec) {
    // Remaining time (top-right)
    const durationSec = template?.duration_sec ?? 0;
    const remainSec = Math.max(0, durationSec - Math.floor(elapsed / 1000));
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText(`${mm}:${ss}`, CW - 20, 56);

    // REC dot (top-left)
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
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

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: string | undefined,
  genreColor: string,
) {
  if (!text) return;
  const y = 1150;

  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  const metrics = ctx.measureText(text);
  const boxW = Math.min(metrics.width + 60, 680);
  const boxH = 70;
  const x = (CW - boxW) / 2;

  ctx.fillStyle =
    style === 'highlight'
      ? `rgba(${hexToRgb(genreColor)},0.88)`
      : 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  roundRect(ctx, x, y - boxH + 10, boxW, boxH, 12);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, CW / 2, y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawMissionCard(
  ctx: CanvasRenderingContext2D,
  mission: any,
  score: number,
) {
  if (!mission) return;
  const y = 900;
  const cardW = 660;
  const cardH = 110;
  const x = (CW - cardW) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  ctx.beginPath();
  roundRect(ctx, x, y, cardW, cardH, 16);
  ctx.fill();

  // Score bar
  const barColor =
    score >= 0.8 ? '#22c55e' : score >= 0.55 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = barColor;
  ctx.beginPath();
  roundRect(ctx, x, y + cardH - 6, cardW * score, 6, 3);
  ctx.fill();

  // Mission text
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  // FIX-SCRIPT-POOL (2026-04-23): read_text 가 배열 가능 → 첫 엔트리 폴백.
  const rt = Array.isArray(mission.read_text) ? (mission.read_text[0] ?? '') : (mission.read_text ?? '');
  const label: string = mission.guide_text ?? rt ?? '';
  ctx.fillText(label.slice(0, 22), CW / 2, y + 52);

  // Score number
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = barColor;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(score * 100)}점`, x + cardW - 16, y + 88);
}

function drawGenreEffect(
  ctx: CanvasRenderingContext2D,
  genre: string,
  elapsed: number,
) {
  if (genre === 'kpop' || genre === 'hiphop') {
    const pulse = Math.sin(elapsed * 0.005) * 0.3 + 0.5;
    ctx.strokeStyle = `rgba(233,69,96,${pulse.toFixed(2)})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, CW - 8, CH - 8);
  } else if (genre === 'news') {
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, CH - 80, CW, 6);
    ctx.fillStyle = 'rgba(13,28,53,0.85)';
    ctx.fillRect(0, CH - 74, CW, 74);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#e3f2fd';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE NEWS', 20, CH - 28);
  } else if (genre === 'fitness') {
    const pct = Math.sin(elapsed * 0.001) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(20,184,166,0.3)';
    ctx.fillRect(0, 92, 8, CH - 92);
    ctx.fillStyle = '#14b8a6';
    ctx.fillRect(0, 92 + (CH - 92) * (1 - pct), 8, (CH - 92) * pct);
  }
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  mirrored: boolean,
) {
  if (!landmarks || landmarks.length < 17) return;

  const CONNECTIONS: [number, number][] = [
    [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],
    [9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],
    [17,19],[12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
    [11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],
    [27,29],[28,30],[29,31],[30,32],[27,31],[28,32],
  ];

  const conf = (lm: any) => lm.visibility ?? lm.score ?? 1;
  const toX  = (lm: any) => {
    const x = lm.x * CW;
    return mirrored ? CW - x : x;
  };
  const toY = (lm: any) => lm.y * CH;

  const lmColor = (i: number) =>
    i <= 10 ? '#fbbf24' : i <= 22 ? '#00ff88' : '#00aaff';

  // Connections
  for (const [a, b] of CONNECTIONS) {
    const lmA = landmarks[a];
    const lmB = landmarks[b];
    if (!lmA || !lmB) continue;
    if (conf(lmA) < 0.3 || conf(lmB) < 0.3) continue;
    ctx.save();
    ctx.strokeStyle = lmColor(a);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = lmColor(a);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(toX(lmA), toY(lmA));
    ctx.lineTo(toX(lmB), toY(lmB));
    ctx.stroke();
    ctx.restore();
  }

  // Dots
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || conf(lm) < 0.3) continue;
    const color  = lmColor(i);
    const radius = i <= 10 ? 4 : 5;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(toX(lm), toY(lm), radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Hex color helper (for rgba)
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// ---------------------------------------------------------------------------
// Props / Handle types
// ---------------------------------------------------------------------------
export interface CanvasRecorderProps {
  facing?:             'front' | 'back';
  template:            any;
  elapsed:             number;
  currentMission:      any | null;
  missionScore:        number;
  isRecording:         boolean;
  landmarks?:          any[];
  onReady?:            () => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  // Legacy props forwarded from RecordingCamera usage
  onFrame?:            (video: HTMLVideoElement) => void;
  paused?:             boolean;
}

export interface CanvasRecorderHandle {
  startRecording: () => Promise<string>;
  stopRecording:  () => void;
  isRecording:    () => boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CanvasRecorder = forwardRef<CanvasRecorderHandle, CanvasRecorderProps>(
  (
    {
      facing = 'front',
      template,
      elapsed,
      currentMission,
      missionScore,
      isRecording,
      landmarks,
      onReady,
      onPermissionDenied,
      children,
      onFrame,
      paused = false,
    },
    ref,
  ) => {
    const videoRef   = useRef<HTMLVideoElement | null>(null);
    const canvasRef  = useRef<HTMLCanvasElement | null>(null);
    const streamRef  = useRef<MediaStream | null>(null);
    const rafRef     = useRef<number | null>(null);
    const recRef     = useRef<MediaRecorder | null>(null);
    const chunksRef  = useRef<Blob[]>([]);
    const frameRafRef = useRef<number | null>(null);

    // Stable refs for closure access in rAF loop
    const elapsedRef       = useRef(elapsed);
    const isRecordingRef   = useRef(isRecording);
    const currentMissionRef = useRef(currentMission);
    const missionScoreRef  = useRef(missionScore);
    const landmarksRef     = useRef(landmarks);
    const templateRef      = useRef(template);
    const facingRef        = useRef(facing);
    const recStateRef      = useRef(false); // true while MediaRecorder running

    // Sync refs
    elapsedRef.current        = elapsed;
    isRecordingRef.current     = isRecording;
    currentMissionRef.current  = currentMission;
    missionScoreRef.current    = missionScore;
    landmarksRef.current       = landmarks;
    templateRef.current        = template;
    facingRef.current          = facing;

    const [denied, setDenied] = useState(false);
    const [ready, setReady]   = useState(false);

    // ----------------------------------------------------------------
    // Stream setup
    // ----------------------------------------------------------------
    useEffect(() => {
      let cancelled = false;

      const setup = async () => {
        if (
          _canvasStreamCache &&
          _canvasStreamCache.facing !== facing
        ) {
          _canvasStreamCache.stream.getTracks().forEach((t) => t.stop());
          _canvasStreamCache = null;
        }

        try {
          const stream = await acquireStream(facing);
          if (cancelled) return;
          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            (window as any).__poseVideoEl = videoRef.current;
          }
          setDenied(false);
          setReady(true);
          onReady?.();
        } catch (err) {
          if (cancelled) return;
          console.warn('[CanvasRecorder] getUserMedia failed:', err);
          setDenied(true);
          setReady(false);
          onPermissionDenied?.();
        }
      };

      setup();

      return () => {
        cancelled = true;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    // ----------------------------------------------------------------
    // onFrame callback loop (for pose detection compatibility)
    // ----------------------------------------------------------------
    useEffect(() => {
      if (!ready || !onFrame || paused) return;

      const loop = () => {
        if (videoRef.current) onFrame(videoRef.current);
        frameRafRef.current = requestAnimationFrame(loop);
      };
      frameRafRef.current = requestAnimationFrame(loop);

      return () => {
        if (frameRafRef.current !== null) {
          cancelAnimationFrame(frameRafRef.current);
          frameRafRef.current = null;
        }
      };
    }, [ready, onFrame, paused]);

    // ----------------------------------------------------------------
    // rAF draw loop
    // ----------------------------------------------------------------
    useEffect(() => {
      if (!ready) return;

      const drawFrame = () => {
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video) {
          rafRef.current = requestAnimationFrame(drawFrame);
          return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          rafRef.current = requestAnimationFrame(drawFrame);
          return;
        }

        const tmpl    = templateRef.current;
        const elap    = elapsedRef.current;
        const isRec   = isRecordingRef.current;
        const mission = currentMissionRef.current;
        const score   = missionScoreRef.current;
        const lms     = landmarksRef.current;
        const face    = facingRef.current;

        // 1. Camera (center-cropped, 9:16)
        drawCamera(ctx, video, face);

        // 2. Genre effect (border glow / news bar / fitness bar)
        // FIX-VOICE-READ-BOTTOM (2026-04-23): news 장르 'LIVE NEWS' 하단 바가
        //   voice_read 중 대본 영역과 겹침 → voice_read 미션엔 장르 효과 스킵.
        if (tmpl && mission?.type !== 'voice_read') drawGenreEffect(ctx, tmpl.genre ?? '', elap);

        // 3. Header bar
        if (tmpl) drawHeader(ctx, tmpl, elap, isRec);

        // 4. Subtitle
        // FIX-SUBTITLE-DUP (2026-04-23): voice_read 미션 중엔 상단 텔레프롬프터 외에
        //   하단 캔버스 자막이 이중으로 그려져 사용자 혼선. 해당 타입일 때는 스킵.
        if (tmpl && mission?.type !== 'voice_read') {
          const timeline: Array<{ start_ms: number; end_ms: number; text: string; style?: string }> =
            tmpl.subtitle_timeline ?? [];
          const sub = timeline.find(
            (s) => elap >= s.start_ms && elap < s.end_ms,
          );
          if (sub) {
            drawSubtitle(ctx, sub.text, sub.style, getGenreColor(tmpl.genre ?? ''));
          }
        }

        // 5. Mission card (only while recording)
        // FIX-VOICE-READ-BOTTOM (2026-04-23): voice_read 미션 카드가 read_text 를
        //   하단(y=900)에 다시 그려 '하단 자막'처럼 보임 → 상단 텔레프롬프터와 이중화.
        //   voice_read 타입에서는 캔버스 미션 카드도 스킵.
        if (isRec && mission && mission.type !== 'voice_read') {
          drawMissionCard(ctx, mission, score);
        }

        // 6. Skeleton
        if (lms && lms.length > 0) {
          drawSkeleton(ctx, lms, face === 'front');
        }

        rafRef.current = requestAnimationFrame(drawFrame);
      };

      rafRef.current = requestAnimationFrame(drawFrame);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, [ready]);

    // ----------------------------------------------------------------
    // Imperative handle (same interface as RecordingCameraHandle)
    // ----------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          const canvas = canvasRef.current;
          const stream = streamRef.current;
          if (!canvas || !stream) {
            reject(new Error('[CanvasRecorder] canvas or stream not ready'));
            return;
          }

          chunksRef.current = [];

          // Canvas stream at 30 fps
          const canvasStream: MediaStream = (canvas as any).captureStream
            ? (canvas as any).captureStream(30)
            : (canvas as any).mozCaptureStream(30);

          // Add audio tracks from camera stream
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
          recRef.current  = recorder;
          recStateRef.current = true;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
            recStateRef.current = false;
            const blob = new Blob(chunksRef.current, {
              type: mimeType || 'video/webm',
            });
            resolve(URL.createObjectURL(blob));
          };

          recorder.onerror = (e) => {
            recStateRef.current = false;
            reject(e);
          };

          recorder.start(100); // collect in 100 ms chunks
        }),

      stopRecording: () => {
        if (recRef.current && recRef.current.state !== 'inactive') {
          recRef.current.stop();
        }
        // Do NOT stop camera stream
      },

      isRecording: () => recStateRef.current,
    }));

    // ----------------------------------------------------------------
    // Permission-denied UI
    // ----------------------------------------------------------------
    if (denied) {
      return (
        <View style={s.denied}>
          <Text style={s.deniedIcon}>📷</Text>
          <Text style={s.deniedTitle}>카메라 접근 거부됨</Text>
          <Text style={s.deniedBody}>
            브라우저 설정에서 카메라 및 마이크 권한을 허용해 주세요.
          </Text>
          <TouchableOpacity
            style={s.deniedBtn}
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
                  onReady?.();
                })
                .catch(() => {
                  setDenied(true);
                  onPermissionDenied?.();
                });
            }}
          >
            <Text style={s.deniedBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ----------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------
    return (
      <View style={s.container}>
        {/* Hidden video element — camera feed source */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />

        {/* Canvas — composited output (displayed + recorded) */}
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{
            width:    '100%',
            height:   '100%',
            objectFit: 'cover',
            display:  'block',
          }}
        />

        {/* React children — HUD overlay (countdown, buttons, etc.) */}
        {children && (
          <View style={s.children} pointerEvents="box-none">
            {children}
          </View>
        )}
      </View>
    );
  },
);

CanvasRecorder.displayName = 'CanvasRecorder';
export default CanvasRecorder;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative' as any,
    overflow: 'hidden' as any,
  },
  children: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  denied: {
    flex: 1, backgroundColor: '#F7F3EB',
    alignItems: 'center', justifyContent: 'center', padding: 32,
    // @ts-ignore web
    backgroundImage: 'radial-gradient(120% 90% at 50% 20%, #FBF7EE 0%, #F7F3EB 55%, #EEE6D5 100%)',
  },
  deniedIcon:    { fontSize: 48, marginBottom: 16 },
  deniedTitle:   {
    color: '#1F1B16', fontSize: 22, fontWeight: '800',
    marginBottom: 12, textAlign: 'center', letterSpacing: -0.3,
    // @ts-ignore web
    fontFamily: '"Tiempos Headline","Copernicus","Source Serif Pro",Georgia,"Times New Roman",serif',
  },
  deniedBody:    { color: '#6F675A', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 360, fontWeight: '500' },
  deniedBtn:     {
    backgroundColor: '#1F1B16', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 999, borderWidth: 1, borderColor: '#CC785C',
    // @ts-ignore web
    boxShadow: '0 8px 18px -10px rgba(204,120,92,0.6)',
  },
  deniedBtnText: { color: '#F7F3EB', fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
});
