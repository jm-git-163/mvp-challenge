/**
 * TimingBar.tsx
 *
 * 하단 타이밍 바 + 자막 표시 (화면 하단 20%)
 *  - 미션 시퀀스 진행 바
 *  - 현재 자막 (subtitle_timeline 기반)
 *  - Phase 2에서 비트 동기화 추가 예정
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import type { Template } from '../../types/template';

interface Props {
  template:    Template;
  elapsedMs:   number;
}

export default function TimingBar({ template, elapsedMs }: Props) {
  const totalMs = template.duration_sec * 1000;
  const progress = Math.min(elapsedMs / totalMs, 1);

  // 현재 자막
  const currentSubtitle = useMemo(() => {
    return template.subtitle_timeline.find(
      (cue) => elapsedMs >= cue.start_ms && elapsedMs < cue.end_ms
    );
  }, [template.subtitle_timeline, elapsedMs]);

  // 미션 구간 마커 위치 계산
  const missionMarkers = useMemo(() => {
    return template.missions.map((m) => ({
      seq:   m.seq,
      left:  (m.start_ms / totalMs) * 100,
      width: ((m.end_ms - m.start_ms) / totalMs) * 100,
    }));
  }, [template.missions, totalMs]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const totalSec   = template.duration_sec;
  const remaining  = Math.max(0, totalSec - elapsedSec);

  return (
    <View style={styles.container}>
      {/* 자막 */}
      <View style={styles.subtitleArea}>
        {currentSubtitle ? (
          <Text style={styles.subtitle}>{currentSubtitle.text}</Text>
        ) : null}
      </View>

      {/* 타임라인 바 */}
      <View style={styles.timelineWrapper}>
        {/* 미션 구간 배경 */}
        {missionMarkers.map((m) => (
          <View
            key={m.seq}
            style={[
              styles.missionSegment,
              { left: `${m.left}%`, width: `${m.width}%` },
            ]}
          />
        ))}

        {/* 진행 오버레이 */}
        <View
          style={[
            styles.progressBar,
            { width: `${progress * 100}%` },
          ]}
        />

        {/* 현재 위치 커서 */}
        <View style={[styles.cursor, { left: `${progress * 100}%` }]} />
      </View>

      {/* 시간 표시 */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
          {String(elapsedSec % 60).padStart(2, '0')}
        </Text>
        <Text style={styles.bpmText}>BPM {template.bpm}</Text>
        <Text style={styles.timeText}>
          -{String(Math.floor(remaining / 60)).padStart(2, '0')}:
          {String(remaining % 60).padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  subtitleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timelineWrapper: {
    height: 12,
    backgroundColor: '#2a2a3e',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  missionSegment: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: '#1e3a5f',
    borderRightWidth: 1,
    borderRightColor: '#4a4a6a',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#e94560',
    opacity: 0.8,
  },
  cursor: {
    position: 'absolute',
    top: -2,
    width: 3,
    height: 16,
    backgroundColor: '#fff',
    marginLeft: -1.5,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: '#aaa',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  bpmText: {
    color: '#e94560',
    fontSize: 11,
    fontWeight: '700',
  },
});
