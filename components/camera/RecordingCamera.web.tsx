import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { RecordingCameraHandle } from './RecordingCamera';

// ---------------------------------------------------------------------------
// Module-level stream cache (singleton) -- persists across navigations
// ---------------------------------------------------------------------------
let _streamCache: { stream: MediaStream; facing: 'front' | 'back' } | null = null;

async function acquireStream(facing: 'front' | 'back'): Promise<MediaStream> {
  // Reuse cached stream if all tracks are live and facing matches
  if (_streamCache) {
    const allLive = _streamCache.stream
      .getTracks()
      .every((t) => t.readyState === 'live');
    if (allLive && _streamCache.facing === facing) {
      return _streamCache.stream;
    }
    // Stop stale or wrong-facing stream before acquiring a new one
    _streamCache.stream.getTracks().forEach((t) => t.stop());
    _streamCache = null;
  }

  const facingMode = facing === 'front' ? 'user' : 'environment';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  _streamCache = { stream, facing };
  return stream;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RecordingCameraWebProps {
  facing?: 'front' | 'back';
  onFrame?: (video: HTMLVideoElement) => void;
  onPermissionDenied?: () => void;
  children?: React.ReactNode;
  paused?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const RecordingCameraWeb = forwardRef<RecordingCameraHandle, RecordingCameraWebProps>(
  (
    {
      facing = 'front',
      onFrame,
      onPermissionDenied,
      children,
      paused = false,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const frameRafRef = useRef<number | null>(null);
    const mountedFacingRef = useRef<'front' | 'back'>(facing);

    const [denied, setDenied] = useState(false);
    const [ready, setReady] = useState(false);
    const [recording, setRecording] = useState(false);

    // ------------------------------------------------------------------
    // Stream acquisition
    // ------------------------------------------------------------------
    useEffect(() => {
      let cancelled = false;

      const setup = async () => {
        // If facing changed within the same mount, evict the cached stream
        // so acquireStream opens a correctly-oriented one.
        if (mountedFacingRef.current !== facing && _streamCache) {
          _streamCache.stream.getTracks().forEach((t) => t.stop());
          _streamCache = null;
        }
        mountedFacingRef.current = facing;

        try {
          const stream = await acquireStream(facing);
          if (cancelled) return;

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {
              // autoplay may be briefly blocked; not fatal
            });
          }
          setDenied(false);
          setReady(true);
        } catch (err) {
          if (cancelled) return;
          console.warn('[RecordingCamera] getUserMedia failed:', err);
          setDenied(true);
          setReady(false);
          onPermissionDenied?.();
        }
      };

      setup();

      return () => {
        cancelled = true;
        // Do NOT stop the stream on unmount -- keep alive in cache
        // so the next navigation reuses it without re-prompting the user.
        if (frameRafRef.current !== null) {
          cancelAnimationFrame(frameRafRef.current);
          frameRafRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    // ------------------------------------------------------------------
    // onFrame callback loop
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!ready || !onFrame || paused) return;

      const loop = () => {
        if (videoRef.current) onFrame(videoRef.current);
        frameRafRef.current = requestAnimationFrame(loop);
      };
      frameRafRef.current = requestAnimationFrame(loop);

      return () => {
        if (frameRafRef.current !== null) {
          cancelAnimationFrame(frameRafRef.current);
          frameRafRef.current = null;
        }
      };
    }, [ready, onFrame, paused]);

    // ------------------------------------------------------------------
    // Imperative handle
    // ------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          const stream = streamRef.current;
          if (!stream) {
            reject(new Error('No camera stream available'));
            return;
          }

          chunksRef.current = [];

          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';

          const recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
          );
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, {
              type: mimeType || 'video/webm',
            });
            const url = URL.createObjectURL(blob);
            resolve(url);
          };

          recorder.onerror = (e) => reject(e);

          recorder.start(100); // collect data in 100 ms chunks
          setRecording(true);
        }),

      stopRecording: () => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== 'inactive'
        ) {
          mediaRecorderRef.current.stop();
          // Intentionally do NOT stop the camera stream
        }
        setRecording(false);
      },

      isRecording: () => recording,
    }));

    // ------------------------------------------------------------------
    // Permission-denied UI
    // ------------------------------------------------------------------
    if (denied) {
      return (
        <View style={styles.deniedContainer}>
          <Text style={styles.deniedIcon}>📷</Text>
          <Text style={styles.deniedTitle}>카메라 접근 거부됨</Text>
          <Text style={styles.deniedBody}>
            브라우저 설정에서 카메라 및 마이크 권한을 허용해 주세요.
          </Text>
          <TouchableOpacity
            style={styles.deniedButton}
            onPress={() => {
              setDenied(false);
              acquireStream(facing)
                .then((stream) => {
                  streamRef.current = stream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                  }
                  setReady(true);
                })
                .catch(() => {
                  setDenied(true);
                  onPermissionDenied?.();
                });
            }}
          >
            <Text style={styles.deniedButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ------------------------------------------------------------------
    // Main render
    // ------------------------------------------------------------------
    return (
      <View style={styles.container}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Mirror front camera so it feels natural (selfie orientation)
            transform: facing === 'front' ? 'scaleX(-1)' : 'none',
            display: 'block',
          }}
          autoPlay
          playsInline
          muted
        />
        {/* Children are rendered absolutely on top of the video feed */}
        {children && (
          <View style={styles.childrenLayer} pointerEvents="box-none">
            {children}
          </View>
        )}
        {/* Recording indicator dot */}
        {recording && <View style={styles.recDot} />}
      </View>
    );
  },
);

RecordingCameraWeb.displayName = 'RecordingCameraWeb';

export default RecordingCameraWeb;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative' as any,
    overflow: 'hidden' as any,
  },
  childrenLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  recDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  deniedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  deniedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deniedBody: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  deniedButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  deniedButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
});
