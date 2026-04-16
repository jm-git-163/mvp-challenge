/**
 * usePoseDetection.web.ts
 * 웹 전용 — TF.js/MediaPipe 없이 목 포즈로 동작
 * Metro 번들러가 웹 빌드 시 이 파일을 우선 사용
 */
import { useState, useEffect, useRef } from 'react';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { generateMockPose } from '../utils/poseUtils';

interface UsePoseDetectionReturn {
  isReady:  boolean;
  landmarks: NormalizedLandmark[];
  detect:   (_b64: string, _w: number, _h: number) => Promise<void>;
  error:    string | null;
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const timerRef = useRef(0);

  useEffect(() => {
    // 웹: 100ms마다 사인파 기반 목 포즈 생성
    const id = setInterval(() => {
      timerRef.current += 100;
      setLandmarks(generateMockPose(timerRef.current));
    }, 100);
    return () => clearInterval(id);
  }, []);

  return {
    isReady:  true,
    landmarks,
    detect:   async () => {},
    error:    null,
  };
}
