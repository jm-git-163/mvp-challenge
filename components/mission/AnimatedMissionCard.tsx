/**
 * AnimatedMissionCard.tsx
 * 카메라 화면 하단에 표시되는 미션 카드 (스켈레톤 오버레이 대체)
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import type { Mission } from '../../types/template';
import type { JudgementTag } from '../../types/session';

const { width: SW } = Dimensions.get('window');

interface Props {
  mission: Mission | null;
  elapsedMs: number;
  score: number;
  tag: JudgementTag;
}

type AnimStyleFn = (anim: Animated.Value) => object;

const ANIM_STYLES: Record<string, AnimStyleFn> = {
  bounce: (a) => ({
    transform: [
      {
        translateY: a.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
    ],
  }),
  pulse: (a) => ({
    transform: [
      {
        scale: a.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.15],
        }),
      },
    ],
  }),
  shake: (a) => ({
    transform: [
      {
        translateX: a.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, 6, -6, 6, 0],
        }),
      },
    ],
  }),
  spin: (a) => ({
    transform: [
      {
        rotate: a.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  }),
  float: (a) => ({
    transform: [
      {
        translateY: a.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  }),
};

export default function AnimatedMissionCard({ mission, elapsedMs, score, tag }: Props) {
  const animVal = useRef(new Animated.Value(0)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const prevMissionSeq = useRef<number | null>(null);

  // 미션 변경 시 fade in
  useEffect(() => {
    if (!mission) return;
    if (mission.seq !== prevMissionSeq.current) {
      prevMissionSeq.current = mission.seq;
      fadeIn.setValue(0);
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [mission?.seq, fadeIn]);

  // 이모지 반복 애니메이션
  useEffect(() => {
    if (!mission) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animVal, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(animVal, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mission?.seq, animVal]);

  if (!mission) return null;

  const animStyleFn = ANIM_STYLES[mission.anim_type ?? 'bounce'] ?? ANIM_STYLES.bounce;
  const animStyle = animStyleFn(animVal);

  // 미션 진행 시간 (0~1)
  const missionDuration = mission.end_ms - mission.start_ms;
  const missionElapsed = Math.max(0, elapsedMs - mission.start_ms);
  const progress = Math.min(1, missionElapsed / missionDuration);
  const remainSec = Math.max(0, Math.ceil((mission.end_ms - elapsedMs) / 1000));

  // 판정 색상
  const tagColor =
    tag === 'perfect' ? '#4caf50' : tag === 'good' ? '#ffc107' : '#ff6b6b';

  // Timer fill height as a numeric percentage (0~50 pixels in the 50px bar)
  const timerFillHeightNum = Math.round((1 - progress) * 50);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      <View style={[styles.card, { borderColor: tagColor }]}>
        {/* 왼쪽: 이모지 애니메이션 */}
        <Animated.Text style={[styles.emoji, animStyle]}>
          {mission.guide_emoji ?? mission.gesture_emoji ?? '🎯'}
        </Animated.Text>

        {/* 중앙: 미션 텍스트 */}
        <View style={styles.textArea}>
          {mission.type === 'voice_read' && mission.read_text ? (
            // FIX-SCRIPT-POOL (2026-04-23): 배열이면 첫 엔트리 표시 (미션 카드 프리뷰 용도).
            //   실제 런타임 선택된 대본은 useJudgement.resolvedReadText 로 프롬프터에 표시.
            <Text style={styles.readText} numberOfLines={3}>
              {Array.isArray(mission.read_text) ? (mission.read_text[0] ?? '') : mission.read_text}
            </Text>
          ) : (
            <Text style={styles.guideText}>{mission.guide_text}</Text>
          )}
          <Text style={[styles.typeLabel, { color: tagColor }]}>
            {mission.type === 'voice_read'
              ? '🎤 따라 읽기'
              : mission.type === 'gesture'
              ? '🤲 제스처'
              : mission.type === 'expression'
              ? '😊 표정'
              : '⏱ 타이밍'}
          </Text>
        </View>

        {/* 오른쪽: 남은 시간 */}
        <View style={styles.timerArea}>
          <Text style={[styles.timerText, { color: remainSec <= 2 ? '#ff6b6b' : '#fff' }]}>
            {remainSec}
          </Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerFill,
                {
                  height: timerFillHeightNum,
                  backgroundColor: tagColor,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* 스코어 바 */}
      <View style={styles.scoreBarBg}>
        <View
          style={[
            styles.scoreBarFill,
            { width: `${Math.round(score * 100)}%` as unknown as number, backgroundColor: tagColor },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    zIndex: 10,
    gap: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    maxWidth: SW,
  },
  emoji: {
    fontSize: 36,
    width: 44,
    textAlign: 'center',
  },
  textArea: {
    flex: 1,
    gap: 3,
  },
  guideText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  readText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  timerArea: {
    alignItems: 'center',
    gap: 2,
  },
  timerText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    width: 28,
    textAlign: 'center',
  },
  timerBar: {
    width: 6,
    height: 50,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  timerFill: {
    width: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 3,
  },
  scoreBarBg: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
