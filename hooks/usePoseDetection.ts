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
import { normalizeLandmarks } from '../utils/poseUtils';

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
  /** 실제 MoveNet 추론이 시작된 시점부터 true. 가짜 포즈와 구분. */
  isRealPose: boolean;
  landmarks: NormalizedLandmark[];
  detect: (base64Jpeg: string, width: number, height: number) => Promise<void>;
  error: string | null;
  /** Deprecated — 더 이상 가짜 데이터를 생성하지 않음. 호환용 no-op */
  setSquatMockMode: (enabled: boolean) => void;
}

/**
 * Web 환경: __poseVideoEl(HTMLVideoElement)을 직접 읽어 TF.js MoveNet 추론
 * Native 환경: 목 포즈 유지 (react-native tfjs 별도 설정 필요)
 * TF.js 로드 실패 시 자동으로 목 모드 폴백
 */
export function usePoseDetection(): UsePoseDetectionReturn {
  const [isReady, setIsReady]       = useState(false);
  const [isRealPose, setIsRealPose] = useState(false);
  const [landmarks, setLandmarks]   = useState<NormalizedLandmark[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const detectorRef                 = useRef<PoseDetector | null>(null);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const inferringRef                = useRef(false);

  // Deprecated: 더 이상 가짜 모드 없음
  const setSquatMockMode = useCallback((_enabled: boolean) => {}, []);

  // ── 모델 초기화 ─────────────────────────────
  useEffect(() => {
    // Native 플랫폼: 포즈 감지 비지원 (가짜 데이터 생성 금지)
    if (Platform.OS !== 'web') {
      setError('이 플랫폼에서는 포즈 감지가 지원되지 않습니다.');
      setIsReady(true);
      return;
    }

    // Web: TF.js 모델 로드 완료 전까지 isReady=false
    setIsReady(false);
    setLandmarks([]);
    setIsRealPose(false);

    let cancelled = false;

    (async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
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

        // 100 ms 인터벌로 실제 video element에서 추론
        intervalRef.current = setInterval(async () => {
          if (inferringRef.current) return;
          const video = (typeof window !== 'undefined')
            ? (window as any).__poseVideoEl as HTMLVideoElement | undefined
            : undefined;
          if (!video || video.readyState < 2 || !detectorRef.current) return;

          inferringRef.current = true;
          try {
            const poses = await detectorRef.current.estimatePoses(video, {
              flipHorizontal: true,
            });
            const kps = poses[0]?.keypoints ?? [];
            if (kps.length > 0) {
              const normalized = normalizeLandmarks(
                kps, video.videoWidth || 640, video.videoHeight || 480,
              );
              setLandmarks(normalized);
              // 첫 유효 검출 시점부터 isRealPose = true
              if (!isRealPose) setIsRealPose(true);
            }
          } catch { /* 프레임 에러 무시 */ }
          finally { inferringRef.current = false; }
        }, 100);

      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'TF.js 초기화 실패';
        setError(msg);
        console.warn('[usePoseDetection] TF.js 로드 실패 — 포즈 감지 사용 불가:', msg);
        // 가짜 데이터 생성 없음. landmarks=[], isRealPose=false 유지
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, []); // eslint-disable-line

  const detect = useCallback(async (_base64Jpeg: string, _w: number, _h: number) => {}, []);

  return { isReady, isRealPose, landmarks, detect, error, setSquatMockMode };
}
