/**
 * TemplateCard.tsx — Gen-Z 리브랜드(2026-04-23)
 * Rounded-2xl, 그라데이션 보더, big emoji 배지(wiggle), 별 점, vivid chips.
 * Korean women 18-30 / TikTok·Stories vibe.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import type { Template } from '../../types/template';
import { TEMPLATE_THUMBNAILS } from '../../services/templateThumbnails';
import { GZ, GZGradient, GZFont, GZRadius, GZShadow } from '../../constants/genzPalette';

const GENRE_LABEL: Record<Template['genre'], string> = {
  kpop:      'K-POP',
  hiphop:    '힙합',
  fitness:   '피트니스',
  challenge: '챌린지',
  promotion: '프로모션',
  travel:    '여행',
  daily:     '일상',
  news:      '뉴스',
  english:   '영어',
  kids:      '동화/키즈',
};

// 장르별 컬러 — Gen-Z 비비드
const GENRE_COLOR: Record<Template['genre'], string> = {
  kpop:      GZ.pink,
  hiphop:    GZ.violet,
  fitness:   GZ.lime,
  challenge: GZ.coral,
  promotion: GZ.pinkSoft,
  travel:    GZ.cyan,
  daily:     GZ.lilac,
  news:      GZ.cyanSoft,
  english:   GZ.info,
  kids:      GZ.yellow,
};

const CAMERA_MODE_LABEL: Record<string, string> = {
  selfie: '📱 셀카',
  normal: '📷 일반',
};

const MISSION_TYPE_ICONS: Record<string, string> = {
  gesture:    '🤲',
  voice_read: '🎤',
  timing:     '⏱',
  expression: '😊',
};

interface Props {
  template: Template;
  onPress: (template: Template) => void;
}

export function TemplateCard({ template, onPress }: Props) {
  const [pressed, setPressed] = useState(false);
  const missionTypes = [...new Set(template.missions.map((m) => m.type))];
  const pixabayThumb = TEMPLATE_THUMBNAILS[template.id]?.url;
  const thumbUri = pixabayThumb || template.thumbnail_url;
  const genreColor = GENRE_COLOR[template.genre] ?? GZ.pink;

  // Star strip — difficulty 1~3
  const stars = '★★★'.slice(0, template.difficulty) + '☆☆☆'.slice(0, 3 - template.difficulty);

  return (
    <Pressable
      onPress={() => onPress(template)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.card, pressed && styles.cardPressed]}
    >
      {/* 그라데이션 보더 — pseudo border via web background */}
      <View style={styles.gradBorder} pointerEvents="none" />

      {/* Thumbnail block — left */}
      <View style={styles.thumbWrap}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderBg, { backgroundColor: genreColor + '33' }]}>
            <Text style={styles.placeholderEmoji}>{template.theme_emoji}</Text>
            <Text style={styles.cameraHint}>{CAMERA_MODE_LABEL[template.camera_mode] ?? ''}</Text>
          </View>
        )}
        {/* 큰 이모지 배지 (wiggle) */}
        <View style={[styles.emojiBadge, { backgroundColor: genreColor }]}>
          <Text style={styles.emojiBadgeText}>{template.theme_emoji}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{template.name}</Text>

        {template.scene ? (
          <Text style={styles.scene} numberOfLines={1}>{template.scene}</Text>
        ) : null}

        <View style={styles.meta}>
          <View style={[styles.chip, { backgroundColor: genreColor }]}>
            <Text style={styles.chipText}>{GENRE_LABEL[template.genre] ?? template.genre}</Text>
          </View>
          <Text style={styles.stars}>{stars}</Text>
          <Text style={styles.duration}>{template.duration_sec}초</Text>
        </View>

        <View style={styles.missionRow}>
          {missionTypes.map((t) => (
            <View key={t} style={styles.missionPill}>
              <Text style={styles.missionIcon}>{MISSION_TYPE_ICONS[t] ?? '🎯'}</Text>
            </View>
          ))}
          <Text style={styles.bpm}>BPM {template.bpm}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: GZ.surfaceCard,
    borderRadius: GZRadius.card,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GZ.border,
    ...Platform.select({
      web: {
        // @ts-ignore web
        backdropFilter: 'blur(14px) saturate(140%)',
        // @ts-ignore web
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        // @ts-ignore web
        boxShadow: GZShadow.card,
        // @ts-ignore web
        transition: 'transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease',
        // @ts-ignore web
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  cardPressed: Platform.select({
    web: {
      // @ts-ignore web
      transform: 'scale(0.98)',
      // @ts-ignore web
      boxShadow: GZShadow.glowPink,
    } as any,
    default: { opacity: 0.85 },
  }) as any,
  gradBorder: Platform.select({
    web: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: GZRadius.card,
      padding: 1,
      // @ts-ignore web — gradient border via background + mask trick approximation
      background: GZGradient.glow,
      opacity: 0.55,
      // @ts-ignore web
      WebkitMask:
        'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
      // @ts-ignore web
      WebkitMaskComposite: 'xor',
      // @ts-ignore web
      maskComposite: 'exclude',
      pointerEvents: 'none',
    } as any,
    default: { width: 0, height: 0 },
  }) as any,
  thumbWrap: {
    width: 110,
    height: 130,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderBg: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderEmoji: {
    fontSize: 38,
  },
  cameraHint: {
    color: GZ.ink,
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.85,
    fontFamily: GZFont.sans,
  },
  emojiBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    ...Platform.select({
      web: {
        // @ts-ignore web
        boxShadow: '0 6px 18px -6px rgba(0,0,0,0.6)',
        // @ts-ignore web
        animation: 'gzWiggle 2.6s ease-in-out infinite',
      },
      default: {},
    }),
  },
  emojiBadgeText: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    gap: 6,
  },
  name: {
    color: GZ.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: GZFont.sans,
  },
  scene: {
    color: GZ.inkMuted,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: GZFont.sans,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    color: GZ.inkOnLight,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontFamily: GZFont.sans,
  },
  stars: {
    color: GZ.highlight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  duration: {
    color: GZ.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: GZFont.sans,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missionPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GZ.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GZ.border,
  },
  missionIcon: {
    fontSize: 13,
  },
  bpm: {
    color: GZ.cyan,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.4,
    fontFamily: GZFont.mono,
  },
});
