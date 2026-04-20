/**
 * engine/recognition/mediaPipeLoader.ts
 *
 * Phase 1-B — MediaPipe 로드 상태기 + 로더 (hook 비의존, 순수 테스트 가능).
 * WORK_ORDER §4.2.
 *
 * 책임:
 *   1. 환경변수 기반 BASE URL 결정 (jsdelivr ↔ Supabase Storage 자체 호스팅).
 *   2. loadPoseLandmarker(deps) — deps 주입으로 MediaPipe import / 생성 모킹.
 *   3. LoadStatus 머신 — loading → ready-real | ready-mock(dev) | error.
 *   4. retry() — 리소스 정리 후 재시도.
 *
 * 프로덕션에서는 mock 폴백 금지. 개발/__DEV__ 에서만.
 */

export type PoseLoadStatus = 'idle' | 'loading' | 'ready-real' | 'ready-mock' | 'error';

export interface PoseLoadConfig {
  /** MediaPipe WASM + 모델 BASE URL. 끝 슬래시 없음. */
  base: string;
  /** 모델 파일 상대 경로. */
  modelPath: string;
  /** true 면 mock 폴백 허용. 기본 false. */
  allowMockFallback: boolean;
}

export const DEFAULT_POSE_CONFIG: PoseLoadConfig = {
  base: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
  modelPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  allowMockFallback: false,
};

/**
 * env 에서 BASE URL 을 읽어 config 생성.
 * @param env EXPO_PUBLIC_MEDIAPIPE_BASE 등 환경변수 오브젝트.
 * @param isDev __DEV__ 값.
 */
export function resolvePoseConfig(
  env: Record<string, string | undefined> = {},
  isDev = false,
): PoseLoadConfig {
  const base = stripTrailingSlash(env.EXPO_PUBLIC_MEDIAPIPE_BASE) ?? DEFAULT_POSE_CONFIG.base;
  const modelPath = env.EXPO_PUBLIC_MEDIAPIPE_MODEL_URL ?? DEFAULT_POSE_CONFIG.modelPath;
  return {
    base,
    modelPath,
    allowMockFallback: isDev,
  };
}

function stripTrailingSlash(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/\/+$/, '');
}

/** 모든 외부 의존을 주입 가능하게 묶음 — 순수 테스트용. */
export interface PoseLoaderDeps {
  /** `@mediapipe/tasks-vision` dynamic import. 반환: { PoseLandmarker, FilesetResolver }. */
  importMediaPipe: () => Promise<{
    PoseLandmarker: {
      createFromOptions: (vision: unknown, options: unknown) => Promise<PoseLandmarkerHandle>;
    };
    FilesetResolver: {
      forVisionTasks: (wasmBase: string) => Promise<unknown>;
    };
  }>;
}

export interface PoseLandmarkerHandle {
  detectForVideo: (video: unknown, tMs: number) => unknown;
  close: () => void;
}

export interface LoadOutcome {
  status: PoseLoadStatus;
  handle: PoseLandmarkerHandle | null;
  error: Error | null;
}

/**
 * MediaPipe PoseLandmarker 로드. 성공/실패/mock 폴백 분기.
 * @param config resolvePoseConfig 결과.
 * @param deps 의존성(테스트용 주입 가능).
 * @param signal 로드 중단 신호.
 */
export async function loadPoseLandmarker(
  config: PoseLoadConfig,
  deps: PoseLoaderDeps,
  signal?: AbortSignal,
): Promise<LoadOutcome> {
  if (signal?.aborted) {
    return { status: 'error', handle: null, error: new DOMException('Aborted', 'AbortError') };
  }
  try {
    const { PoseLandmarker, FilesetResolver } = await deps.importMediaPipe();
    if (signal?.aborted) {
      return { status: 'error', handle: null, error: new DOMException('Aborted', 'AbortError') };
    }
    const vision = await FilesetResolver.forVisionTasks(`${config.base}/wasm`);
    if (signal?.aborted) {
      return { status: 'error', handle: null, error: new DOMException('Aborted', 'AbortError') };
    }
    const handle = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: config.modelPath,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    if (signal?.aborted) {
      try { handle.close(); } catch { /* ignore */ }
      return { status: 'error', handle: null, error: new DOMException('Aborted', 'AbortError') };
    }
    return { status: 'ready-real', handle, error: null };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    if (config.allowMockFallback) {
      return { status: 'ready-mock', handle: null, error: e };
    }
    return { status: 'error', handle: null, error: e };
  }
}

/**
 * 상태 전이 머신 — 프로덕션에서 mock 으로 은밀하게 전환하는 것을 UI 가 탐지 가능.
 */
export function describeStatus(status: PoseLoadStatus): {
  userTitle: string;
  showOverlay: boolean;
  recoverable: boolean;
} {
  switch (status) {
    case 'idle':
      return { userTitle: '대기 중', showOverlay: false, recoverable: true };
    case 'loading':
      return { userTitle: '포즈 엔진 다운로드 중', showOverlay: true, recoverable: true };
    case 'ready-real':
      return { userTitle: '준비 완료', showOverlay: false, recoverable: true };
    case 'ready-mock':
      return { userTitle: '개발 모드 — 모의 포즈 사용', showOverlay: true, recoverable: true };
    case 'error':
      return { userTitle: '포즈 엔진을 불러오지 못했습니다', showOverlay: true, recoverable: true };
  }
}
