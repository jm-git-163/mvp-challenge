/**
 * JudgementBurst.tsx — 판정 시 전체화면 팝업 이벤트
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { JudgementTag } from '../../types/session';

interface Props {
  tag: JudgementTag | null;
  combo: number;
  visible: boolean;
}

const BURST_CONFIG: Record<
  JudgementTag,
  { label: string; color: string; bg: string; emoji: string }
> = {
  perfect: {
    label: '🌟 PERFECT!',
    color: '#4caf50',
    bg: 'rgba(76,175,80,0.18)',
    emoji: '🌟⭐✨',
  },
  good: {
    label: '👍 GOOD!',
    color: '#ffc107',
    bg: 'rgba(255,193,7,0.15)',
    emoji: '👍💪😊',
  },
  fail: {
    label: '💨 아쉬워~',
    color: '#ff6b6b',
    bg: 'rgba(255,107,107,0.15)',
    emoji: '💨😅🔄',
  },
};

export default function JudgementBurst({ tag, combo, visible }: Props) {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !tag) return;
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(1);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 20,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, tag, scaleAnim, opacityAnim]);

  if (!tag || !visible) return null;
  const cfg = BURST_CONFIG[tag];

  return (
    <Animated.View
      style={[styles.overlay, { backgroundColor: cfg.bg, opacity: opacityAnim }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.burst, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.emojiRow}>{cfg.emoji}</Text>
        <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
        {combo >= 3 && (
          <Text style={styles.comboText}>🔥 {combo} COMBO!</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  burst: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 6,
  },
  emojiRow: {
    fontSize: 40,
    letterSpacing: 4,
  },
  label: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  comboText: {
    color: '#ff6b35',
    fontSize: 20,
    fontWeight: '800',
  },
});
