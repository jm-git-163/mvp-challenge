/**
 * JudgementFeedback.tsx
 *
 * 상단 판정 표시 영역 (화면 상단 20%)
 *  - 점수 게이지 바
 *  - Perfect / Good / Fail 텍스트 + 색상
 *  - 현재 미션 가이드 텍스트
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import type { JudgementTag } from '../../types/session';
import type { Mission } from '../../types/template';

const TAG_CONFIG: Record<JudgementTag, { label: string; color: string }> = {
  perfect: { label: 'PERFECT ✦', color: '#4caf50' },
  good:    { label: 'GOOD',      color: '#ffc107' },
  fail:    { label: 'MISS',      color: '#ff6b6b' },
};

interface Props {
  score:          number;        // 0~1
  tag:            JudgementTag;
  currentMission: Mission | null;
  elapsed:        number;        // ms
}

export default function JudgementFeedback({
  score,
  tag,
  currentMission,
  elapsed,
}: Props) {
  const { label, color } = TAG_CONFIG[tag];
  const barAnim = useRef(new Animated.Value(score)).current;

  // 점수 바 애니메이션
  useEffect(() => {
    Animated.spring(barAnim, {
      toValue: score,
      speed: 20,
      bounciness: 0,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* 점수 게이지 바 */}
      <View style={styles.gaugeTrack}>
        <Animated.View
          style={[styles.gaugeBar, { width: barWidth, backgroundColor: color }]}
        />
        {/* 판정선 마커 */}
        <View style={[styles.marker, { left: '85%' }]} />
        <View style={[styles.marker, { left: '65%' }]} />
      </View>

      {/* 판정 텍스트 + 점수 */}
      <View style={styles.tagRow}>
        <Text style={[styles.tagText, { color }]}>{label}</Text>
        <Text style={styles.scoreText}>{Math.round(score * 100)}점</Text>
      </View>

      {/* 미션 가이드 */}
      {currentMission && (
        <Text style={styles.guideText} numberOfLines={1}>
          {currentMission.guide_text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  gaugeTrack: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  gaugeBar: {
    height: '100%',
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 16,
    backgroundColor: '#fff',
    opacity: 0.6,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  scoreText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  guideText: {
    color: '#ddd',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
