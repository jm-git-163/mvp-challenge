/**
 * app/debug/layers/subtitle_track.tsx
 *
 * Focused Session-4 Candidate O:
 *   subtitle_track 레이어 단독 디버그 페이지.
 *   - TextInput → liveState.setSpeechTranscript
 *   - 웹에서는 640x360 canvas 에 subtitle_track 렌더러 직접 호출
 *   - 네이티브에서는 liveState 텍스트 덤프만 표시 (canvas 미지원)
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import subtitleTrack from '../../../engine/composition/layers/subtitle_track';
import {
  getLiveState,
  setSpeechTranscript,
  subscribeLiveState,
} from '../../../engine/composition/liveState';
import type { BaseLayer } from '../../../engine/templates/schema';

const W = 640;
const H = 360;

const SAMPLE_LAYER: BaseLayer = {
  id: 'debug-subtitle',
  type: 'subtitle_track',
  zIndex: 99,
  visible: true,
  opacity: 1,
  blendMode: 'source-over',
  props: {
    style: 'broadcast',
    maxChars: 80,
    maxSentences: 2,
    fontSize: 28,
    position: 'bottom-center',
  },
} as unknown as BaseLayer;

export default function SubtitleTrackDebug() {
  const [text, setText] = useState('');
  const hostRef = useRef<View | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // web: mount a native <canvas> inside the View host div
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.background = '#111827';
    canvas.style.borderRadius = '12px';
    host.appendChild(canvas);
    canvasRef.current = canvas;
    return () => {
      canvas.remove();
      canvasRef.current = null;
    };
  }, []);

  // re-render on every liveState change
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // clear + dark gradient bg (fake camera frame placeholder)
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1e293b');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // axis guides
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      subtitleTrack(ctx, SAMPLE_LAYER, performance.now(), getLiveState());
    };
    draw();
    const unsub = subscribeLiveState(draw);
    return () => { unsub(); };
  }, []);

  const onChangeText = (v: string) => {
    setText(v);
    // final 쪽에 넣으면 interim 비워짐 — 디버그 입력은 final 로 취급
    setSpeechTranscript(v, '');
  };

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>subtitle_track · Session-4 O</Text>
      <Text style={styles.hint}>입력 텍스트가 liveState.speechTranscript 로 반영되어 캔버스에 자막으로 그려집니다.</Text>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={onChangeText}
        placeholder="자막으로 표시할 문장 입력 (예: 안녕하세요. 반갑습니다!)"
        placeholderTextColor="#64748b"
        multiline
      />

      {Platform.OS === 'web' ? (
        <View ref={hostRef} style={styles.canvasHost} />
      ) : (
        <View style={styles.nativeFallback}>
          <Text style={styles.nativeFallbackText}>
            네이티브 환경은 canvas 미지원. liveState.speechTranscript = "{getLiveState().speechTranscript}"
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617', padding: 20, gap: 16 },
  title: { color: '#f1f5f9', fontSize: 22, fontWeight: '700' },
  hint: { color: '#94a3b8', fontSize: 13 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  canvasHost: { alignSelf: 'center', marginTop: 8 },
  nativeFallback: { padding: 16, backgroundColor: '#1e293b', borderRadius: 10 },
  nativeFallbackText: { color: '#e2e8f0' },
});
