/**
 * RecognitionStatusPanel.tsx — 인식 3종 온스크린 통합 진단 패널.
 *
 * 우하단 고정 반투명 패널. 실기기에서 콘솔 접근 없이
 *  1) 음성(VOICE), 2) 포즈(POSE), 3) 스쿼트(SQUAT) 상태를
 * 한 번에 확인하기 위함.
 *
 * zIndex 9996 — 기존 음성 뱃지(9998, FIX-Z10) / 스쿼트 뱃지(9997, FIX-Z19)
 * 보다 하위로 두어 중요 경고는 가리지 않는다.
 *
 * props 는 pure value 만 받음 (ReactNode 없음) → 렌더 예측 가능.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface VoiceState {
  status: 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';
  engine: string;          // 'webkit' / 'whisper'
  platform: string;        // 'android' / 'ios' / 'desktop' / 'mobile'
  lastEvent: string;       // 마지막 라이프사이클 이벤트
  transcript: string;      // 원문 — 30자만 잘라 표시
  err?: string | null;
}

export interface PoseState {
  status: 'idle' | 'loading' | 'ready-real' | 'ready-mock' | 'error' | string;
  landmarkCount: number;
  faceOk: boolean;
  bodyOk: boolean;         // squatLmOk 와 동일 — full-body 가시성
  kneeAngle: number;
}

export interface SquatState {
  count: number;
  target: number;
  phase: 'up' | 'down' | 'unknown';
  mode: 'full-body' | 'near-mode' | 'idle';
}

interface Props {
  voiceState: VoiceState;
  poseState: PoseState;
  squatState: SquatState;
}

function truncate(s: string, n: number): string {
  if (!s) return '(없음)';
  return s.length > n ? '…' + s.slice(-n) : s;
}

export function RecognitionStatusPanel({ voiceState, poseState, squatState }: Props): React.ReactElement {
  const voiceTxt = truncate(voiceState.transcript || '', 30);
  const voiceLabel =
    voiceState.status === 'listening' ? '듣는 중'
    : voiceState.status === 'processing' ? '처리 중'
    : voiceState.status === 'error' ? '오류'
    : voiceState.status === 'unsupported' ? '미지원'
    : '대기';

  const poseLabel =
    poseState.status === 'ready-real' ? '실제 감지'
    : poseState.status === 'ready-mock' ? 'MOCK'
    : poseState.status === 'loading' ? '로딩 중'
    : poseState.status === 'error' ? '오류'
    : '대기';

  const squatLabel =
    squatState.mode === 'full-body' ? '풀바디'
    : squatState.mode === 'near-mode' ? '근접'
    : '대기';

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* ── VOICE ────────────────────────────────────────────── */}
      <Text style={styles.headline}>🎤 VOICE: <Text style={styles.headlineVal}>{voiceLabel}</Text></Text>
      <Text style={styles.line}>{voiceState.engine}/{voiceState.platform}</Text>
      <Text style={styles.line}>last: {voiceState.lastEvent}</Text>
      <Text style={styles.line}>txt: {voiceTxt}</Text>
      {voiceState.err ? (
        <Text style={styles.err}>err: {voiceState.err}</Text>
      ) : null}

      <View style={styles.divider} />

      {/* ── POSE ─────────────────────────────────────────────── */}
      <Text style={styles.headline}>🏃 POSE: <Text style={styles.headlineVal}>{poseLabel}</Text></Text>
      <Text style={styles.line}>landmarks: {poseState.landmarkCount}</Text>
      <Text style={styles.line}>
        face{poseState.faceOk ? '✓' : '✗'} body{poseState.bodyOk ? '✓' : '✗'} knee:{Math.round(poseState.kneeAngle)}°
      </Text>

      <View style={styles.divider} />

      {/* ── SQUAT ────────────────────────────────────────────── */}
      <Text style={styles.headline}>🔢 SQUAT: <Text style={styles.headlineVal}>{squatState.count}/{squatState.target}</Text></Text>
      <Text style={styles.line}>phase: {squatState.phase}</Text>
      <Text style={styles.line}>gate: {squatLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 260,
    backgroundColor: 'rgba(15,18,30,0.92)',
    padding: 10,
    borderRadius: 12,
    zIndex: 9996,
    elevation: 16,
  },
  headline: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  headlineVal: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  line: {
    color: '#e2e8f0',
    fontSize: 11,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  err: {
    color: '#fca5a5',
    fontSize: 11,
    marginTop: 1,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginVertical: 6,
  },
});

export default RecognitionStatusPanel;
