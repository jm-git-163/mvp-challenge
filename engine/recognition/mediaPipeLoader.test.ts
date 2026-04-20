/**
 * engine/recognition/mediaPipeLoader.test.ts
 *
 * Phase 1-B — 순수 로더 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolvePoseConfig,
  loadPoseLandmarker,
  describeStatus,
  DEFAULT_POSE_CONFIG,
  type PoseLoaderDeps,
  type PoseLandmarkerHandle,
} from './mediaPipeLoader';

function makeHandle(): PoseLandmarkerHandle {
  return {
    detectForVideo: vi.fn(),
    close: vi.fn(),
  };
}

function makeDeps(overrides?: Partial<{
  throwOnImport: boolean;
  throwOnVision: boolean;
  throwOnCreate: boolean;
  handle: PoseLandmarkerHandle;
}>): PoseLoaderDeps {
  const handle = overrides?.handle ?? makeHandle();
  return {
    importMediaPipe: async () => {
      if (overrides?.throwOnImport) throw new Error('import failed');
      return {
        PoseLandmarker: {
          createFromOptions: async () => {
            if (overrides?.throwOnCreate) throw new Error('create failed');
            return handle;
          },
        },
        FilesetResolver: {
          forVisionTasks: async () => {
            if (overrides?.throwOnVision) throw new Error('vision failed');
            return {};
          },
        },
      };
    },
  };
}

describe('resolvePoseConfig', () => {
  it('빈 env + isDev=false → 기본값 + allowMockFallback=false', () => {
    const c = resolvePoseConfig({}, false);
    expect(c.base).toBe(DEFAULT_POSE_CONFIG.base);
    expect(c.modelPath).toBe(DEFAULT_POSE_CONFIG.modelPath);
    expect(c.allowMockFallback).toBe(false);
  });

  it('isDev=true → allowMockFallback=true', () => {
    const c = resolvePoseConfig({}, true);
    expect(c.allowMockFallback).toBe(true);
  });

  it('EXPO_PUBLIC_MEDIAPIPE_BASE 반영 + 끝 슬래시 제거', () => {
    const c = resolvePoseConfig(
      { EXPO_PUBLIC_MEDIAPIPE_BASE: 'https://example.com/mp/' },
      false,
    );
    expect(c.base).toBe('https://example.com/mp');
  });

  it('EXPO_PUBLIC_MEDIAPIPE_MODEL_URL 반영', () => {
    const c = resolvePoseConfig(
      { EXPO_PUBLIC_MEDIAPIPE_MODEL_URL: 'https://example.com/m.task' },
      false,
    );
    expect(c.modelPath).toBe('https://example.com/m.task');
  });
});

describe('loadPoseLandmarker', () => {
  const cfg = { ...DEFAULT_POSE_CONFIG };
  const cfgDev = { ...DEFAULT_POSE_CONFIG, allowMockFallback: true };

  it('성공 → ready-real + handle', async () => {
    const handle = makeHandle();
    const out = await loadPoseLandmarker(cfg, makeDeps({ handle }));
    expect(out.status).toBe('ready-real');
    expect(out.handle).toBe(handle);
    expect(out.error).toBeNull();
  });

  it('import 실패 + allowMockFallback=false → error', async () => {
    const out = await loadPoseLandmarker(cfg, makeDeps({ throwOnImport: true }));
    expect(out.status).toBe('error');
    expect(out.handle).toBeNull();
    expect(out.error?.message).toBe('import failed');
  });

  it('import 실패 + allowMockFallback=true → ready-mock', async () => {
    const out = await loadPoseLandmarker(cfgDev, makeDeps({ throwOnImport: true }));
    expect(out.status).toBe('ready-mock');
    expect(out.handle).toBeNull();
    expect(out.error?.message).toBe('import failed');
  });

  it('vision 실패 → error (prod)', async () => {
    const out = await loadPoseLandmarker(cfg, makeDeps({ throwOnVision: true }));
    expect(out.status).toBe('error');
  });

  it('createFromOptions 실패 → error', async () => {
    const out = await loadPoseLandmarker(cfg, makeDeps({ throwOnCreate: true }));
    expect(out.status).toBe('error');
    expect(out.error?.message).toBe('create failed');
  });

  it('signal 이미 aborted → AbortError', async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await loadPoseLandmarker(cfg, makeDeps(), ac.signal);
    expect(out.status).toBe('error');
    expect(out.error?.name).toBe('AbortError');
  });

  it('로드 중간 abort → handle close 호출 + AbortError', async () => {
    const handle = makeHandle();
    const ac = new AbortController();
    // createFromOptions 완료 후 abort 되도록 딜레이
    const deps: PoseLoaderDeps = {
      importMediaPipe: async () => ({
        PoseLandmarker: {
          createFromOptions: async () => {
            ac.abort();
            return handle;
          },
        },
        FilesetResolver: {
          forVisionTasks: async () => ({}),
        },
      }),
    };
    const out = await loadPoseLandmarker(cfg, deps, ac.signal);
    expect(out.status).toBe('error');
    expect(out.error?.name).toBe('AbortError');
    expect(handle.close).toHaveBeenCalled();
  });
});

describe('describeStatus', () => {
  it('모든 상태가 KO 문자열 + 일관된 오버레이 플래그', () => {
    expect(describeStatus('idle').userTitle).toBe('대기 중');
    expect(describeStatus('loading').userTitle).toContain('다운로드');
    expect(describeStatus('loading').showOverlay).toBe(true);
    expect(describeStatus('ready-real').showOverlay).toBe(false);
    expect(describeStatus('ready-mock').userTitle).toContain('개발');
    expect(describeStatus('ready-mock').showOverlay).toBe(true);
    expect(describeStatus('error').showOverlay).toBe(true);
    expect(describeStatus('error').recoverable).toBe(true);
  });
});
