import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { RecordingCameraHandle } from './RecordingCamera';
import type { NormalizedLandmark } from '../../utils/poseUtils';

// ---------------------------------------------------------------------------
// Module-level stream cache (singleton) -- persists across navigations
// ---------------------------------------------------------------------------
let _streamCache: { stream: MediaStream; facing: 'front' | 'back' } | null = null;

async function acquireStream(facing: 'front' | 'back'): Promise<MediaStream> {
  // 1. 이미 캐시된 스트림 재사용 (챌린지 간 권한 팝업 방지)
  if (_streamCache) {
    const allLive = _streamCache.stream
      .getTracks()
      .every((t) => t.readyState === 'live');
    if (allLive && _streamCache.facing === facing) {
      return _streamCache.stream;
    }
    // 만료되거나 방향이 다른 스트림: 정리 후 재취득
    _streamCache.stream.getTracks().forEach((t) => t.stop());
    _streamCache = null;
  }

  // 2. _layout.tsx에서 사이트 최초 진입 시 미리 취득한 스트림 재사용
  //    → 두 번째 권한 팝업 완전 차단
  if (typeof window !== 'undefined') {
    const preStream = (window as any).__permissionStream as MediaStream | undefined;
    if (preStream && preStream.getTracks().every((t) => t.readyState === 'live')) {
      _streamCache = { stream: preStream, facing };
      return preStream;
    }
  }

  // 3. 폴백: 직접 getUserMedia 요청
  const facingMode = facing === 'front' ? 'user' : 'environment';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  _streamCache = { stream, facing };
  return stream;
}

// ---------------------------------------------------------------------------
// MediaPipe Pose 33-point connections
// ---------------------------------------------------------------------------
const POSE_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],
  [9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],
  [17,19],[12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
  [11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],
  [27,29],[28,30],[29,31],[30,32],[27,31],[28,32],
];

function landmarkColor(index: number): string {
  if (index <= 10) return 'rgba(255,200,0,0.85)';
  if (index <= 22) return 'rgba(0,255,136,0.95)';
  return 'rgba(0,150,255,0.95)';
}

// ---------------------------------------------------------------------------
// Canvas Skeleton Overlay
// ---------------------------------------------------------------------------
interface SkeletonCanvasProps {
  landmarks: NormalizedLandmark[];
  mirrored: boolean;
}

function SkeletonCanvas({ landmarks, mirrored }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!landmarks || landmarks.length === 0) return;

    const toX = (lm: NormalizedLandmark) => {
      const x = lm.x * w;
      return mirrored ? w - x : x;
    };
    const toY = (lm: NormalizedLandmark) => lm.y * h;

    const conf = (lm: NormalizedLandmark) =>
      lm.visibility ?? lm.score ?? 1;

    // Draw connections
    for (const [a, b] of POSE_CONNECTIONS) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      if (!lmA || !lmB) continue;
      if (conf(lmA) < 0.3 || conf(lmB) < 0.3) continue;

      const color = landmarkColor(a);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(toX(lmA), toY(lmA));
      ctx.lineTo(toX(lmB), toY(lmB));
      ctx.stroke();
      ctx.restore();
    }

    // Draw landmark dots
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm || conf(lm) < 0.3) continue;
      const color = landmarkColor(i);
      const radius = i <= 10 ? 4 : 5;

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(toX(lm), toY(lm), radius, 0, Math.PI * 2);
      ctx.fill();

      // Colored ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }, [landmarks, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RecordingCameraWebProps {
  facing?: 'front' | 'back';
  onFrame?: (video: HTMLVideoElement) => void;
  onPermissionDenied?: () => void;
  children?: React.ReactNode;
  paused?: boolean;
  landmarks?: NormalizedLandmark[];
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
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const frameRafRef = useRef<number | null>(null);
    const mountedFacingRef = useRef<'front' | 'back'>(facing);

    const [denied, setDenied] = useState(false);
    const [ready, setReady] = useState(false);
    const [recording, setRecording] = useState(false);

    // ------------------------------------------------------------------
    // Stream acquisition
    // ------------------------------------------------------------------
    useEffect(() => {
      let cancelled = false;

      const setup = async () => {
        // If facing changed within the same mount, evict the cached stream
        // so acquireStream opens a correctly-oriented one.
        if (mountedFacingRef.current !== facing && _streamCache) {
          _streamCache.stream.getTracks().forEach((t) => t.stop());
          _streamCache = null;
        }
        mountedFacingRef.current = facing;

        try {
          const stream = await acquireStream(facing);
          if (cancelled) return;

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {
              // autoplay may be briefly blocked; not fatal
            });
            // Expose video element globally for pose detection (TF.js web)
            (window as any).__poseVideoEl = videoRef.current;
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
        // Do NOT stop the stream on unmount -- keep alive in cache
        // so the next navigation reuses it without re-prompting the user.
        if (frameRafRef.current !== null) {
          cancelAnimationFrame(frameRafRef.current);
          frameRafRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    // ------------------------------------------------------------------
    // onFrame callback loop
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // Imperative handle
    // ------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          const stream = streamRef.current;
          if (!stream) {
            reject(new Error('No camera stream available'));
            return;
          }

          chunksRef.current = [];

          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

          const recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
          );
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, {
              type: mimeType || 'video/webm',
            });
            const url = URL.createObjectURL(blob);
            resolve(url);
          };

          recorder.onerror = (e) => reject(e);

          recorder.start(100); // collect data in 100 ms chunks
          setRecording(true);
        }),

      stopRecording: () => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== 'inactive'
        ) {
          mediaRecorderRef.current.stop();
          // Intentionally do NOT stop the camera stream
        }
        setRecording(false);
      },

      isRecording: () => recording,
    }));

    // ------------------------------------------------------------------
    // Permission-denied UI
    // ------------------------------------------------------------------
    if (denied) {
      return (
        <View style={styles.deniedContainer}>
          <Text style={styles.deniedIcon}>📷</Text>
          <Text style={styles.deniedTitle}>카메라 접근 거부됨</Text>
          <Text style={styles.deniedBody}>
            브라우저 설정에서 카메라 및 마이크 권한을 허용해 주세요.
          </Text>
          <TouchableOpacity
            style={styles.deniedButton}
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
                .catch(() => {
                  setDenied(true);
                  onPermissionDenied?.();
                });
            }}
          >
            <Text style={styles.deniedButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ------------------------------------------------------------------
    // Main render
    // ------------------------------------------------------------------
    return (
      <View style={styles.container}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Mirror front camera so it feels natural (selfie orientation)
            transform: facing === 'front' ? 'scaleX(-1)' : 'none',
            display: 'block',
          }}
          autoPlay
          playsInline
          muted
        />
        {/* Skeleton overlay — drawn on canvas for zero RN layout overhead */}
        {landmarks && landmarks.length > 0 && (
          <SkeletonCanvas landmarks={landmarks} mirrored={facing === 'front'} />
        )}
        {/* Children are rendered absolutely on top of the video feed */}
        {children && (
          <View style={styles.childrenLayer} pointerEvents="box-none">
            {children}
          </View>
        )}
        {/* Recording indicator dot */}
        {recording && <View style={styles.recDot} />}
      </View>
    );
  },
);

RecordingCameraWeb.displayName = 'RecordingCameraWeb';

export default RecordingCameraWeb;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative' as any,
    overflow: 'hidden' as any,
  },
  childrenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  recDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  deniedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  deniedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deniedBody: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  deniedButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  deniedButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
});
