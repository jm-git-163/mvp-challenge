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
  // FIX-Z25 (2026-04-22): 부모가 유저 제스처 스택 안에서 video.play() 를
  //   한번 더 찔러줄 수 있게 하는 hatch. iOS Safari 의 autoplay gesture
  //   정책상 컴포넌트 내부 비동기 setup 에서 play() 가 거부될 때,
  //   "챌린지 시작" 버튼 onPress 에서 이것을 호출해야 안정적으로 풀림.
  //   네이티브 빌드에서는 no-op.
  kickPlay?:      () => void;
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
  currentTag?:         'perfect' | 'good' | 'fail' | null;
  tagTimestamp?:       number;
  combo?:              number;
  squatCount?:         number;
  voiceTranscript?:    string;
  // FIX-Z25: web-only pass-through props (native 에서는 사용 안 함).
  latestJudgement?:        any;
  lastSquatCountAt?:       number | null;
  micPermissionDeniedAt?:  number | null;
  liveCaptionText?:        string;
  liveCaptionAccent?:      string;
  showLiveCaption?:        boolean;
  // 기존 diag props 도 web only — 웹에서 JSX 전파 시 TS 에러 방지용.
  showDiagnostics?:        boolean;
  diagVoiceListening?:     boolean;
  diagVoiceTranscript?:    string;
  diagVoiceError?:         string | null;
  diagVoicePreCheckOk?:    boolean | null;
  diagVoiceSupported?:     boolean;
  diagPoseStatus?:         string;
  diagPoseLandmarkCount?:  number;
  diagIsRealPose?:         boolean;
  diagSquatCount?:         number;
  diagSquatTarget?:        number;
  diagSquatPhase?:         string;
  diagSquatReady?:         boolean;
  diagSquatFaceOk?:        boolean;
  diagSquatBodyOk?:        boolean;
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
