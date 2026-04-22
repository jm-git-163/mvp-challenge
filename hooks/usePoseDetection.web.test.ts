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

  it('프로덕션에서 실패 시 mock 모드 + 명시적 에러 메시지 (FIX-Z13)', async () => {
    vi.spyOn(mediaPipeLoader, 'loadPoseLandmarker').mockResolvedValue({
      status: 'error',
      handle: null,
      error: new Error('fail')
    });

    usePoseDetection();
    // Run the first effect (load pipeline)
    const effect = mockState.effects[0];
    await effect();

    // FIX-Z13: 프로덕션에서도 mock 폴백. "아무것도 안됨" 보다 "가짜라도 움직임" 우선.
    expect(mockState.data[0]).toBe('ready-mock');        // status
    expect(mockState.data[1]).toBe(true);                // isReady
    expect(String(mockState.data[4])).toContain('MediaPipe load failed'); // error message visible
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
    expect(mockState.data[4]).toContain('mock pose (dev)');
  });
});
