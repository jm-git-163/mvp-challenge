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
import { resourceTracker } from '../utils/resourceTracker';

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

// TEAM-ACCURACY (2026-04-24): 라이브 챌린지 스쿼트 카운트 정확도 → 진단(/selftest) 동등화.
//   기존 100ms (= 10fps) 는 스쿼트 1 rep(700~1200ms) 당 7~12 프레임만 발생 → HSS·squatCounter
//   상태기계 디바운스(2~4 frame) 가 거의 모든 신호를 흡수해 카운트가 누락되는 주범.
//   /selftest 페이지가 정확한 이유는 requestAnimationFrame 으로 30~60fps 를 굴리기 때문.
//   이제 라이브 챌린지도 rAF 기반으로 굴려 동일한 샘플 밀도 확보.
//   mock 모드(useMockRef.current=true) 에서는 기존 100ms 유지 — 가짜 포즈 트레이스 사용 시
//   주기 무관하게 동일 결과.
const DETECT_INTERVAL_MS = 100;
const MOCK_INTERVAL_MS   = 100;

// __DEV__ 는 RN 런타임 전역. 웹 번들에서는 process.env.NODE_ENV 로 판정.
function detectIsDev(): boolean {
  if (typeof (globalThis as any).__DEV__ === 'boolean') return (globalThis as any).__DEV__;
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/**
 * Team RECOG (2026-04-22): 모바일 UA 에서는 dev 여도 mock 폴백 금지.
 *   사용자 피드백 "가짜 평가 올라오고" 의 근본 원인은 mobile 에서 generateMockPose 가
 *   landmark.score=0.92 로 모든 visibility 게이트를 통과시켜 fake 스쿼트/포즈 판정을
 *   발생시킨 것. 모바일에서는 실제 엔진이 실패해도 score=0 을 정직하게 유지한다.
 */
function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua)) return true;
  if ((navigator as any).maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  return false;
}

