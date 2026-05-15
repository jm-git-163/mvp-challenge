/**
 * VirtualBackgroundFrame.tsx
 * 카메라 뒤/주변에 가상 배경 프레임을 렌더링 (실제 크로마키 아님)
 * wrapper uses flex:1 — no width/height props needed
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VirtualBackground } from '../../types/template';

interface Props {
  bg?: VirtualBackground | null;
  children: React.ReactNode;
}

// 테마별 배경 스타일
export const VIRTUAL_BG_PRESETS: Record<string, VirtualBackground> = {
  daily: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    frameColor: '#9b59b6',
  },
  news: {
    type: 'pattern',
    css: 'linear-gradient(180deg, #0a1628 0%, #1a2e4a 50%, #0d1f35 100%)',
    overlayTop: '📺 LIVE NEWS',
    overlayBottom: '🔴 속보 · 오늘의 뉴스 · BREAKING NEWS · 최신 뉴스 · ',
    frameColor: '#1565c0',
  },
  english: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    overlayTop: '🇺🇸 English Challenge',
    frameColor: '#2196f3',
  },
  fairy_tale: {
    type: 'pattern',
    css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    overlayTop: '📖 동화책',
    frameColor: '#ff9800',
  },
  travel: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #0099f7 0%, #f11712 100%)',
    overlayTop: '✈️ TRAVEL',
    frameColor: '#00bcd4',
  },
  product: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    frameColor: '#e91e63',
  },
  kpop: {
    type: 'pattern',
    css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    overlayTop: '🎤 K-POP CHALLENGE',
    frameColor: '#e94560',
  },
  food: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    overlayTop: '🍜 FOOD REVIEW',
    frameColor: '#ff5722',
  },
  motivation: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    overlayTop: '💪 MOTIVATION',
    frameColor: '#00bcd4',
  },
  kids: {
    type: 'gradient',
    css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    overlayTop: '🌈 동화 세계로!',
    frameColor: '#ff80ab',
  },
};

export default function VirtualBackgroundFrame({ bg, children }: Props) {
  if (!bg) {
    // No background — just render children in a flex:1 container
    return <View style={styles.wrapper}>{children}</View>;
  }

  const frameColor = bg.frameColor ?? '#333';

  return (
    <View style={styles.wrapper}>
      {/* 배경 레이어 (CSS gradient — web only) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            // @ts-ignore — web only style property
            background: bg.css,
            backgroundColor: '#1a1a2e', // fallback for native
          },
        ]}
      />

      {/* 상단 오버레이 */}
      {bg.overlayTop ? (
        <View style={[styles.topOverlay, { backgroundColor: frameColor + 'dd' }]}>
          <Text style={styles.overlayTopText}>{bg.overlayTop}</Text>
        </View>
      ) : null}

      {/* 카메라 콘텐츠 — flex:1, no margin/border that shrinks it */}
      <View style={styles.cameraContent}>
        {children}
      </View>

      {/* 하단 뉴스 티커 */}
      {bg.overlayBottom ? (
        <View style={[styles.bottomTicker, { backgroundColor: frameColor }]}>
          <Text style={styles.tickerText} numberOfLines={1}>
            {bg.overlayBottom.repeat(3)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  overlayTopText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cameraContent: {
    flex: 1,
  },
  bottomTicker: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tickerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
