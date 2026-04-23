/**
 * engine/session/cameraSwap.ts
 *
 * CAMERA-SWAP (2026-04-23): 녹화 중 전/후면 카메라 전환 헬퍼.
 *
 * 배경:
 *  - MediaRecorder 는 트랙 교체 mid-recording 불가. 단순 stop/start 면 녹화본 끊김.
 *  - 그러나 본 프로젝트는 video → canvas → captureStream 구조이므로
 *    canvas 출력 트랙은 동일 → 그 위에 새 video 만 갈아끼우면 녹화본 단절 없음.
 *  - iOS Safari 가 카메라 동시 2개 acquire 를 막을 가능성이 있어
 *    듀얼 acquire 대신 stop → re-acquire 의 "on-demand swap" 사용.
 *
 * 사용:
 *   const result = await swapCameraStream({
 *     prevStream: streamRef.current,
 *     target: 'back',
 *     onPrevStop: () => stopCachedStream(),  // 모듈 내부 캐시 일관성 유지
 *     getUserMedia: navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
 *   });
 *   if (result.ok) { videoRef.current.srcObject = result.stream; ... }
 *
 * CLAUDE.md §3 #13: getUserMedia 는 mediaSession.ts 또는 동일 모듈 패밀리에서만.
 *   본 헬퍼도 engine/session/ 하위로 격리해 정책 위반 아님.
 */

export type CameraFacing = 'front' | 'back';

export interface SwapCameraOptions {
  /** 이전 stream — 트랙 stop 대상. null 가능 (초기 상태). */
  prevStream: MediaStream | null;
  /** 목표 facing. */
  target: CameraFacing;
  /** 이전 stream 정리 후 호출 (캐시 carrier 가 따로 있는 경우). */
  onPrevStop?: () => void;
  /** 테스트 주입용. 미지정 시 navigator.mediaDevices.getUserMedia. */
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  /** 일부 Android Chrome 에서 동일 장치 즉시 재요청 시 NotReadableError 회피. */
  intermediateDelayMs?: number;
}

export interface SwapCameraSuccess {
  ok: true;
  stream: MediaStream;
  facing: CameraFacing;
}

export interface SwapCameraFailure {
  ok: false;
  /** 'swap' = 새 facing acquire 실패. 'revert' = 새 facing + 원복 둘 다 실패. */
  stage: 'swap' | 'revert';
  error: unknown;
  /** revert 성공 시 원본 facing stream — 호출자가 복원해야 함. */
  revertedStream?: MediaStream;
  revertedFacing?: CameraFacing;
}

export type SwapCameraResult = SwapCameraSuccess | SwapCameraFailure;

function toFacingMode(f: CameraFacing): 'user' | 'environment' {
  return f === 'front' ? 'user' : 'environment';
}
function flip(f: CameraFacing): CameraFacing {
  return f === 'front' ? 'back' : 'front';
}

async function tryAcquire(
  facing: CameraFacing,
  gum: (c: MediaStreamConstraints) => Promise<MediaStream>,
): Promise<MediaStream> {
  const fm = toFacingMode(facing);
  // 1차: ideal facingMode + 720x1280
  try {
    return await gum({
      video: {
        facingMode: { ideal: fm } as MediaTrackConstraints['facingMode'],
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    // 2차: 단순 video:true (facingMode 미지원 단말 폴백)
    try {
      return await gum({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      throw err;
    }
  }
}

/**
 * 메인 API. prev → target 으로 카메라 전환을 시도한다.
 *
 * 호출자 책임:
 *  - 반환된 stream 을 video element 에 부착 (srcObject).
 *  - 실패 시 사용자에게 토스트 노출 ("카메라 전환 실패").
 *  - revertedStream 이 있으면 복원할 것.
 */
export async function swapCameraStream(opts: SwapCameraOptions): Promise<SwapCameraResult> {
  const gum = opts.getUserMedia
    ?? (typeof navigator !== 'undefined'
      ? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      : undefined);
  if (!gum) {
    return { ok: false, stage: 'swap', error: new Error('getUserMedia 미지원 환경') };
  }

  // 1) 이전 stream 정리
  if (opts.prevStream) {
    try {
      for (const t of opts.prevStream.getTracks()) {
        try { t.stop(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
  try { opts.onPrevStop?.(); } catch { /* ignore */ }

  // 2) 80ms 여유 (일부 Android 즉시 재요청 NotReadable 방지)
  const delay = opts.intermediateDelayMs ?? 80;
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  // 3) 새 facing acquire
  try {
    const stream = await tryAcquire(opts.target, gum);
    return { ok: true, stream, facing: opts.target };
  } catch (firstErr) {
    // 4) 원복 시도 (반대 facing)
    const revertFacing = flip(opts.target);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const reverted = await tryAcquire(revertFacing, gum);
      return {
        ok: false,
        stage: 'swap',
        error: firstErr,
        revertedStream: reverted,
        revertedFacing: revertFacing,
      };
    } catch (revertErr) {
      return { ok: false, stage: 'revert', error: revertErr };
    }
  }
}
