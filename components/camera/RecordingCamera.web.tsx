/**
 * RecordingCamera.web.tsx — 웹 전용
 * 브라우저 getUserMedia 사용. 전면/후면 카메라 전환 지원.
 * 실제 카메라 스트림 표시 + MediaRecorder 녹화.
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
  facing?:             'front' | 'back';
  onFrame?:            (base64: string, w: number, h: number) => void;
  onPermissionDenied?: () => void;
  children?:           React.ReactNode;
  paused?:             boolean;
}

const RecordingCameraWeb = forwardRef<RecordingCameraHandle, Props>(
  ({ facing = 'front', onPermissionDenied, children }, ref) => {
    const videoRef  = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mrRef     = useRef<MediaRecorder | null>(null);
    const isRecRef  = useRef(false);
    const [ready,  setReady]  = useState(false);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
      let cancelled = false;

      const facingMode = facing === 'front' ? 'user' : 'environment';

      // Stop any existing stream
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);

      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode }, audio: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setReady(true);
        })
        .catch(() => {
          if (!cancelled) {
            setDenied(true);
            onPermissionDenied?.();
          }
        });

      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
    }, [facing]);

    useImperativeHandle(ref, () => ({
      startRecording: () =>
        new Promise<string>((resolve) => {
          const stream = streamRef.current;
          if (!stream) { resolve(''); return; }

          isRecRef.current = true;
          const chunks: BlobPart[] = [];

          // Pick best supported mime type
          const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4',
            '',
          ];
          const mimeType = mimeTypes.find((m) => !m || MediaRecorder.isTypeSupported(m)) ?? '';
          const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

          mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          mr.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            resolve(URL.createObjectURL(blob));
            isRecRef.current = false;
          };

          mr.start(100); // collect data every 100ms
          mrRef.current = mr;

          // Safety stop after 90s
          setTimeout(() => {
            if (mr.state !== 'inactive') mr.stop();
          }, 90000);
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

    const isFront = facing === 'front';

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
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Mirror front camera
            transform: isFront ? 'scaleX(-1)' : 'none',
          }}
        />
        {children}
      </View>
    );
  },
);

RecordingCameraWeb.displayName = 'RecordingCameraWeb';
export default RecordingCameraWeb;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  denied:    { alignItems: 'center', justifyContent: 'center', gap: 12 },
  deniedText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deniedSub:  { color: '#aaa', fontSize: 13 },
});
