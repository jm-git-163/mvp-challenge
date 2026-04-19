/**
 * usePoseDetection.web.ts
 * 웹 전용 — 제스처 사이클 목 포즈 (TF.js 없이)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { generateMockPose, generateSquatMockPose } from '../utils/poseUtils';

interface UsePoseDetectionReturn {
  isReady: boolean;
  landmarks: NormalizedLandmark[];
  detect: (_b64: string, _w: number, _h: number) => Promise<void>;
  error: string | null;
  /** 피트니스 장르: 스쿼트 포즈 시뮬레이션 토글 */
  setSquatMockMode: (enabled: boolean) => void;
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const timerRef     = useRef(0);
  const squatModeRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      timerRef.current += 120;
      const pose = squatModeRef.current
        ? generateSquatMockPose(timerRef.current)
        : generateMockPose(timerRef.current);
      setLandmarks(pose);
    }, 120);
    return () => clearInterval(id);
  }, []);

  const setSquatMockMode = useCallback((enabled: boolean) => {
    squatModeRef.current = enabled;
  }, []);

  return { isReady: true, landmarks, detect: async () => {}, error: null, setSquatMockMode };
}
