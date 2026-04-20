/**
 * home/index.tsx — 챌린지 스튜디오 메인 홈
 * Premium TikTok / CapCut level redesign
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Pressable,
  useWindowDimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTemplates } from '../../../hooks/useTemplates';
import { useSessionStore } from '../../../store/sessionStore';
import { VIDEO_TEMPLATES, getTemplateByMissionId } from '../../../utils/videoTemplates';
import type { Template, MissionType } from '../../../types/template';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = [
  { label: '전체',    value: 'all',     emoji: '✨' },
  { label: 'K-POP',  value: 'kpop',    emoji: '🎤' },
  { label: '피트니스', value: 'fitness', emoji: '💪' },
  { label: '뉴스',    value: 'news',    emoji: '📺' },
  { label: '일상',    value: 'daily',   emoji: '📱' },
  { label: '여행',    value: 'travel',  emoji: '✈️' },
  { label: '동화',    value: 'kids',    emoji: '🌈' },
  { label: '힙합',    value: 'hiphop',  emoji: '🎧' },
  { label: '영어',    value: 'english', emoji: '🌍' },
];

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  kpop:      ['#e94560', '#c2185b'],
  fitness:   ['#14b8a6', '#0d9488'],
  news:      ['#1565c0', '#0d47a1'],
  daily:     ['#7c3aed', '#5b21b6'],
  travel:    ['#f59e0b', '#d97706'],
  kids:      ['#a855f7', '#ec4899'],
  hiphop:    ['#374151', '#111827'],
  english:   ['#2563eb', '#1e3a8a'],
  challenge: ['#ef4444', '#dc2626'],
  promotion: ['#9c27b0', '#6a1b9a'],
};

const MISSION_STYLES: Record<MissionType, { bg: string; text: string; label: string }> = {
  gesture:    { bg: 'rgba(124,58,237,0.12)', text: '#a78bfa', label: '🤲 제스처' },
  voice_read: { bg: 'rgba(236,72,153,0.12)', text: '#f472b6', label: '🎤 따라읽기' },
  timing:     { bg: 'rgba(14,165,233,0.12)', text: '#38bdf8', label: '⏱ 유지' },
  expression: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', label: '😊 표정' },
};

const DIFF_COLORS = ['', '#22c55e', '#f59e0b', '#ef4444'];
const DIFF_LABELS = ['', '입문', '보통', '어려움'];

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner() {
  const floatAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const orb1Anim   = useRef(new Animated.Value(0)).current;
  const orb2Anim   = useRef(new Animated.Value(0)).current;
  const shimAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(orb1Anim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, { toValue: 1, duration: 6500, useNativeDriver: true }),
        Animated.timing(orb2Anim, { toValue: 0, duration: 6500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(shimAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const FEATURE_PILLS = [
    '📹 AI 판정',
    '🎵 실시간 BGM',
    '🏆 랭킹',
    '📤 SNS 공유',
  ];

  return (
    <View style={hero.wrap}>
      {/* Dark outer base (app shell) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0f' }]} />

      {/* ── Claude "studio paper" surface ────────────────────────────── */}
      <View style={hero.paper}>
        {/* warm cream gradient */}
        <View style={[StyleSheet.absoluteFill, {
          // @ts-ignore web only — warm Claude.ai cream
          background: 'linear-gradient(155deg, #F7F3EB 0%, #F1EADB 45%, #EADFC8 100%)',
        }]} />

        {/* faint paper grain via radial */}
        <View style={[StyleSheet.absoluteFill, {
          // @ts-ignore web only
          background: 'radial-gradient(circle at 18% 15%, rgba(204,120,92,0.18), transparent 55%), radial-gradient(circle at 85% 85%, rgba(161,98,68,0.12), transparent 60%)',
        }]} />

        {/* soft inner border */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, hero.paperBorder]} />

        {/* amber orb (restrained, Claude-y) */}
        <Animated.View style={[hero.amberOrb, {
          opacity: orb1Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.38, 0.6, 0.38] }),
          transform: [{ translateX: orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 16] }) }],
        }]} />

        {/* Top row — small brand chip */}
        <View style={hero.topRow}>
          <View style={hero.brandChip}>
            <View style={hero.brandDot} />
            <Text style={hero.brandChipText}>CLAUDE · STUDIO</Text>
          </View>
          <View style={hero.aiBadge}>
            <Text style={hero.aiBadgeText}>beta</Text>
          </View>
        </View>

        {/* Main content */}
        <View style={hero.inner}>
          <Animated.View style={[hero.emojiWrap, { transform: [{ translateY: floatAnim }] }]}>
            <View style={hero.emojiPlate}>
              <Text style={hero.emoji}>🎬</Text>
            </View>
          </Animated.View>

          <Text style={hero.eyebrow}>AI CHALLENGE STUDIO</Text>
          <Text style={hero.title}>챌린지 스튜디오</Text>
          <Text style={hero.sub}>
            미션 완수 <Text style={hero.subDot}>·</Text> AI 판정 <Text style={hero.subDot}>·</Text> 영상 자동 완성
          </Text>

          {/* Feature chips — Claude minimal line style */}
          <View style={hero.pills}>
            {FEATURE_PILLS.map((pill) => (
              <View key={pill} style={hero.pill}>
                <Text style={hero.pillText}>{pill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom paper edge */}
        <View style={hero.paperEdge} />
      </View>
    </View>
  );
}

const hero = StyleSheet.create({
  wrap: {
    height: 280,
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: '#0a0a0f',
  },
  paper: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    // @ts-ignore web — Claude paper shadow
    boxShadow: '0 22px 48px -18px rgba(161,98,68,0.45), 0 2px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
  },
  paperBorder: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(161,98,68,0.22)',
  },
  amberOrb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#CC785C',
    top: -80,
    right: -60,
    // @ts-ignore web
    filter: 'blur(60px)',
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(161,98,68,0.25)',
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CC785C',
    // @ts-ignore web
    boxShadow: '0 0 8px rgba(204,120,92,0.9)',
  },
  brandChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#5C3A2E',
  },
  aiBadge: {
    backgroundColor: '#1F1B16',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiBadgeText: {
    color: '#F7F3EB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    zIndex: 2,
    gap: 5,
  },
  emojiWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emojiPlate: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#1F1B16',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore web
    boxShadow: '0 10px 24px -8px rgba(161,98,68,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  emoji: {
    fontSize: 30,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.6,
    color: '#8A5A3E',
    marginTop: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F1B16',
    letterSpacing: -0.5,
    // @ts-ignore web — serif stack for Claude feel
    fontFamily: '"Tiempos Headline","Copernicus",Georgia,"Times New Roman",serif',
  },
  sub: {
    fontSize: 13,
    color: '#5C3A2E',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  subDot: {
    color: '#CC785C',
    fontWeight: '900',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(161,98,68,0.22)',
  },
  pillText: {
    color: '#3F2A1F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paperEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    // @ts-ignore web
    background: 'linear-gradient(to right, transparent, rgba(204,120,92,0.55), transparent)',
  },
});

