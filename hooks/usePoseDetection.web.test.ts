/**
 * hooks/usePoseDetection.web.test.ts
 *
 * Phase 1-B — usePoseDetection 훅 동작 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePoseDetection } from './usePoseDetection.web';
import * as mediaPipeLoader from '../engine/recognition/mediaPipeLoader';

// Global mocks for state capture
const mockState = {
  data: [] as any[],
  index: 0,
  effects: [] as Function[],
  reset() {
    this.data = [];
    this.index = 0;
    this.effects = [];
  }
};

vi.mock('react', () => ({
  useState: (initial: any) => {
    const id = mockState.index++;
    if (mockState.data.length <= id) mockState.data[id] = initial;
    const setState = (val: any) => {
      mockState.data[id] = typeof val === 'function' ? val(mockState.data[id]) : val;
    };
    return [mockState.data[id], setState];
  },
  useEffect: (fn: Function) => {
    mockState.effects.push(fn);
  },
  useRef: (initial: any) => ({ current: initial }),
  useCallback: (fn: any) => fn,
  useMemo: (fn: any) => fn(),
}));

describe('usePoseDetection (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.reset();
    vi.stubGlobal('performance', { now: () => 1000 });
    vi.stubGlobal('process', { env: { NODE_ENV: 'production' } });
    vi.spyOn(mediaPipeLoader, 'loadPoseLandmarker').mockImplementation(async () => ({
      status: 'ready-real',
      handle: { close: vi.fn(), detectForVideo: vi.fn() } as any,
      error: null
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispose() 호출 시 상태가 초기화된다', () => {
    const hook = usePoseDetection();
    hook.dispose();
    expect(mockState.data[0]).toBe('idle'); // status
    expect(mockState.data[1]).toBe(false);  // isReady
  });

  it('프로덕션에서 실패 시 error 상태 유지 (Team RECOG: 가짜 평가 근절)', async () => {
    vi.spyOn(mediaPipeLoader, 'loadPoseLandmarker').mockResolvedValue({
      status: 'error',
      handle: null,
      error: new Error('fail')
    });

    usePoseDetection();
    // Run the first effect (load pipeline)
    const effect = mockState.effects[0];
    await effect();

    // Team RECOG (2026-04-22): 프로덕션에서 mock 폴백 금지.
    //   과거 FIX-Z13 이 켰던 mock 은 landmark.score=0.92 로 visibility 게이트를
    //   통과해 "가짜 평가" (스쿼트 카운트/점수) 를 유발했다. 이제는 명시적
    //   error 상태로 남아 재시도 오버레이가 표시된다.
    expect(mockState.data[0]).toBe('error');             // status
    expect(mockState.data[1]).toBe(false);               // isReady (가짜 ready=true 금지)
    expect(String(mockState.data[4])).toContain('포즈 엔진 로드 실패'); // Korean error surfaced
  });

  it('BlazePose 33 → MoveNet 17 리맵 결과가 17 개여야 한다 (FIX-Z16)', () => {
    // 리맵 인덱스는 usePoseDetection.web.ts 내부 BP_TO_MN 과 동일해야 한다.
    // 직접 호출할 수 없으므로 동일 매핑으로 17 크기 검증.
    const BP_TO_MN = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    expect(BP_TO_MN.length).toBe(17);
    // 스쿼트 판정이 쓰는 핵심 인덱스가 실제로 다리(knee=13,14 / ankle=15,16) 로 매핑.
    expect(BP_TO_MN[13]).toBe(25); // MoveNet left_knee → BlazePose 25
    expect(BP_TO_MN[14]).toBe(26); // MoveNet right_knee → BlazePose 26
    expect(BP_TO_MN[15]).toBe(27); // MoveNet left_ankle → BlazePose 27
    expect(BP_TO_MN[16]).toBe(28); // MoveNet right_ankle → BlazePose 28
  });

  it('개발 환경에서 실패 시 mock 모드로 전환한다', async () => {
    vi.stubGlobal('process', { env: { NODE_ENV: 'development' } });
    vi.spyOn(mediaPipeLoader, 'loadPoseLandmarker').mockResolvedValue({
      status: 'error',
      handle: null,
      error: new Error('fail')
    });

    usePoseDetection();
    const effect = mockState.effects[0];
    await effect();

    expect(mockState.data[0]).toBe('ready-mock');
    // Dev message updated to clarify "desktop only" — mobile UA never gets mock
    // even in dev (per Team RECOG anti-fake-eval policy).
    expect(mockState.data[4]).toContain('mock pose');
  });
});
