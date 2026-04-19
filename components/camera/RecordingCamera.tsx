/**
 * RecordingCamera.tsx
 * expo-camera 기반 카메라 컴포넌트
 * 네이티브: 카메라 방향 지원 + 영상 녹화
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewType } from 'expo-camera';
import type { NormalizedLandmark } from '../../utils/poseUtils';

const FRAME_INTERVAL  = 100;   // 10fps
const CAPTURE_QUALITY = 0.25;

export interface RecordingCameraHandle {
  startRecording: () => Promise<string>;
  stopRecording:  () => void;
  isRecording:    () => boolean;
}

interface Props {
  facing?:             'front' | 'back';
  onFrame?:            (base64: string, width: number, height: number) => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  paused?:             boolean;
  landmarks?:          NormalizedLandmark[];  // used only on web; ignored on native
  // Canvas compositing props — web only, ignored on native
  template?:           any;
  elapsed?:            number;
  currentMission?:     any | null;
  missionScore?:       number;
  isRecording?:        boolean;
}

const RecordingCamera = forwardRef<RecordingCameraHandle, Props>(
  ({ facing = 'front', onFrame, onPermissionDenied, children, paused = false }, ref) => {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef      = useRef<CameraViewType>(null);
    const frameTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRecordingRef = useRef(false);
    const isCaptureRef   = useRef(false);

    // 권한 요청
    useEffect(() => {
      if (permission === null) return;
      if (!permission.granted) {
        requestPermission().then((r) => {
          if (!r.granted) onPermissionDenied?.();
        });
      }
    }, [permission]);

    // 프레임 캡처 루프 (네이티브 전용)
    const captureFrame = useCallback(async () => {
      if (Platform.OS === 'web') return;
      if (!cameraRef.current || isCaptureRef.current || paused) return;
      isCaptureRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: CAPTURE_QUALITY,
          skipProcessing: true,
          exif: false,
        });
        if (photo?.base64 && onFrame) {
          onFrame(photo.base64, photo.width || 256, photo.height || 256);
        }
      } catch {
        // frame-level error, ignored
      } finally {
        isCaptureRef.current = false;
      }
    }, [onFrame, paused]);

    useEffect(() => {
      if (!permission?.granted || Platform.OS === 'web') return;
      frameTimerRef.current = setInterval(captureFrame, FRAME_INTERVAL);
      return () => {
        if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      };
    }, [captureFrame, permission?.granted]);

    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          if (Platform.OS === 'web') {
            setTimeout(() => resolve(''), 5000);
            return;
          }
          if (!cameraRef.current) return reject(new Error('카메라 없음'));
          isRecordingRef.current = true;
          cameraRef.current
            .recordAsync({ maxDuration: 60 })
            .then((r) => {
              isRecordingRef.current = false;
              resolve(r?.uri ?? '');
            })
            .catch(reject);
        }),

      stopRecording: () => {
        if (Platform.OS !== 'web') cameraRef.current?.stopRecording?.();
        isRecordingRef.current = false;
      },

      isRecording: () => isRecordingRef.current,
    }));

    if (!permission?.granted && Platform.OS !== 'web') {
      return <View style={styles.container} />;
    }

    return (
      <View style={styles.container}>
        {Platform.OS !== 'web' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing as CameraType}
            mode="video"
            videoQuality="720p"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.webPlaceholder]} />
        )}
        {children}
      </View>
    );
  },
);

RecordingCamera.displayName = 'RecordingCamera';
export default RecordingCamera;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webPlaceholder: { backgroundColor: '#111827' },
});