// ─── Stats Pills ──────────────────────────────────────────────────────────────

function StatsPills({ total }: { total: number }) {
  const items = [
    { icon: '🎯', label: `챌린지 ${total}개` },
    { icon: '🤖', label: 'AI 판정' },
    { icon: '⚡', label: '실시간' },
  ];
  return (
    <View style={sp.wrap}>
      {items.map((item, i) => (
        <View key={i} style={sp.pill}>
          <Text style={sp.icon}>{item.icon}</Text>
          <Text style={sp.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    backgroundColor: '#0d0d14',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  icon:  { fontSize: 13 },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
});

// ─── Genre Filter ─────────────────────────────────────────────────────────────

interface GenreFilterProps {
  selected: string;
  onSelect: (v: string) => void;
}

function GenreFilter({ selected, onSelect }: GenreFilterProps) {
  const scaleAnims = useRef(
    GENRES.reduce<Record<string, Animated.Value>>((acc, g) => {
      acc[g.value] = new Animated.Value(1);
      return acc;
    }, {})
  ).current;

  const handlePress = (value: string) => {
    const anim = scaleAnims[value];
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.92, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.spring(anim, { toValue: 1.0,  useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
    onSelect(value);
  };

  return (
    <View style={gf.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={gf.scroll}
      >
        {GENRES.map((g) => {
          const isActive = selected === g.value;
          const colors = GENRE_GRADIENTS[g.value] ?? ['#7c3aed', '#5b21b6'];
          return (
            <Animated.View key={g.value} style={{ transform: [{ scale: scaleAnims[g.value] }] }}>
              <TouchableOpacity
                onPress={() => handlePress(g.value)}
                activeOpacity={0.85}
                style={[
                  gf.chip,
                  isActive
                    ? {
                        // @ts-ignore web
                        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                        backgroundColor: colors[0],
                        borderColor: 'rgba(255,255,255,0.25)',
                        // @ts-ignore web
                        boxShadow: `0 6px 18px ${colors[0]}66, 0 1px 0 rgba(255,255,255,0.2) inset`,
                      }
                    : {
                        backgroundColor: 'rgba(255,255,255,0.055)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        // @ts-ignore web
                        backdropFilter: 'blur(10px)',
                      },
                ]}
              >
                <Text style={gf.emoji}>{g.emoji}</Text>
                <Text style={[gf.label, isActive ? gf.labelActive : gf.labelInactive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const gf = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    minHeight: 40,
    // @ts-ignore web — hover glow
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  emoji:        { fontSize: 14 },
  label:        { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  labelActive:  { color: '#ffffff',
    // @ts-ignore web
    textShadow: '0 1px 4px rgba(0,0,0,0.35)',
  },
  labelInactive:{ color: 'rgba(255,255,255,0.55)' },
});

// ─── Featured Row ("지금 인기") ───────────────────────────────────────────────

function FeaturedRow({ templates, onSelect }: { templates: Template[]; onSelect: (t: Template) => void }) {
  if (!templates.length) return null;
  const featured = templates.slice(0, 5);

  return (
    <View style={fr.wrap}>
      <View style={fr.header}>
        <Text style={fr.title}>🔥 지금 인기</Text>
        <Text style={fr.sub}>실시간 TOP 챌린지</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fr.scroll}>
        {featured.map((t, i) => {
          const colors = GENRE_GRADIENTS[t.genre] ?? ['#7c3aed', '#5b21b6'];
          const isGold = i === 0;
          return (
            <TouchableOpacity key={t.id} style={[fr.card, isGold && fr.cardGold]} onPress={() => onSelect(t)} activeOpacity={0.85}>
              {/* Gradient background */}
              <View style={[fr.cardBg, {
                // @ts-ignore web
                background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
                backgroundColor: colors[0],
              }]}>
                {/* Gold glow for #1 */}
                {isGold && <View style={fr.goldGlow} />}

                {/* Rank number — huge transparent overlay */}
                <Text style={fr.rankNum}>#{i + 1}</Text>

                {/* Emoji */}
                <Text style={fr.cardEmoji}>{t.theme_emoji}</Text>
              </View>

              {/* Card info */}
              <View style={fr.cardBody}>
                <Text style={fr.cardName} numberOfLines={1}>{t.name}</Text>
                <Text style={fr.cardMeta}>⏱ {t.duration_sec}s · {t.missions.length}미션</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const fr = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    paddingTop: 4,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  scroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  card: {
    width: 150,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  cardGold: {
    shadowColor: '#f59e0b',
    shadowOpacity: 0.4,
    // @ts-ignore web
    boxShadow: '0 0 20px rgba(245,158,11,0.35)',
  },
  cardBg: {
    height: 120,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  goldGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f59e0b',
    opacity: 0.2,
    // @ts-ignore web
    filter: 'blur(30px)',
  },
  rankNum: {
    position: 'absolute',
    left: 6,
    top: 4,
    color: 'rgba(255,255,255,0.2)',
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 58,
    letterSpacing: -2,
  },
  cardEmoji: {
    fontSize: 40,
    zIndex: 1,
    // @ts-ignore web
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
  },
  cardBody: {
    padding: 10,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
});

// ─── Challenge Card ───────────────────────────────────────────────────────────

interface CardProps {
  item: Template;
  cardWidth: number;
  onPress: (t: Template) => void;
}

function ChallengeCard({ item: t, cardWidth, onPress }: CardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colors = GENRE_GRADIENTS[t.genre] ?? ['#7c3aed', '#5b21b6'];
  const vt = getTemplateByMissionId(t.genre);
  const missionTypes = [...new Set(t.missions.map(m => m.type))] as MissionType[];
  const diffColor = DIFF_COLORS[t.difficulty] ?? '#888';
  const diffLabel = DIFF_LABELS[t.difficulty] ?? '';

  const onPressIn  = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1.0,  useNativeDriver: true, tension: 200, friction: 10 }).start();
  const onHoverIn  = () =>
    Animated.spring(scaleAnim, { toValue: 1.025, useNativeDriver: true, tension: 180, friction: 12 }).start();
  const onHoverOut = () =>
    Animated.spring(scaleAnim, { toValue: 1.0,   useNativeDriver: true, tension: 180, friction: 12 }).start();

  const genreLabel = GENRES.find(g => g.value === t.genre)?.label ?? t.genre.toUpperCase();

  return (
    <Animated.View style={[cc.wrap, { width: cardWidth, transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={() => onPress(t)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        style={cc.pressable}
      >
        {/* ── Top gradient section ── */}
        <View style={[cc.band, {
          // @ts-ignore web only
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
          backgroundColor: colors[0],
        }]}>
          {/* Decorative circles */}
          <View style={cc.deco1} />
          <View style={cc.deco2} />

          {/* Top-left: genre + difficulty badges */}
          <View style={cc.bandTopLeft}>
            <View style={cc.genreBadge}>
              <Text style={cc.genreBadgeText}>{genreLabel}</Text>
            </View>
            {diffLabel ? (
              <View style={[cc.diffBadge, { backgroundColor: diffColor + 'dd' }]}>
                <Text style={cc.diffText}>{diffLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Top-right: video template badge */}
          {vt && (
            <View style={cc.vtBadge}>
              <Text style={cc.vtText}>🎬 템플릿</Text>
            </View>
          )}

          {/* Center emoji with glow */}
          <View style={cc.emojiWrap}>
            <View style={[cc.emojiGlow, { backgroundColor: colors[0] }]} />
            <Text style={cc.bandEmoji}>{t.theme_emoji}</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={cc.body}>
          <Text style={cc.title} numberOfLines={1}>{t.name}</Text>
          <Text style={cc.subtitle} numberOfLines={1}>
            AI 포즈판정 · 음성인식 · {t.duration_sec}s
          </Text>

          {/* Mission type pills */}
          {missionTypes.length > 0 && (
            <View style={cc.pillRow}>
              {missionTypes.map((type) => {
                const s = MISSION_STYLES[type];
                return (
                  <View key={type} style={[cc.pill, { backgroundColor: s.bg }]}>
                    <Text style={[cc.pillText, { color: s.text }]}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Accent divider */}
          <View style={[cc.divider, { backgroundColor: colors[0] + '33' }]} />
        </View>

        {/* ── CTA Button ── */}
        <View style={[cc.cta, {
          // @ts-ignore web only
          background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
          backgroundColor: colors[0],
        }]}>
          <Text style={cc.ctaText}>▶  챌린지 시작</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const cc = StyleSheet.create({
  wrap: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(22,22,31,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
    // @ts-ignore web
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
    // @ts-ignore web — hover feedback
    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  pressable: { flex: 1 },

  // Top gradient band
  band: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  deco2: {
    position: 'absolute',
    left: -20,
    bottom: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bandTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 5,
  },
  genreBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  genreBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  diffBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  diffText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  vtBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  vtText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emojiGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.3,
    // @ts-ignore web
    filter: 'blur(20px)',
  },
  bandEmoji: {
    fontSize: 52,
    zIndex: 1,
    // @ts-ignore web
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: 'rgba(22,22,31,0.92)',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    borderRadius: 1,
    marginTop: 4,
  },

  // CTA
  cta: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    // @ts-ignore web
    textShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const startSession = useSessionStore(s => s.startSession);

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  const numCols   = width >= 700 ? 2 : 1;
  const cardWidth = numCols === 2 ? (width - 56) / 2 : width - 32;

  const handleSelect = useCallback(
    (t: Template) => {
      startSession(t);
      router.push('/(main)/record');
    },
    [startSession, router],
  );

  const renderCard = useCallback(
    ({ item }: { item: Template }) => (
      <ChallengeCard item={item} cardWidth={cardWidth} onPress={handleSelect} />
    ),
    [cardWidth, handleSelect],
  );

  const keyExtractor = useCallback((t: Template) => t.id, []);

  const currentGenre = GENRES.find(g => g.value === selectedGenre);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

      {/* Sticky header */}
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerLogo}>챌린지 스튜디오</Text>
            <Text style={s.headerSub}>AI 챌린지 플랫폼</Text>
          </View>
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => router.push('/(main)/profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={loading || error ? [] : templates}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        key={`grid-${numCols}`}
        numColumns={numCols}
        contentContainerStyle={s.listContent}
        columnWrapperStyle={numCols > 1 ? s.colWrap : undefined}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <HeroBanner />

            {/* Stats Pills */}
            {!loading && !error && <StatsPills total={templates.length} />}

            {/* Genre filter */}
            <GenreFilter selected={selectedGenre} onSelect={setSelectedGenre} />

            {/* Featured row */}
            {!loading && !error && templates.length > 0 && (
              <View style={s.featuredWrap}>
                <FeaturedRow templates={templates} onSelect={handleSelect} />
              </View>
            )}

            {/* Section header */}
            {!loading && !error && (
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>
                  {currentGenre
                    ? `${currentGenre.emoji} ${currentGenre.label} 챌린지`
                    : '🎬 전체 챌린지'}
                </Text>
                <View style={s.sectionCountPill}>
                  <Text style={s.sectionCount}>{templates.length}개</Text>
                </View>
              </View>
            )}

            {/* Loading state */}
            {loading && (
              <View style={s.loadingWrap}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[s.skeleton, { opacity: 1 - i * 0.3 }]} />
                ))}
                <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 16 }} />
                <Text style={s.loadingText}>챌린지를 불러오는 중...</Text>
              </View>
            )}

            {/* Error state */}
            {error && (
              <View style={s.center}>
                <Text style={{ fontSize: 48 }}>⚠️</Text>
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={refetch}>
                  <Text style={s.retryBtnText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Spacer before card list */}
            {!loading && !error && templates.length > 0 && <View style={{ height: 4 }} />}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={s.center}>
              <Text style={{ fontSize: 56 }}>🎬</Text>
              <Text style={s.emptyTitle}>챌린지가 없습니다</Text>
              <Text style={s.emptyDesc}>다른 장르를 선택해보세요</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0d1a',
    // @ts-ignore web
    backgroundImage: 'radial-gradient(140% 100% at 50% -10%, #1e1b4b 0%, #0b0d1a 55%, #05060d 100%)',
  },
  safeTop: { backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(10,10,20,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    // @ts-ignore web
    backdropFilter: 'blur(18px)',
  },
  headerLeft: { gap: 2 },
  headerLogo: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    // @ts-ignore web
    textShadow: '0 0 20px rgba(124,58,237,0.6)',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  profileBtnText: { fontSize: 18 },

  featuredWrap: {
    backgroundColor: 'transparent',
    paddingTop: 20,
    paddingBottom: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  sectionCountPill: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  sectionCount: {
    fontSize: 12,
    color: '#a78bfa',
    fontWeight: '700',
  },

  listContent: { paddingBottom: 80, backgroundColor: 'transparent' },
  colWrap: { paddingHorizontal: 16, gap: 16, marginBottom: 16 },

  // Loading
  loadingWrap: { padding: 20, gap: 12, alignItems: 'center' },
  skeleton: {
    width: '100%',
    height: 220,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // @ts-ignore web
    backgroundImage:
      'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.04) 100%)',
    // @ts-ignore web
    backgroundSize: '200% 100%',
    // @ts-ignore web
    animation: 'skeletonSweep 1.4s ease-in-out infinite',
  },
  loadingText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 },

  // Error / Empty
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  emptyDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
});
