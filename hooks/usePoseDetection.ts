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
import type { NormalizedLandmark } from '../utils/poseUtils';
import { normalizeLandmarks, generateMockPose } from '../utils/poseUtils';

// ── 환경 플래그 ─────────────────────────────────
// 개발 중 TF.js 없이 UI만 테스트할 때 true로 설정
const USE_MOCK = true; // Supabase/TF.js 없이 UI 완전 동작

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
// base64 JPEG → Uint8Array
// ──────────────────────────────────────────────
function base64ToUint8Array(b64: string): Uint8Array {
  // data:image/jpeg;base64, 접두사 제거
  const pure = b64.includes(',') ? b64.split(',')[1] : b64;
  const binaryStr = atob(pure);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// ──────────────────────────────────────────────
// 훅
// ──────────────────────────────────────────────
interface UsePoseDetectionReturn {
  isReady: boolean;
  landmarks: NormalizedLandmark[];
  detect: (base64Jpeg: string, width: number, height: number) => Promise<void>;
  error: string | null;
}

export function usePoseDetection(): UsePoseDetectionReturn {
  const [isReady, setIsReady] = useState(USE_MOCK);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const mockTimerRef = useRef(0);

  // ── 모델 초기화 ─────────────────────────────
  useEffect(() => {
    if (USE_MOCK) {
      // 목 모드: 100ms마다 사인파 포즈 업데이트
      const id = setInterval(() => {
        mockTimerRef.current += 100;
        setLandmarks(generateMockPose(mockTimerRef.current));
      }, 100);
      return () => clearInterval(id);
    }

    let cancelled = false;

    (async () => {
      try {
        // dynamic import → 빌드 에러 방지
        const tf = await import('@tensorflow/tfjs');
        await import('@tensorflow/tfjs-react-native');
        const poseDetection = await import('@tensorflow-models/pose-detection');

        await tf.ready();

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: (poseDetection as any).movenet?.modelType?.SINGLEPOSE_LIGHTNING ?? 'SinglePose.Lightning',
            enableSmoothing: true,
          }
        ) as unknown as PoseDetector;

        if (!cancelled) {
          detectorRef.current = detector;
          setIsReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '모델 로드 실패';
          setError(msg);
          console.warn('[usePoseDetection] TF.js 초기화 실패:', msg);
          // 폴백: 목 모드로 전환
          const id = setInterval(() => {
            mockTimerRef.current += 100;
            setLandmarks(generateMockPose(mockTimerRef.current));
          }, 100);
          // 정리는 클린업에서 못 하므로 ref에 저장
          (detectorRef as any)._mockId = id;
          setIsReady(true); // UI는 동작하도록
        }
      }
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      if ((detectorRef as any)._mockId) clearInterval((detectorRef as any)._mockId);
    };
  }, []);

  // ── 단일 프레임 추론 ─────────────────────────
  const detect = useCallback(
    async (base64Jpeg: string, width: number, height: number) => {
      if (USE_MOCK || !detectorRef.current) return;

      try {
        const tf = await import('@tensorflow/tfjs');
        const { decodeJpeg } = await import('@tensorflow/tfjs-react-native');

        const bytes = base64ToUint8Array(base64Jpeg);
        const tensor = decodeJpeg(bytes);

        const poses = await detectorRef.current.estimatePoses(tensor, {
          flipHorizontal: true, // 전면 카메라 미러 보정
        });

        tf.dispose(tensor);

        const kps = poses[0]?.keypoints ?? [];
        if (kps.length > 0) {
          setLandmarks(normalizeLandmarks(kps, width, height));
        }
      } catch (e) {
        // 프레임 단위 에러는 무시 (다음 프레임에서 재시도)
      }
    },
    []
  );

  return { isReady, landmarks, detect, error };
}
