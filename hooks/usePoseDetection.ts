/**
 * usePoseDetection.ts
 *
 * TF.js MoveNet 기반 실시간 포즈 추정 훅
 *
 * 동작 방식:
 *  1. 앱 마운트 → TF.js 백엔드 초기화 + MoveNet 모델 로드
 *  2. detect(base64Jpeg) 호출 → 17개 랜드마크 반환
 *  3. USE_MOCK=true 이면 목 포즈로 대체 (UI 개발/테스트용)
 *
 * 호출측에서 Camera.takePictureAsync({ base64:true, quality:0.3 })으로
 * 매 100ms마다 프레임을 잡아 detect()에 넘긴다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import type { NormalizedLandmark } from '../utils/poseUtils';
import { normalizeLandmarks, generateMockPose } from '../utils/poseUtils';

// ── 타입 (TF.js 없어도 컴파일 가능하도록 느슨하게) ──
type PoseDetector = {
  estimatePoses(input: unknown, config?: unknown): Promise<
    Array<{
      keypoints: Array<{ x: number; y: number; score?: number; name?: string }>;
    }>
  >;
  dispose(): void;
};

// ──────────────────────────────────────────────
// 훅
// ──────────────────────────────────────────────
interface UsePoseDetectionReturn {
  isReady: boolean;
  landmarks: NormalizedLandmark[];
  detect: (base64Jpeg: string, width: number, height: number) => Promise<void>;
  error: string | null;
}

/**
 * Web 환경: __poseVideoEl(HTMLVideoElement)을 직접 읽어 TF.js MoveNet 추론
 * Native 환경: 목 포즈 유지 (react-native tfjs 별도 설정 필요)
 * TF.js 로드 실패 시 자동으로 목 모드 폴백
 */
export function usePoseDetection(): UsePoseDetectionReturn {
  const [isReady, setIsReady]     = useState(false);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const detectorRef               = useRef<PoseDetector | null>(null);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const mockTimerRef              = useRef(0);
  const inferringRef              = useRef(false); // 추론 중 중복 방지

  const startMockMode = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      mockTimerRef.current += 100;
      setLandmarks(generateMockPose(mockTimerRef.current));
    }, 100);
    setIsReady(true);
  };

  // ── 모델 초기화 ─────────────────────────────
  useEffect(() => {
    // Native: 목 모드 유지
    if (Platform.OS !== 'web') {
      startMockMode();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    // Web: TF.js WebGL + MoveNet
    let cancelled = false;

    (async () => {
      try {
        // @tensorflow/tfjs v4 includes WebGL backend — no extra import needed
        const tf = await import('@tensorflow/tfjs');
        // Prefer WebGL; fall back to CPU
        try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
        await tf.ready();

        const poseDetection = await import('@tensorflow-models/pose-detection');
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: (poseDetection as any).movenet?.modelType?.SINGLEPOSE_LIGHTNING
              ?? 'SinglePose.Lightning',
            enableSmoothing: true,
          }
        ) as unknown as PoseDetector;

        if (cancelled) { detector.dispose(); return; }
        detectorRef.current = detector;
        setIsReady(true);

        // 100 ms 인터벌로 video element에서 추론
        intervalRef.current = setInterval(async () => {
          if (inferringRef.current) return; // 이전 추론이 아직 진행 중
          const video = (typeof window !== 'undefined')
            ? (window as any).__poseVideoEl as HTMLVideoElement | undefined
            : undefined;
          if (!video || video.readyState < 2 || !detectorRef.current) return;

          inferringRef.current = true;
          try {
            const poses = await detectorRef.current.estimatePoses(video, {
              flipHorizontal: true, // 전면 카메라 미러 보정
            });
            const kps = poses[0]?.keypoints ?? [];
            if (kps.length > 0) {
              setLandmarks(
                normalizeLandmarks(kps, video.videoWidth || 640, video.videoHeight || 480)
              );
            }
          } catch { /* 프레임 에러 무시 */ } finally {
            inferringRef.current = false;
          }
        }, 100);

      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'TF.js 초기화 실패';
        setError(msg);
        console.warn('[usePoseDetection] TF.js 로드 실패 → 목 모드 폴백:', msg);
        startMockMode();
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── detect: 웹에서는 video 인터벌이 자동 처리 — no-op으로 유지 ──
  const detect = useCallback(async (_base64Jpeg: string, _w: number, _h: number) => {
    // Web: video element loop handles inference
    // Native: 목 모드이므로 호출 불필요
  }, []);

  return { isReady, landmarks, detect, error };
}
