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
  setSquatMockMode: (enabled: boolean) => void;
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
  const [isRealPose, setIsRealPose] = useState(false);
  const [landmarks, setLandmarks]   = useState<NormalizedLandmark[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [loadNonce, setLoadNonce]   = useState(0);

  const landmarkerRef    = useRef<PoseLandmarkerHandle | null>(null);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimerRef     = useRef(0);
  const useMockRef       = useRef(false);
  const squatMockRef     = useRef(false);
  const lastTimestampRef = useRef(0);

  const setSquatMockMode = useCallback((enabled: boolean) => {
    squatMockRef.current = enabled;
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setStatus('idle');
    setLoadNonce((n) => n + 1);
  }, []);

  const runDetection = useCallback(() => {
    if (useMockRef.current) {
      mockTimerRef.current += DETECT_INTERVAL_MS;
      const pose = squatMockRef.current
        ? generateSquatMockPose(mockTimerRef.current)
        : generateMockPose(mockTimerRef.current);
      setLandmarks(pose);
      return;
    }

    const landmarker = landmarkerRef.current as any;
    if (!landmarker) return;

    const video = (window as any).__poseVideoEl as HTMLVideoElement | undefined;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

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
      const out = await loadPoseLandmarker(config, deps, ac.signal);
      if (ac.signal.aborted) return;

      if (out.status === 'ready-real' && out.handle) {
        landmarkerRef.current = out.handle;
        useMockRef.current = false;
        setError(null);
        setStatus('ready-real');
        return;
      }
      if (out.status === 'ready-mock') {
        useMockRef.current = true;
        setError(out.error?.message ?? 'MediaPipe unavailable — using mock pose');
        setStatus('ready-mock');
        return;
      }
      useMockRef.current = false;
      setError(out.error?.message ?? '포즈 엔진 로드 실패');
      setStatus('error');
    })();

    return () => {
      ac.abort();
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close(); } catch { /* ignore */ }
        landmarkerRef.current = null;
      }
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
    isReady: status === 'ready-real' || status === 'ready-mock',
    isRealPose,
    landmarks,
    detect: async () => {},
    error,
    status,
    retry,
    setSquatMockMode,
  };
}
