/**
 * resourceTracker.test.ts
 *
 * 2회 챌린지 시뮬레이션 — 인스턴스 생성·해제 사이클 후 카운터가 0 으로
 * 돌아오는지 확인. 실제 MediaPipe/MediaRecorder 는 mock 으로 대체.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resourceTracker,
  isResourceTrackerClean,
  type ResourceSnapshot,
} from './resourceTracker';

describe('resourceTracker', () => {
  beforeEach(() => {
    resourceTracker.reset();
  });

  it('초기 상태 — 모든 카운터가 0', () => {
    expect(isResourceTrackerClean()).toBe(true);
  });

  it('inc/dec 사이클 — 0 으로 복귀', () => {
    resourceTracker.inc('audioCtx');
    resourceTracker.inc('mediaStream');
    resourceTracker.inc('poseLandmarker');
    expect(resourceTracker.snapshot().audioCtx).toBe(1);
    expect(resourceTracker.snapshot().mediaStream).toBe(1);

    resourceTracker.dec('audioCtx');
    resourceTracker.dec('mediaStream');
    resourceTracker.dec('poseLandmarker');
    expect(isResourceTrackerClean()).toBe(true);
  });

  it('dec 가 0 미만으로 내려가지 않음', () => {
    resourceTracker.dec('audioCtx');
    expect(resourceTracker.snapshot().audioCtx).toBe(0);
  });

  it('2회 연속 챌린지 시뮬레이션 — 매 세션 MediaPipe/Recorder/Stream 생성→해제 후 0', () => {
    const runSession = () => {
      // 세션 진입 — 리소스 획득
      resourceTracker.inc('mediaStream');
      resourceTracker.inc('poseLandmarker');
      resourceTracker.inc('speechRecognizer');
      resourceTracker.inc('audioCtx');
      resourceTracker.inc('rafLoop');
      // 녹화 시작
      resourceTracker.inc('mediaRecorder');
      // 녹화 종료
      resourceTracker.dec('mediaRecorder');
      // 세션 종료 — cleanup
      resourceTracker.dec('rafLoop');
      resourceTracker.dec('audioCtx');
      resourceTracker.dec('speechRecognizer');
      resourceTracker.dec('poseLandmarker');
      resourceTracker.dec('mediaStream');
    };

    runSession();
    expect(isResourceTrackerClean()).toBe(true);

    runSession();
    expect(isResourceTrackerClean()).toBe(true);

    // 누수 시나리오 시뮬레이션 — 한 세션에서 close() 누락
    resourceTracker.inc('mediaStream');
    resourceTracker.inc('poseLandmarker');
    // close() 가 누락되면 dec 안 됨
    const leaked: ResourceSnapshot = resourceTracker.snapshot();
    expect(leaked.mediaStream).toBe(1);
    expect(leaked.poseLandmarker).toBe(1);
    expect(isResourceTrackerClean()).toBe(false);
  });

  it('window.__motiqResources 에 스냅샷 노출', () => {
    resourceTracker.inc('audioCtx');
    // jsdom 환경에선 window 존재 — 스냅샷이 발행되는지 확인
    if (typeof window !== 'undefined') {
      const exposed = (window as any).__motiqResources as ResourceSnapshot | undefined;
      expect(exposed?.audioCtx).toBe(1);
    }
  });
});
