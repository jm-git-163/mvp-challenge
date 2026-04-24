/**
 * JudgementFeedback.tsx — 상단 판정 표시 + 콤보 카운터
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { JudgementTag } from '../../types/session';
import type { Mission } from '../../types/template';

const TAG_CONFIG: Record<JudgementTag, { label: string; emoji: string; color: string }> = {
  perfect: { label: 'PERFECT', emoji: '⭐', color: '#4caf50' },
  good:    { label: 'GOOD',    emoji: '👍', color: '#ffc107' },
  fail:    { label: 'MISS',    emoji: '💨', color: '#ff6b6b' },
};

const TYPE_BADGE: Record<string, { icon: string; label: string }> = {
  gesture:    { icon: '🤲', label: '제스처' },
  timing:     { icon: '⏱', label: '타이밍' },
  expression: { icon: '😊', label: '표정' },
  pose:       { icon: '🕺', label: '포즈' },
};

interface Props {
  score: number;
  tag: JudgementTag;
  currentMission: Mission | null;
  elapsed: number;
}

export default function JudgementFeedback({ score, tag, currentMission, elapsed }: Props) {
  const { label, emoji, color } = TAG_CONFIG[tag];
  const barAnim = useRef(new Animated.Value(score)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [combo, setCombo] = useState(0);
  const prevTagRef = useRef<JudgementTag>('fail');
  const comboRef = useRef(0);

  useEffect(() => {
    Animated.spring(barAnim, { toValue: score, speed: 24, bounciness: 0, useNativeDriver: false }).start();
  }, [score]);

  useEffect(() => {
    if (tag !== prevTagRef.current) {
      if (tag === 'perfect' || tag === 'good') {
        comboRef.current += 1;
      } else {
        comboRef.current = 0;
      }
      setCombo(comboRef.current);
      prevTagRef.current = tag;
      // 판정 변경 시 펄스 애니메이션
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 120,useNativeDriver: true }),
      ]).start();
    }
  }, [tag]);

  const barWidth = barAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] });
  const typeBadge = currentMission ? TYPE_BADGE[currentMission.type] : null;

  return (
    <View style={styles.container}>
      {/* 상단: 미션 타입 뱃지 + 콤보 */}
      <View style={styles.topRow}>
        {typeBadge && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeIcon}>{typeBadge.icon}</Text>
            <Text style={styles.typeBadgeLabel}>{typeBadge.label}</Text>
          </View>
        )}
        {combo >= 3 && (
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>🔥 {combo} COMBO!</Text>
          </View>
        )}
      </View>

      {/* 게이지 바 */}
      <View style={styles.gaugeTrack}>
        <Animated.View style={[styles.gaugeBar, { width: barWidth, backgroundColor: color }]} />
        <View style={[styles.marker, { left: '82%' }]} />
        <View style={[styles.marker, { left: '58%' }]} />
      </View>

      {/* 판정 텍스트 */}
      <View style={styles.tagRow}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={[styles.tagText, { color }]}>
            {emoji} {label}
          </Text>
        </Animated.View>
        <Text style={styles.scoreText}>{Math.round(score * 100)}점</Text>
      </View>

      {/* 미션 가이드 */}
      {currentMission && (
        <View style={styles.guideRow}>
          {currentMission.guide_emoji && (
            <Text style={styles.guideEmoji}>{currentMission.guide_emoji}</Text>
          )}
          <Text style={styles.guideText} numberOfLines={1}>
            {currentMission.guide_text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4, gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  typeBadgeIcon: { fontSize: 11 },
  typeBadgeLabel: { color: '#ccc', fontSize: 11, fontWeight: '600' },
  comboBadge: {
    backgroundColor: '#ff6b35', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  comboText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  gaugeTrack: {
    height: 8, backgroundColor: '#333', borderRadius: 4,
    overflow: 'visible', position: 'relative',
  },
  gaugeBar: { height: '100%', borderRadius: 4 },
  marker: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: '#fff', opacity: 0.5 },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagText: { fontSize: 19, fontWeight: '900', letterSpacing: 1 },
  scoreText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  guideEmoji: { fontSize: 16 },
  guideText: { color: '#ddd', fontSize: 14, fontWeight: '600', flex: 1 },
});
