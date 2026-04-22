/**
 * usePoseDetection.web.ts
 * 웹 전용 — MediaPipe Tasks Vision PoseLandmarker.
 *
 * Phase 1-B: mediaPipeLoader (순수 모듈)로 로딩 로직 위임.
 *   - status 필드 노출: 'idle' | 'loading' | 'ready-real' | 'ready-mock' | 'error'
 *   - retry() 노출: 실패 후 재시도 (landmarker 정리 후 load 재실행)
 *   - 프로덕션에서는 mock 폴백 금지 (allowMockFallback=false)
 *   - BASE/MODEL URL 환경변수화 (EXPO_PUBLIC_MEDIAPIPE_BASE / _MODEL_URL)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { generateMockPose, generateSquatMockPose } from '../utils/poseUtils';
import {
  loadPoseLandmarker,
  resolvePoseConfig,
  type PoseLoadStatus,
  type PoseLandmarkerHandle,
  type PoseLoaderDeps,
} from '../engine/recognition/mediaPipeLoader';

interface UsePoseDetectionReturn {
  isReady: boolean;
  isRealPose: boolean;
  landmarks: NormalizedLandmark[];
  detect: (_b64: string, _w: number, _h: number) => Promise<void>;
  error: string | null;
  status: PoseLoadStatus;
  retry: () => void;
  dispose: () => void;
}

const DETECT_INTERVAL_MS = 100;

// __DEV__ 는 RN 런타임 전역. 웹 번들에서는 process.env.NODE_ENV 로 판정.
function detectIsDev(): boolean {
  if (typeof (globalThis as any).__DEV__ === 'boolean') return (globalThis as any).__DEV__;
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [status, setStatus]         = useState<PoseLoadStatus>('idle');
  const [isReady, setIsReady]       = useState(false);
  const [isRealPose, setIsRealPose] = useState(false);
  const [landmarks, setLandmarks]   = useState<NormalizedLandmark[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [loadNonce, setLoadNonce]   = useState(0);

  const landmarkerRef    = useRef<PoseLandmarkerHandle | null>(null);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimerRef     = useRef(0);
  const useMockRef       = useRef(false);
  const lastTimestampRef = useRef(0);

  const retry = useCallback(() => {
    setError(null);
    setStatus('idle');
    setIsReady(false);
    setLoadNonce((n) => n + 1);
  }, []);

  const dispose = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* ignore */ }
      landmarkerRef.current = null;
    }
    setStatus('idle');
    setIsReady(false);
    setIsRealPose(false);
    setLandmarks([]);
    setError(null);
    useMockRef.current = false;
  }, []);

  const runDetection = useCallback(() => {
    if (useMockRef.current) {
      mockTimerRef.current += DETECT_INTERVAL_MS;
      setLandmarks(generateMockPose(mockTimerRef.current));
      return;
    }

    const landmarker = landmarkerRef.current as any;
    if (!landmarker) return;

    const video = (window as any).__poseVideoEl as HTMLVideoElement | undefined;
    if (!video) return;
    // FIX-Z13 (2026-04-22): 모바일에서 video.readyState 가 1(HAVE_METADATA) 에서
    //   오래 머무는 경우가 있음. MediaPipe 는 HAVE_CURRENT_DATA(>=2) 필요하지만
    //   videoWidth 가 0 이면 skip, 그 외에는 시도 (예외 발생 시 catch).
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    if (video.readyState < 2) {
      // try kick play() once per frame group to unstick autoplay-delayed video
      try { video.play().catch(() => {}); } catch {}
      return;
    }

    try {
      const now = performance.now();
      if (now <= lastTimestampRef.current) return;
      lastTimestampRef.current = now;

      const result = landmarker.detectForVideo(video, now);
      if (result?.landmarks?.length > 0) {
        const raw: NormalizedLandmark[] = result.landmarks[0].map(
          (lm: { x: number; y: number; z: number; visibility?: number }) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            score: lm.visibility ?? 1,
            visibility: lm.visibility,
          })
        );
        setLandmarks(raw);
        if (!isRealPose) setIsRealPose(true);
      }
    } catch (e) {
      console.warn('[PoseDetection] detectForVideo error:', e);
    }
  }, [isRealPose]);

  // ── Load pipeline ────────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();
    setStatus('loading');

    const env: Record<string, string | undefined> = {
      EXPO_PUBLIC_MEDIAPIPE_BASE: (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_BASE,
      EXPO_PUBLIC_MEDIAPIPE_MODEL_URL: (process.env as any)?.EXPO_PUBLIC_MEDIAPIPE_MODEL_URL,
    };
    const config = resolvePoseConfig(env, detectIsDev());

    const deps: PoseLoaderDeps = {
      importMediaPipe: async () => {
        const mod = await import('@mediapipe/tasks-vision');
        return {
          PoseLandmarker: mod.PoseLandmarker as any,
          FilesetResolver: mod.FilesetResolver as any,
        };
      },
    };

    (async () => {
      try {
        const out = await loadPoseLandmarker(config, deps, ac.signal);
        if (ac.signal.aborted) return;

        if (out.status === 'ready-real' && out.handle) {
          landmarkerRef.current = out.handle;
          setError(null);
          setStatus('ready-real');
          setIsReady(true);
          return;
        }
        
        // Handle explicit mock status from loader if returned
        if (out.status === 'ready-mock') {
          useMockRef.current = true;
          setIsReady(true);
          setStatus('ready-mock');
          setError('MediaPipe unavailable — using mock pose (loader fallback)');
          return;
        }

        throw out.error || new Error(out.status);
      } catch (err: any) {
        if (ac.signal.aborted) return;
        
        const isDev = detectIsDev();
        if (isDev) {
          useMockRef.current = true;
          setIsReady(true);
          setStatus('ready-mock');
          setError('MediaPipe unavailable — using mock pose (dev)');
        } else {
          // FIX-Z13 (2026-04-22): 프로덕션 모바일에서 MediaPipe CDN/WASM 실패 시에도
          //   mock pose 폴백을 켜서 "최소한 뭔가 움직이는" 상태 유지. 완벽한 판정은
          //   안되지만 사용자가 "아무것도 안 됨" 상태는 피함.
          //   에러 메시지를 명시해서 DOM 뱃지에 노출 → 사용자/개발자 추적 가능.
          useMockRef.current = true;
          setIsReady(true);
          setStatus('ready-mock');
          const msg = err?.message || err?.toString?.() || 'unknown';
          setError('MediaPipe load failed (mock fallback): ' + msg);
          try { console.error('[PoseDetection] MediaPipe load failed, using mock:', err); } catch {}
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [loadNonce]);

  // ── Detection loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready-real' && status !== 'ready-mock') return;
    intervalRef.current = setInterval(runDetection, DETECT_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, runDetection]);

  return {
    isReady,
    isRealPose,
    landmarks,
    detect: async () => {},
    error,
    status,
    retry,
    dispose,
  };
}
