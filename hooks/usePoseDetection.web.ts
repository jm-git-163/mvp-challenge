/**
 * usePoseDetection.web.ts
 * 웹 전용 — MediaPipe Tasks Vision PoseLandmarker (real detection)
 * Falls back to mock pose if MediaPipe fails to load.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { generateMockPose, generateSquatMockPose } from '../utils/poseUtils';

interface UsePoseDetectionReturn {
  isReady: boolean;
  landmarks: NormalizedLandmark[];
  detect: (_b64: string, _w: number, _h: number) => Promise<void>;
  error: string | null;
  setSquatMockMode: (enabled: boolean) => void;
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// How often to run pose detection (ms)
const DETECT_INTERVAL_MS = 100;

export function usePoseDetection(): UsePoseDetectionReturn {
  const [isReady, setIsReady]       = useState(false);
  const [landmarks, setLandmarks]   = useState<NormalizedLandmark[]>([]);
  const [error, setError]           = useState<string | null>(null);

  // Refs that survive re-renders without triggering them
  const landmarkerRef    = useRef<any>(null);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimerRef     = useRef(0);
  const useMockRef       = useRef(false);   // fallback mode
  const squatMockRef     = useRef(false);
  const lastTimestampRef = useRef(0);

  // ── setSquatMockMode — kept for API compatibility ───────────────────────────
  const setSquatMockMode = useCallback((enabled: boolean) => {
    squatMockRef.current = enabled;
  }, []);

  // ── Run detection against the exposed video element ────────────────────────
  const runDetection = useCallback(() => {
    // Fallback mock path
    if (useMockRef.current) {
      mockTimerRef.current += DETECT_INTERVAL_MS;
      const pose = squatMockRef.current
        ? generateSquatMockPose(mockTimerRef.current)
        : generateMockPose(mockTimerRef.current);
      setLandmarks(pose);
      return;
    }

    const landmarker = landmarkerRef.current;
    if (!landmarker) return;

    // Access the video element exposed by RecordingCamera.web.tsx
    const video = (window as any).__poseVideoEl as HTMLVideoElement | undefined;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    try {
      // MediaPipe requires strictly increasing timestamps in VIDEO mode
      const now = performance.now();
      if (now <= lastTimestampRef.current) return;
      lastTimestampRef.current = now;

      const result = landmarker.detectForVideo(video, now);
      if (result?.landmarks?.length > 0) {
        // MediaPipe returns landmarks already normalized 0-1
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
      }
    } catch (e) {
      // Non-fatal: skip this frame
      console.warn('[PoseDetection] detectForVideo error:', e);
    }
  }, []);

  // ── Load MediaPipe and start the detection loop ─────────────────────────────
  useEffect(() => {
    let destroyed = false;

    const load = async () => {
      try {
        // Dynamic import — package installed via npm
        const { PoseLandmarker, FilesetResolver } =
          await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO' as any,
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (destroyed) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsReady(true);
        setError(null);
      } catch (err: any) {
        if (destroyed) return;
        console.warn('[PoseDetection] MediaPipe failed to load, falling back to mock:', err);
        // Activate mock fallback
        useMockRef.current = true;
        setIsReady(true);
        setError('MediaPipe unavailable — using mock pose');
      }
    };

    load();

    return () => {
      destroyed = true;
    };
  }, []);

  // ── Start/stop detection interval once model is ready ──────────────────────
  useEffect(() => {
    if (!isReady) return;

    intervalRef.current = setInterval(runDetection, DETECT_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReady, runDetection]);

  // ── Cleanup landmarker on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close(); } catch { /* ignore */ }
        landmarkerRef.current = null;
      }
    };
  }, []);

  return {
    isReady,
    landmarks,
    detect: async () => {},   // kept for interface compatibility
    error,
    setSquatMockMode,
  };
}
