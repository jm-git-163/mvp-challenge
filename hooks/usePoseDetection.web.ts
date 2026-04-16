/**
 * usePoseDetection.web.ts
 * 웹 전용 — 제스처 사이클 목 포즈 (TF.js 없이)
 */
import { useState, useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { generateMockPose } from '../utils/poseUtils';

interface UsePoseDetectionReturn {
  isReady: boolean;
  landmarks: NormalizedLandmark[];
  detect: (_b64: string, _w: number, _h: number) => Promise<void>;
  error: string | null;
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const timerRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      timerRef.current += 120;
      setLandmarks(generateMockPose(timerRef.current));
    }, 120);
    return () => clearInterval(id);
  }, []);

  return { isReady: true, landmarks, detect: async () => {}, error: null };
}
