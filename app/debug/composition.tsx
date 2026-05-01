/**
 * app/debug/composition.tsx
 *
 * Phase 5 wave1 — debug/composition 단일 화면 합성 미리보기.
 *
 * 목적: 출시 수준 §1.2(15~25 레이어 동시 렌더) 가 실제로 한 캔버스 안에서
 *   동작하는지 권한 없이도 즉시 눈으로 확인.
 *
 * 동작:
 *   - 9:16 캔버스(360×640 프리뷰).
 *   - squat-master 템플릿 layers + buildIntroLayers + buildOutroLayers + karaoke_caption 데모.
 *   - synthesizeBeats(128 BPM) 폴백으로 beatIntensity 주입 → beat_flash·pulse_circle 등 반응.
 *   - 자막 미션 시각화: state.scriptText 와 state.scriptProgress 를 시간에 따라 진행.
 *   - SFX 버튼 — playSfx 동작 검증.
 *   - 카메라 권한 없음 → camera_feed 는 검은 영역 (compositor 가 video 없으면 스킵).
 *
 * 웹 전용. 네이티브에서는 안내 텍스트만.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { squatMaster } from '../../data/templates/squat-master';
import { setBeatIntensity } from '../../engine/composition/liveState';
import { synthesizeBeats } from '../../engine/beat/beatClock';
import { buildIntroLayers } from '../../engine/composition/sequences/intro';
import { buildOutroLayers } from '../../engine/composition/sequences/outro';
import { playSfx, unlockSfx } from '../../engine/audio/sfxPlayer';
import { renderLayeredFrame } from '../../utils/videoCompositor';

const PREVIEW_W = 360;
const PREVIEW_H = 640;

const SCRIPT_DEMO =
  '오늘도 한 발 더 나아간다. 흔들려도 괜찮아. 다시 일어서면 그게 답이야.';

export default function CompositionDebug() {
  const hostRef = useRef<View | null>(null);
  const [layerCount, setLayerCount] = useState(0);
  const [running, setRunning] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);
  const tStartRef = useRef<number>(0);

  // 레이어 합본: 인트로(2.4s) + squat-master + karaoke_caption + 아웃트로(3s)
  const totalDuration = (squatMaster.duration ?? 20) + 2.4 + 3;
  const introLayers = buildIntroLayers({
    title: 'COMPOSITION TEST',
    accent: '#FFD23F',
    startSec: 0,
    durationSec: 2.4,
  });
  const karaokeLayer = {
    id: '__demo_karaoke',
    type: 'karaoke_caption' as const,
    zIndex: 70,
    opacity: 1,
    enabled: true,
    props: {
      text: SCRIPT_DEMO,
      fontSize: 38,
      activeColor: '#FFD23F',
      baseColor: 'rgba(255,255,255,0.5)',
      strokeWidth: 4,
      position: 'bottom-center',
    },
    activeRange: { startSec: 2.4, endSec: 2.4 + (squatMaster.duration ?? 20) },
  };
  const outroLayers = buildOutroLayers({
    startSec: 2.4 + (squatMaster.duration ?? 20),
    durationSec: 3,
    accent: '#FFD23F',
  });
  const composedTemplate = {
    ...squatMaster,
    duration: totalDuration,
    layers: [
      ...introLayers,
      ...((squatMaster.layers ?? []).map((l) => ({
        ...l,
        activeRange: l.activeRange
          ? { startSec: l.activeRange.startSec + 2.4, endSec: l.activeRange.endSec + 2.4 }
          : { startSec: 2.4, endSec: 2.4 + (squatMaster.duration ?? 20) },
      }))),
      karaokeLayer,
      ...outroLayers,
    ],
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setLayerCount(composedTemplate.layers.length);
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    canvas.style.width = `${PREVIEW_W}px`;
    canvas.style.height = `${PREVIEW_H}px`;
    canvas.style.background = '#000';
    canvas.style.borderRadius = '12px';
    canvas.style.boxShadow = '0 0 40px rgba(255, 210, 63, 0.25)';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const beats = synthesizeBeats(128, totalDuration).beats;
    tStartRef.current = performance.now();
    let raf = 0;
    let lastBeatIdx = -1;

    const tick = () => {
      if (!running) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      const tSec = ((now - tStartRef.current) / 1000) % totalDuration;
      setCurrentSec(tSec);

      // 비트 폴백 — nearest prior beat 기반 decay 150ms
      let lastBeat = 0;
      let beatIdx = -1;
      for (let i = 0; i < beats.length; i++) {
        if (beats[i] <= tSec) { lastBeat = beats[i]; beatIdx = i; }
        else break;
      }
      const dt = tSec - lastBeat;
      const intensity = Math.max(0, 1 - dt / 0.15);
      setBeatIntensity(intensity);

      // 비트 변화 감지 → SFX (조용함, 데모에서는 끄는 게 기본)
      if (beatIdx !== lastBeatIdx) {
        lastBeatIdx = beatIdx;
        // playSfx('beat', { volume: 0.05 }); // 시끄러우면 주석 처리
      }

      // karaoke 진행도 — script 구간 전체에서 0..1
      const scriptStart = 2.4;
      const scriptEnd = 2.4 + (squatMaster.duration ?? 20);
      let scriptProgress = 0;
      if (tSec >= scriptStart && tSec <= scriptEnd) {
        scriptProgress = (tSec - scriptStart) / (scriptEnd - scriptStart);
      } else if (tSec > scriptEnd) {
        scriptProgress = 1;
      }

      try {
        renderLayeredFrame(
          ctx,
          composedTemplate as any,
          tSec * 1000,
          {
            scriptProgress,
            scriptText: SCRIPT_DEMO,
            squatCount: Math.floor(((tSec - 2.4) / (squatMaster.duration ?? 20)) * 10),
            totalScore: Math.min(100, Math.floor(((tSec / totalDuration) * 100))),
            starRating: 1 + Math.round((Math.min(100, tSec / totalDuration * 100)) / 25),
          } as any,
        );
      } catch {
        // compositor 가 개별 레이어 에러 격리
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      try { host.removeChild(canvas); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>composition debug</Text>
        <Text style={styles.note}>웹 전용 미리보기입니다. (Platform.OS !== 'web')</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Phase 5 wave1 · composition</Text>
      <Text style={styles.meta}>
        layers: {layerCount} · t = {currentSec.toFixed(2)}s / {totalDuration.toFixed(1)}s · BPM 128
      </Text>
      <View ref={hostRef} style={styles.canvasHost} />
      <View style={styles.controls}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            setRunning((r) => !r);
            tStartRef.current = performance.now() - currentSec * 1000;
          }}
        >
          <Text style={styles.btnTxt}>{running ? 'pause' : 'play'}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={async () => {
            await unlockSfx();
            playSfx('mission_success');
          }}
        >
          <Text style={styles.btnTxt}>sfx success</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={async () => {
            await unlockSfx();
            playSfx('squat_count');
          }}
        >
          <Text style={styles.btnTxt}>sfx pop</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={async () => {
            await unlockSfx();
            playSfx('mission_fail');
          }}
        >
          <Text style={styles.btnTxt}>sfx fail</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => {
            tStartRef.current = performance.now();
          }}
        >
          <Text style={styles.btnTxt}>restart</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>
        합본: intro 4 + squat-master {squatMaster.layers?.length ?? 0} + karaoke 1 + outro 5 = {layerCount} 레이어 · 단일 캔버스 · 비트 동기화
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0a0a14', alignItems: 'center', paddingTop: 12 },
  title:      { color: '#FFD23F', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  meta:       { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12, fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : undefined },
  canvasHost: { width: PREVIEW_W, height: PREVIEW_H, alignItems: 'center', justifyContent: 'center' },
  controls:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16, paddingHorizontal: 16 },
  btn:        { backgroundColor: 'rgba(255,210,63,0.15)', borderColor: '#FFD23F', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  btnTxt:     { color: '#FFD23F', fontWeight: '700', fontSize: 13 },
  note:       { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 12, paddingHorizontal: 24, textAlign: 'center' },
});
