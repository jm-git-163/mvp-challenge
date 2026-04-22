/**
 * resourceTracker.ts
 *
 * 앱 전역에서 생성/해제되는 레거시/MediaPipe/Audio/MediaStream 리소스 카운터.
 * 챌린지를 2회 이상 연속 수행했을 때 누수된 인스턴스가 남는지 즉시 눈으로
 * 확인할 수 있도록 `?debug=1` 오버레이에 노출한다.
 *
 * 사용:
 *   import { resourceTracker } from '../utils/resourceTracker';
 *   resourceTracker.inc('audioCtx');  // 생성 시
 *   resourceTracker.dec('audioCtx');  // .close() 성공 후
 *   resourceTracker.snapshot();       // 현재 카운터 스냅샷
 *
 * 순수 모듈 — window 전역도 안전하게 업데이트.
 */

export type ResourceKind =
  | 'mediaStream'         // getUserMedia 스트림 (live)
  | 'audioCtx'            // AudioContext (open)
  | 'poseLandmarker'      // MediaPipe PoseLandmarker
  | 'faceLandmarker'      // MediaPipe FaceLandmarker
  | 'gestureRecognizer'   // MediaPipe GestureRecognizer
  | 'mediaRecorder'       // MediaRecorder (state != 'inactive')
  | 'speechRecognizer'    // webkitSpeechRecognition 인스턴스
  | 'rafLoop';            // 돌고 있는 requestAnimationFrame 루프

export interface ResourceSnapshot {
  mediaStream: number;
  audioCtx: number;
  poseLandmarker: number;
  faceLandmarker: number;
  gestureRecognizer: number;
  mediaRecorder: number;
  speechRecognizer: number;
  rafLoop: number;
}

function makeEmpty(): ResourceSnapshot {
  return {
    mediaStream: 0,
    audioCtx: 0,
    poseLandmarker: 0,
    faceLandmarker: 0,
    gestureRecognizer: 0,
    mediaRecorder: 0,
    speechRecognizer: 0,
    rafLoop: 0,
  };
}

class ResourceTrackerImpl {
  private counts: ResourceSnapshot = makeEmpty();

  inc(kind: ResourceKind): void {
    this.counts[kind] += 1;
    this._publish();
  }

  dec(kind: ResourceKind): void {
    this.counts[kind] = Math.max(0, this.counts[kind] - 1);
    this._publish();
  }

  reset(): void {
    this.counts = makeEmpty();
    this._publish();
  }

  snapshot(): ResourceSnapshot {
    return { ...this.counts };
  }

  private _publish(): void {
    if (typeof window !== 'undefined') {
      try {
        (window as any).__motiqResources = this.snapshot();
      } catch {
        /* ignore */
      }
    }
  }
}

export const resourceTracker = new ResourceTrackerImpl();

/** 테스트·검증용: 카운터가 전부 0 이면 true */
export function isResourceTrackerClean(): boolean {
  const s = resourceTracker.snapshot();
  return (Object.keys(s) as (keyof ResourceSnapshot)[])
    .every((k) => s[k] === 0);
}
