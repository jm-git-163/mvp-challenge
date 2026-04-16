/**
 * RecordingCamera.web.tsx — 웹 전용
 * expo-camera 없이 브라우저 getUserMedia 사용.
 * 실제 카메라 스트림 표시 + 목 녹화 흐름.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react';
import { View, StyleSheet, Text } from 'react-native';
import type { RecordingCameraHandle } from './RecordingCamera';

interface Props {
  onFrame?:            (base64: string, w: number, h: number) => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  paused?:             boolean;
}

const RecordingCameraWeb = forwardRef<RecordingCameraHandle, Props>(
  ({ onPermissionDenied, children }, ref) => {
    const videoRef  = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mrRef     = useRef<MediaRecorder | null>(null);
    const [ready, setReady] = useState(false);
    const [denied, setDenied] = useState(false);
    const isRecRef  = useRef(false);

    // 브라우저 카메라 스트림 연결
    useEffect(() => {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setReady(true);
        })
        .catch(() => {
          setDenied(true);
          onPermissionDenied?.();
        });

      return () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
    }, []);

    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve) => {
          isRecRef.current = true;
          // 웹: 브라우저 MediaRecorder로 녹화 (간이 구현)
          if (!streamRef.current) { resolve(''); return; }
          const chunks: BlobPart[] = [];
          const mr = new MediaRecorder(streamRef.current);
          mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          mr.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(URL.createObjectURL(blob));
            isRecRef.current = false;
          };
          mr.start();
          // maxDuration 60초 후 자동 stop
          setTimeout(() => { if (mr.state !== 'inactive') mr.stop(); }, 60000);
          // stop 호출용으로 컴포넌트 내부 ref에 저장
          mrRef.current = mr;
        }),

      stopRecording: () => {
        const mr = mrRef.current;
        if (mr && mr.state !== 'inactive') mr.stop();
        isRecRef.current = false;
      },

      isRecording: () => isRecRef.current,
    }));

    if (denied) {
      return (
        <View style={[styles.container, styles.denied]}>
          <Text style={styles.deniedText}>📷 카메라 권한이 필요합니다</Text>
          <Text style={styles.deniedSub}>브라우저 주소창 옆 🔒 → 카메라 허용</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* @ts-ignore — web video element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // 전면 카메라 미러
          }}
        />
        {children}
      </View>
    );
  }
);

RecordingCameraWeb.displayName = 'RecordingCameraWeb';
export default RecordingCameraWeb;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  denied:    { alignItems: 'center', justifyContent: 'center', gap: 12 },
  deniedText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deniedSub:  { color: '#aaa', fontSize: 13 },
});
