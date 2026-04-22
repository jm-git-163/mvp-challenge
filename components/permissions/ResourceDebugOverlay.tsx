/**
 * ResourceDebugOverlay.tsx — Team RELIABILITY (2026-04-22)
 *
 * `?debug=1` 쿼리스트링 또는 localStorage motiq_debug=1 일 때만 표시.
 * 현재 앱에 살아있는 MediaPipe / AudioContext / MediaStream / MediaRecorder /
 * SpeechRecognizer 개수를 500ms 주기로 갱신해 DOM 뱃지로 보여준다.
 *
 * 2회 연속 챌린지 후 이 숫자들이 모두 0 으로 돌아오지 않으면 누수.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { resourceTracker, type ResourceSnapshot } from '../../utils/resourceTracker';

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (Platform.OS !== 'web') return false;
  try {
    const q = window.location.search ?? '';
    if (/[?&]debug=1\b/.test(q)) {
      try { window.localStorage.setItem('motiq_debug', '1'); } catch {}
      return true;
    }
    try {
      if (window.localStorage.getItem('motiq_debug') === '1') return true;
    } catch {}
  } catch {}
  return false;
}

export default function ResourceDebugOverlay() {
  const [snap, setSnap] = useState<ResourceSnapshot>(resourceTracker.snapshot());
  const [enabled] = useState<boolean>(() => isDebugEnabled());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setSnap(resourceTracker.snapshot());
    }, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const anyNonZero = Object.values(snap).some((v) => v > 0);

  return (
    <View pointerEvents="none" style={s.wrap}>
      <Text style={[s.text, anyNonZero ? s.textActive : s.textIdle]}>
        RES ms:{snap.mediaStream} ac:{snap.audioCtx} pL:{snap.poseLandmarker} fL:{snap.faceLandmarker}
        {' '}gR:{snap.gestureRecognizer} mR:{snap.mediaRecorder} sR:{snap.speechRecognizer} raf:{snap.rafLoop}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute' as any,
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 99999,
  } as any,
  text: {
    fontSize: 10,
    fontFamily: 'monospace' as any,
    letterSpacing: 0.3,
  } as any,
  textActive: { color: '#ffcc00' } as any,
  textIdle:   { color: '#7fffd4' } as any,
});
