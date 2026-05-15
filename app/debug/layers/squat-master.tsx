/**
 * app/debug/layers/squat-master.tsx
 *
 * Phase 5 wave1 — squat-master 템플릿 15+ 레이어 동시 합성 미리보기.
 *   - 카메라/마이크 권한 없이도 비주얼만 렌더 (camera_feed 는 검은 피드로 대체).
 *   - requestAnimationFrame 루프로 renderLayeredFrame 호출.
 *   - 템플릿 postProcess (faux bloom + chromatic + vignette + saturation) 포함.
 *   - 비트 싱크는 beatClock fallback (bpm 120 synthesize) 로 beatIntensity 주입.
 *
 * 웹 전용. 네이티브에서는 안내 텍스트만 표시.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { squatMaster } from '../../../data/templates/squat-master';
import { setBeatIntensity } from '../../../engine/composition/liveState';
import { synthesizeBeats } from '../../../engine/beat/beatClock';
import { renderLayeredFrame } from '../../../utils/videoCompositor';

const W = 360;
const H = 640;

export default function SquatMasterDebug() {
  const hostRef = useRef<View | null>(null);
  const [layerCount, setLayerCount] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.background = '#000';
    canvas.style.borderRadius = '12px';
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setLayerCount(squatMaster.layers?.length ?? 0);

    // 비트 폴백: bpm 128 균등 비트 → 최근 비트 이후 경과로 intensity decay
    const beats = synthesizeBeats(128, squatMaster.duration ?? 20).beats;
    const tStart = performance.now();
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const tSec = ((now - tStart) / 1000) % (squatMaster.duration ?? 20);

      // nearest prior beat → decay 150ms
      let lastBeat = 0;
      for (const b of beats) { if (b <= tSec) lastBeat = b; else break; }
      const dt = tSec - lastBeat;
      const intensity = Math.max(0, 1 - dt / 0.15);
      setBeatIntensity(intensity);

      try {
        // squatMaster canvasSize 는 1080x1920, 프리뷰 360x640 으로 스케일.
        // renderLayeredFrame 은 ctx.canvas.width/height 기반으로 그림 → 디버그는 작은 캔버스에
        // 대강 비례해서 렌더. 비율만 유지 (9:16).
        renderLayeredFrame(
          ctx,
          squatMaster as any,
          tSec * 1000,
          {} as any,
        );
      } catch (e) {
        // 격리: 개별 레이어 오류는 compositor 내부에서 warn 로 이미 처리됨.
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      host.removeChild(canvas);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>squat-master · wave1 preview</Text>
      <Text style={styles.sub}>레이어 수: {layerCount} (목표 15+)</Text>
      <Text style={styles.sub}>postProcess: bloom · chromatic · vignette · saturation (Canvas 2D)</Text>
      <Text style={styles.sub}>beatIntensity: synthesized 128bpm fallback</Text>
      <View ref={hostRef} style={styles.stage} />
      {Platform.OS !== 'web' && (
        <Text style={styles.warn}>네이티브에서는 미리보기 비활성 — 웹 브라우저로 열어주세요.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', paddingVertical: 16 },
  title: { color: '#FFD23F', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sub:   { color: '#c7d2fe', fontSize: 12, marginBottom: 4 },
  stage: { marginTop: 12, width: W, height: H },
  warn:  { color: '#FF6B6B', marginTop: 12, fontSize: 12 },
});
