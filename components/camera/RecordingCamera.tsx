/**
 * RecordingCamera.tsx
 * expo-camera 기반 카메라 컴포넌트
 * 웹: getUserMedia 카메라 프리뷰 (포즈 추정은 목 모드 동작)
 * 네이티브: 전면 카메라 + 10fps 프레임 캡처 + 영상 녹화
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

const FRAME_INTERVAL   = 100;   // 10fps
const CAPTURE_QUALITY  = 0.25;

export interface RecordingCameraHandle {
  startRecording: () => Promise<string>;
  stopRecording:  () => void;
  isRecording:    () => boolean;
}

interface Props {
  onFrame?:            (base64: string, width: number, height: number) => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  paused?:             boolean;
}

const RecordingCamera = forwardRef<RecordingCameraHandle, Props>(
  ({ onFrame, onPermissionDenied, children, paused = false }, ref) => {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef        = useRef<CameraViewType>(null);
    const frameTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRecordingRef   = useRef(false);
    const isCaptureRef     = useRef(false);

    // 권한 요청
    useEffect(() => {
      if (permission === null) return;
      if (!permission.granted) {
        requestPermission().then((r) => {
          if (!r.granted) onPermissionDenied?.();
        });
      }
    }, [permission]);

    // 프레임 캡처 루프 (네이티브 전용 — 웹은 목 포즈로 자동 처리)
    const captureFrame = useCallback(async () => {
      if (Platform.OS === 'web') return;        // 웹은 목 모드에서 자동 생성
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
        // 프레임 단위 실패 무시
      } finally {
        isCaptureRef.current = false;
      }
    }, [onFrame, paused]);

    useEffect(() => {
      if (!permission?.granted || Platform.OS === 'web') return;
      frameTimerRef.current = setInterval(captureFrame, FRAME_INTERVAL);
      return () => { if (frameTimerRef.current) clearInterval(frameTimerRef.current); };
    }, [captureFrame, permission?.granted]);

    // 외부에서 호출 가능한 녹화 핸들
    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve, reject) => {
          if (Platform.OS === 'web') {
            // 웹: 5초 후 빈 URI 반환 (시뮬레이션)
            setTimeout(() => resolve(''), 5000);
            return;
          }
          if (!cameraRef.current) return reject(new Error('카메라 없음'));
          isRecordingRef.current = true;
          cameraRef.current
            .recordAsync({ maxDuration: 60 })
            .then((r) => { isRecordingRef.current = false; resolve(r?.uri ?? ''); })
            .catch(reject);
        }),

      stopRecording: () => {
        if (Platform.OS !== 'web') cameraRef.current?.stopRecording?.();
        isRecordingRef.current = false;
      },

      isRecording: () => isRecordingRef.current,
    }));

    // 웹: 브라우저 카메라 없이도 어두운 배경으로 대체
    if (!permission?.granted && Platform.OS !== 'web') {
      return <View style={styles.container} />;
    }

    return (
      <View style={styles.container}>
        {Platform.OS !== 'web' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={'front' as CameraType}
            mode="video"
            videoQuality="720p"
          />
        ) : (
          // 웹: 카메라 프리뷰 대신 어두운 배경 + 목 오버레이 표시
          <View style={[StyleSheet.absoluteFill, styles.webPlaceholder]} />
        )}
        {children}
      </View>
    );
  }
);

RecordingCamera.displayName = 'RecordingCamera';
export default RecordingCamera;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webPlaceholder: { backgroundColor: '#111827' },
});
