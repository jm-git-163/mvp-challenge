/**
 * VoiceDebugOverlay.tsx — Team STT (2026-04-22)
 *
 * `?debug=1` 쿼리 파라미터가 있을 때만 화면 중앙 좌측에 플로팅으로 뜨는
 * 음성 인식 저수준 진단 패널. RecordingCamera 좌상단 canvas overlay /
 * RecognitionStatusPanel 과 별개로, webkit SpeechRecognition 내부 상태를
 * 추가 노출한다:
 *
 *  - 마지막 이벤트 (lastEvent) — 이미 speechBadge 에 있지만 여기도 크게 표시.
 *  - starts / ends / results 누적 카운터.
 *  - retryCount — 자동 재시도(FIX-Z20) 소진 여부.
 *  - 마지막 onresult 수신 이후 경과 시간 — "진짜 STT 스톨" 여부 판단 핵심.
 *  - 마이크 트랙 readyState — "마이크는 잡혔는데 ASR 이 죽은" 케이스 구분.
 *
 * 서버 전송 없음. 녹화 캔버스가 아닌 DOM 오버레이 → 녹화본엔 안 박힘.
 * CLAUDE.md §3.12 "촬영 중 팝업·모달 금지" 위배 아님 (pointerEvents=none).
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getRecognizer as getGlobalSpeechRecognizer } from '../../utils/sttFactory';

export interface VoiceDebugOverlayProps {
  /** `?debug=1` 또는 localStorage motiq_debug=1 일 때만 true. 그 외에는 오버레이 렌더 생략. */
  enabled: boolean;
}

interface VoiceDiag {
  listening: boolean;
  error: string | null;
  transcript: string;
  starts: number;
  ends: number;
  results: number;
  retryCount: number;
  msSinceLastResult: number | null;
  lastEvent: string;
  micReadyState: 'live' | 'ended' | 'none';
}

function readMicReadyState(): VoiceDiag['micReadyState'] {
  if (typeof window === 'undefined') return 'none';
  const w = window as any;
  const streams = [w.__cameraStream, w.__permissionStream, w.__micStream].filter(Boolean) as MediaStream[];
  for (const s of streams) {
    const t = s.getAudioTracks?.()[0];
    if (t) return t.readyState === 'live' ? 'live' : 'ended';
  }
  return 'none';
}

export default function VoiceDebugOverlay({ enabled }: VoiceDebugOverlayProps): React.ReactElement | null {
  const [d, setD] = useState<VoiceDiag | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      try {
        const rec: any = getGlobalSpeechRecognizer();
        const base = rec.getDiagnostic?.() ?? {
          listening: false, error: null, transcript: '',
          starts: 0, ends: 0, results: 0, retryCount: 0,
          lastResultAt: null, msSinceLastResult: null,
        };
        const ext = rec.getDiagnostics?.() ?? { lastEvent: '(no getDiagnostics)' };
        setD({
          listening: base.listening,
          error: base.error,
          transcript: base.transcript || '',
          starts: base.starts,
          ends: base.ends,
          results: base.results,
          retryCount: base.retryCount ?? 0,
          msSinceLastResult: base.msSinceLastResult ?? null,
          lastEvent: ext.lastEvent ?? '',
          micReadyState: readMicReadyState(),
        });
      } catch { /* silent */ }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled || !d) return null;

  const stalled = d.listening && d.msSinceLastResult !== null && d.msSinceLastResult > 10_000;
  const bg = stalled ? 'rgba(220,38,38,0.95)'
           : d.error ? 'rgba(239,68,68,0.90)'
           : d.listening ? 'rgba(15,118,110,0.90)'
           : 'rgba(51,65,85,0.90)';
  const since = d.msSinceLastResult === null
    ? '—'
    : d.msSinceLastResult < 1000 ? `${d.msSinceLastResult.toFixed(0)}ms`
    : `${(d.msSinceLastResult / 1000).toFixed(1)}s`;
  const shown = d.transcript
    ? (d.transcript.length > 28 ? '…' + d.transcript.slice(-28) : d.transcript)
    : '(없음)';

  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 260, left: 12,
      backgroundColor: bg,
      borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
      zIndex: 9995, elevation: 17,
      minWidth: 240, maxWidth: 300,
    }}>
      <Text style={{ color:'#fff', fontSize:10, fontWeight:'700', opacity:0.85, letterSpacing:0.5 }}>
        VOICE · DEBUG
      </Text>
      <Text style={{ color:'#fff', fontSize:12, fontFamily:'monospace', marginTop:3 }}>
        {d.lastEvent}
      </Text>
      <Text style={{ color:'#fff', fontSize:11, fontFamily:'monospace', marginTop:2 }}>
        s/e/r: {d.starts}/{d.ends}/{d.results}  retry: {d.retryCount}
      </Text>
      <Text style={{ color:'#fff', fontSize:11, fontFamily:'monospace', marginTop:2 }}>
        since onresult: {since}{stalled ? ' ⚠ STALL' : ''}
      </Text>
      <Text style={{ color:'#fff', fontSize:11, fontFamily:'monospace', marginTop:2 }}>
        mic track: {d.micReadyState}
      </Text>
      <Text style={{ color:'#fff', fontSize:11, fontFamily:'monospace', marginTop:2 }}>
        txt: {shown}
      </Text>
      {d.error && (
        <Text style={{ color:'#fff', fontSize:11, fontFamily:'monospace', marginTop:2 }}>
          err: {d.error}
        </Text>
      )}
    </View>
  );
}
