/**
 * utils/videoCompositor.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { composeVideo } from './videoCompositor';
import { neonArena } from '../data/templates/neon-arena';

describe('videoCompositor Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          const mockCanvas = {
            width: 720,
            height: 1280,
            captureStream: () => ({
              getAudioTracks: () => [],
              addTrack: vi.fn(),
            }),
            getContext: () => ({
              canvas: { width: 720, height: 1280 },
              clearRect: vi.fn(),
              fillRect: vi.fn(),
              save: vi.fn(),
              restore: vi.fn(),
              createLinearGradient: () => ({ addColorStop: vi.fn() }),
              createRadialGradient: () => ({ addColorStop: vi.fn() }),
              drawImage: vi.fn(),
              measureText: () => ({ width: 100 }),
              fillText: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(),
              stroke: vi.fn(),
              arc: vi.fn(),
              clip: vi.fn(),
              translate: vi.fn(),
              scale: vi.fn(),
              createPattern: () => ({}),
              createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
              putImageData: vi.fn(),
            }),
          };
          return mockCanvas;
        }
        if (tag === 'video') {
          return {
            play: vi.fn(async () => {}),
            pause: vi.fn(),
            addEventListener: (event: string, cb: any) => {
              if (event === 'loadedmetadata') setTimeout(cb, 10);
            },
            removeEventListener: vi.fn(),
            videoWidth: 100,
            videoHeight: 100,
            readyState: 4,
          };
        }
        return {};
      }
    });

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    class MockAudioContext {
      sampleRate = 44100;
      createGain() { return { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }; }
      createMediaStreamDestination() { return { stream: { getAudioTracks: () => [] } }; }
      createOscillator() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 440 }, type: 'sine' }; }
      createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
      createBufferSource() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null }; }
      createBiquadFilter() { return { connect: vi.fn(), type: 'highpass', frequency: { value: 6000 } }; }
      get currentTime() { return 0; }
      close() {}
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    const recorderStart = vi.fn();
    class MockMediaRecorder {
      start = recorderStart;
      stop = vi.fn();
      ondataavailable = null;
      onstop = null;
      state = 'inactive';
      static isTypeSupported = vi.fn(() => true);
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    (globalThis as any).recorderStart = recorderStart;

    vi.stubGlobal('requestAnimationFrame', (cb: any) => setTimeout(cb, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: any) => clearTimeout(id));
  });

  it('신형 LayeredTemplate (neonArena) 입력 시 합성 recording 이 시작되어야 한다', async () => {
    const clips = [{ slot_id: 'main', blob: new Blob([''], { type: 'video/webm' }), duration_ms: 1000 }];
    const onProgress = vi.fn();
    
    // @ts-ignore
    composeVideo(neonArena, clips, onProgress);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect((globalThis as any).recorderStart).toHaveBeenCalled();
  });
});