function mockAllowed(): boolean {
  // dev AND NOT mobile
  return detectIsDev() && !isMobileUA();
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
  // FIX-Z20 (2026-04-22): status='error' 감지 시 3 초 후 자동 retry.
  //   3회 실패 시 mock 모드 강제 전환해 "아무것도 안 됨" 상태 회피.
  const poseRetryRef      = useRef(0);
  const poseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const POSE_RETRY_MAX    = 3;
  const POSE_RETRY_DELAY_MS = 3000;

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
      try { resourceTracker.dec('poseLandmarker'); } catch {}
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
        // FIX-Z16 (2026-04-22): MediaPipe BlazePose 는 33 keypoint 를 출력하지만
        //   소비자 (useJudgement, detectSquat, PoseCalibration, StanceGuide, PoseOverlay)
        //   는 모두 MoveNet 17-keypoint 인덱스를 가정. 리맵하지 않으면 landmarks[13]
        //   (MoveNet knee) 가 실제로 elbow 가 되어 스쿼트 각도·스탠스가 전부 깨짐.
        //   → 여기서 한 번 변환해 downstream 은 기존대로 동작하게 한다.
        const bp = result.landmarks[0];
        // FIX-AA (2026-04-22): BlazePose 가 드물게 부분 출력(길이<33)을 낼 때
        //   폴백 0,0 landmark 가 downstream 에 주입되어 PoseCalibration 이
        //   얼굴/발 위치로 오인식. bp.length < 33 이면 이번 프레임 skip.
        if (!Array.isArray(bp) || bp.length < 33) return;
        const toLm = (i: number): NormalizedLandmark => {
          const lm = bp[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };
          return {
            x: lm.x,
            y: lm.y,
            z: lm.z,
            score: lm.visibility ?? 1,
            visibility: lm.visibility ?? 0,
          };
        };
        // MoveNet idx → MediaPipe BlazePose idx
        const BP_TO_MN = [
          0,  // 0 nose
          2,  // 1 left_eye
          5,  // 2 right_eye
          7,  // 3 left_ear
          8,  // 4 right_ear
          11, // 5 left_shoulder
          12, // 6 right_shoulder
          13, // 7 left_elbow
          14, // 8 right_elbow
          15, // 9 left_wrist
          16, // 10 right_wrist
          23, // 11 left_hip
          24, // 12 right_hip
          25, // 13 left_knee
          26, // 14 right_knee
          27, // 15 left_ankle
          28, // 16 right_ankle
        ];
        const mapped: NormalizedLandmark[] = BP_TO_MN.map(toLm);
        setLandmarks(mapped);
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
          try { resourceTracker.inc('poseLandmarker'); } catch {}
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
        // Team RECOG (2026-04-22): "가짜 평가" 근절.
        //   기존 FIX-Z13 은 프로덕션 모바일에서도 mock 폴백을 켜서 landmarks 에
        //   가짜(score=0.92) 값을 주입 → useJudgement 가 이를 실제 포즈로 오인해
        //   스쿼트 카운트/점수가 마음대로 오르는 "가짜 평가" 의 원인이었다.
        //   이제 프로덕션에서는 mock 을 절대 사용하지 않고 명시적 error 상태로
        //   전환 → usePoseDetection.ts 의 auto-retry 가 3회까지 재시도한 뒤에도
        //   실패하면 score=0 유지(record 화면의 포즈에러 오버레이가 표시됨).
        const msg = err?.message || err?.toString?.() || 'unknown';
        if (isDev && !isMobileUA()) {
          useMockRef.current = true;
          setIsReady(true);
          setStatus('ready-mock');
          setError('MediaPipe unavailable — using mock pose (dev desktop only)');
        } else {
          useMockRef.current = false;
          setIsReady(false);
          setStatus('error');
          setError('포즈 엔진 로드 실패 — 재시도 중: ' + msg);
          try { console.error('[PoseDetection] MediaPipe load failed (prod, NO mock):', err); } catch {}
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [loadNonce]);

  // ── Auto-retry on error ──────────────────────────────────────────────────
  // FIX-Z20 (2026-04-22): 로더가 error 로 떨어졌을 때 3초 후 자동 retry.
  //   3회 실패 시 useMockRef 를 켜고 'ready-mock' 으로 전환 — 유저가 아무 것도
  //   없는 화면을 계속 보지 않도록. 실기기 MediaPipe CDN 플레이키 상황 대응.
  useEffect(() => {
    if (status !== 'error') return;
    if (poseRetryRef.current >= POSE_RETRY_MAX) {
      // Team RECOG (2026-04-22): 한계 도달 시 mock 강제 전환 → 가짜 평가 주범.
      //   이제 단순히 error 상태를 유지하여 UI 가 "포즈 엔진을 불러오지 못했습니다"
      //   오버레이를 표시하고 score=0 으로 유지되게 한다. 사용자는 새로고침 또는
      //   버튼으로 재시도 가능 (app/record/index.tsx 의 poseErrorOverlay 참고).
      //   dev 환경에서만 mock 허용.
      if (mockAllowed()) {
        useMockRef.current = true;
        setError('자동 재시도 3회 실패 — mock 모드 (dev desktop)');
        setIsReady(true);
        setStatus('ready-mock');
      } else {
        setError('포즈 엔진 로드 실패 — 새로고침하거나 네트워크를 확인해주세요');
      }
      return;
    }
    if (poseRetryTimerRef.current) clearTimeout(poseRetryTimerRef.current);
    poseRetryTimerRef.current = setTimeout(() => {
      poseRetryRef.current += 1;
      retry();
    }, POSE_RETRY_DELAY_MS);
    return () => {
      if (poseRetryTimerRef.current) {
        clearTimeout(poseRetryTimerRef.current);
        poseRetryTimerRef.current = null;
      }
    };
  }, [status, retry]);

  // ── Detection loop ───────────────────────────────────────────────────────
  // TEAM-ACCURACY (2026-04-24): real 모드는 rAF 로 30~60fps. mock 모드는 기존 setInterval.
  //   rAF 사용 이유는 위 DETECT_INTERVAL_MS 주석 참고.
  const rafLoopRef = useRef<number | null>(null);
  useEffect(() => {
    if (status !== 'ready-real' && status !== 'ready-mock') return;

    if (status === 'ready-mock') {
      intervalRef.current = setInterval(runDetection, MOCK_INTERVAL_MS);
      return () => {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }

    // ready-real: rAF 루프
    if (typeof requestAnimationFrame !== 'function') {
      // 비-브라우저 환경(테스트 등) 폴백.
      intervalRef.current = setInterval(runDetection, DETECT_INTERVAL_MS);
      return () => {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      runDetection();
      rafLoopRef.current = requestAnimationFrame(tick);
    };
    rafLoopRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafLoopRef.current !== null) {
        try { cancelAnimationFrame(rafLoopRef.current); } catch {}
        rafLoopRef.current = null;
      }
    };
  }, [status, runDetection]);

  // ── Unmount-only cleanup ─────────────────────────────────────────────────
  // Team RELIABILITY (2026-04-22): record 화면 언마운트 시 PoseLandmarker.close()
  //   호출을 보장. 기존엔 dispose() 가 export 만 되고 자동 호출 경로가 없어
  //   챌린지를 2회 연속 수행하면 WASM 인스턴스가 누적 → 메모리·GPU 핸들 leak.
  useEffect(() => {
    return () => {
      if (poseRetryTimerRef.current) {
        clearTimeout(poseRetryTimerRef.current);
        poseRetryTimerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (rafLoopRef.current !== null) {
        try { cancelAnimationFrame(rafLoopRef.current); } catch {}
        rafLoopRef.current = null;
      }
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close(); } catch {}
        try { resourceTracker.dec('poseLandmarker'); } catch {}
        landmarkerRef.current = null;
      }
    };
  }, []);

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
