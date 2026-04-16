/**
 * TimingBar.tsx
 *
 * 하단 타이밍 바 + 자막 표시 (화면 하단 20%)
 *  - 미션 진행 도트 (상단)
 *  - 현재 자막 (subtitle_timeline 기반, 더 크게)
 *  - 미션 구간 타임라인 바
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
      seq:       m.seq,
      left:      (m.start_ms / totalMs) * 100,
      width:     ((m.end_ms - m.start_ms) / totalMs) * 100,
      active:    elapsedMs >= m.start_ms && elapsedMs < m.end_ms,
      completed: elapsedMs >= m.end_ms,
      emoji:     m.guide_emoji,
    }));
  }, [template.missions, totalMs, elapsedMs]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const totalSec   = template.duration_sec;
  const remaining  = Math.max(0, totalSec - elapsedSec);

  // 자막 스타일에 따른 색상
  const subtitleStyle = useMemo(() => {
    const style = currentSubtitle?.style ?? 'normal';
    if (style === 'highlight') return styles.subtitleHighlight;
    if (style === 'bold') return styles.subtitleBold;
    return styles.subtitle;
  }, [currentSubtitle]);

  return (
    <View style={styles.container}>
      {/* 미션 진행 도트 */}
      <View style={styles.dotsRow}>
        {missionMarkers.map((m) => (
          <View
            key={m.seq}
            style={[
              styles.missionDot,
              m.completed && styles.missionDotCompleted,
              m.active && styles.missionDotActive,
            ]}
          >
            {m.emoji ? (
              <Text style={styles.missionDotEmoji}>{m.emoji}</Text>
            ) : (
              <Text style={styles.missionDotNum}>{m.seq}</Text>
            )}
          </View>
        ))}
      </View>

      {/* 자막 — 크고 눈에 잘 띄게 */}
      <View style={styles.subtitleArea}>
        {currentSubtitle ? (
          <Text style={subtitleStyle} numberOfLines={2}>
            {currentSubtitle.text}
          </Text>
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
              m.active && styles.missionSegmentActive,
              m.completed && styles.missionSegmentCompleted,
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
    gap: 5,
  },
  // ── 미션 도트 ──
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  missionDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a3e',
    borderWidth: 1.5,
    borderColor: '#4a4a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionDotActive: {
    backgroundColor: '#e94560',
    borderColor: '#ff8a9b',
    transform: [{ scale: 1.18 }],
  },
  missionDotCompleted: {
    backgroundColor: '#1a3a20',
    borderColor: '#4caf50',
  },
  missionDotEmoji: {
    fontSize: 14,
  },
  missionDotNum: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── 자막 ──
  subtitleArea: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  subtitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitleBold: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitleHighlight: {
    color: '#ffd700',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  // ── 타임라인 ──
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
  missionSegmentActive: {
    backgroundColor: '#3a1e3a',
    borderRightColor: '#e94560',
  },
  missionSegmentCompleted: {
    backgroundColor: '#1a3a20',
    borderRightColor: '#4caf50',
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
