/**
 * home/index.tsx — 챌린지 스튜디오 메인 홈
 *
 * ✅ Bug fix: Zustand selector infinite loop (#185)
 *    useSessionStore(s => ({ a, b })) → separate selectors
 *
 * 🎨 UI: 최신 게임/캡컷/캔바 수준
 *    - 애니메이션 히어로 배너
 *    - 피처드 챌린지 섹션 (horizontal scroll)
 *    - 고퀄리티 카드 (glow, gradient, badge)
 *    - 반응형 그리드
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

// ─── Constants ───────────────────────────────────────────────────────────────

const GENRES = [
  { label: '전체',    value: 'all',       emoji: '✨' },
  { label: '일상',    value: 'daily',     emoji: '📱' },
  { label: '뉴스',    value: 'news',      emoji: '📺' },
  { label: 'K-POP',  value: 'kpop',      emoji: '🎤' },
  { label: '영어',    value: 'english',   emoji: '🌍' },
  { label: '동화',    value: 'kids',      emoji: '📖' },
  { label: '여행',    value: 'travel',    emoji: '✈️' },
  { label: '피트니스', value: 'fitness',  emoji: '💪' },
  { label: '챌린지',  value: 'challenge', emoji: '🔥' },
];

const GENRE_GRADIENTS: Record<string, [string, string]> = {
  daily:     ['#667eea', '#764ba2'],
  news:      ['#1565c0', '#0d47a1'],
  kpop:      ['#e94560', '#c2185b'],
  travel:    ['#00acc1', '#0097a7'],
  english:   ['#2563eb', '#1e3a8a'],
  kids:      ['#a855f7', '#ec4899'],
  challenge: ['#ef4444', '#dc2626'],
  promotion: ['#9c27b0', '#6a1b9a'],
  fitness:   ['#14b8a6', '#0d9488'],
  hiphop:    ['#374151', '#111827'],
};

const MISSION_STYLES: Record<MissionType, { bg: string; text: string; label: string }> = {
  gesture:    { bg: '#ede9fe', text: '#7c3aed', label: '🤲 제스처' },
  voice_read: { bg: '#fce7f3', text: '#db2777', label: '🎤 따라읽기' },
  timing:     { bg: '#e0f2fe', text: '#0891b2', label: '⏱ 유지' },
  expression: { bg: '#fef3c7', text: '#d97706', label: '😊 표정' },
};

const DIFF_COLORS = ['', '#22c55e', '#f59e0b', '#ef4444'];
const DIFF_LABELS = ['', '입문', '보통', '어려움'];

// ─── Animated Hero Section ────────────────────────────────────────────────────

function HeroBanner() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(shimAnim, { toValue: 1, duration: 3000, useNativeDriver: false })
    ).start();
  }, []);

  return (
    <View style={hero.wrap}>
      {/* Gradient background */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            // @ts-ignore web only
            background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
            backgroundColor: '#302b63',
          },
        ]}
      />
      {/* Stars / particles */}
      {['10%','28%','52%','72%','90%'].map((left, i) => (
        <Animated.Text
          key={i}
          style={[
            hero.star,
            {
              left: left as any,
              top: `${10 + (i * 17) % 60}%` as any,
              opacity: shimAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }),
            },
          ]}
        >
          {['✨','⭐','💫','🌟','✦'][i]}
        </Animated.Text>
      ))}
      {/* Main content */}
      <View style={hero.inner}>
        <Animated.Text style={[hero.emoji, { transform: [{ translateY: floatAnim }] }]}>
          🎬
        </Animated.Text>
        <Text style={hero.title}>챌린지 스튜디오</Text>
        <Text style={hero.sub}>미션 완수 → 캡컷 스타일 영상 자동 완성</Text>
        <View style={hero.tags}>
          {['📹 카메라','🎯 미션','🎵 BGM','📤 SNS공유'].map((t) => (
            <View key={t} style={hero.tag}>
              <Text style={hero.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      {/* Bottom wave */}
      <View style={hero.wave} />
    </View>
  );
}

const hero = StyleSheet.create({
  wrap: {
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 0,
  },
  star: {
    position: 'absolute',
    fontSize: 14,
    zIndex: 1,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 2,
    gap: 6,
  },
  emoji: { fontSize: 42, marginBottom: 2 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    // @ts-ignore
    textShadow: '0 2px 12px rgba(124,58,237,0.8)',
  },
  sub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textAlign: 'center',
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: '#F4F5F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});

// ─── Featured Section ─────────────────────────────────────────────────────────

function FeaturedRow({ templates, onSelect }: { templates: Template[]; onSelect: (t: Template) => void }) {
  if (!templates.length) return null;
  const featured = templates.slice(0, 5);

  return (
    <View style={feat.wrap}>
      <View style={feat.header}>
        <Text style={feat.title}>🔥 지금 인기</Text>
        <Text style={feat.sub}>실시간 TOP 챌린지</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={feat.scroll}>
        {featured.map((t, i) => {
          const colors = GENRE_GRADIENTS[t.genre] ?? ['#667eea', '#764ba2'];
          const vt = getTemplateByMissionId(t.genre);
          return (
            <TouchableOpacity key={t.id} style={feat.card} onPress={() => onSelect(t)} activeOpacity={0.88}>
              <View
                style={[
                  feat.cardBg,
                  {
                    // @ts-ignore web
                    background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`,
                    backgroundColor: colors[0],
                  },
                ]}
              >
                <Text style={feat.rank}>#{i + 1}</Text>
                {vt && <View style={feat.vtBadge}><Text style={feat.vtBadgeText}>🎬 템플릿</Text></View>}
              </View>
              <View style={feat.cardBody}>
                <Text style={feat.cardEmoji}>{t.theme_emoji}</Text>
                <Text style={feat.cardName} numberOfLines={1}>{t.name}</Text>
                <Text style={feat.cardMeta}>⏱ {t.duration_sec}초 · 🎯 {t.missions.length}미션</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const feat = StyleSheet.create({
  wrap: { backgroundColor: '#fff', paddingTop: 16, paddingBottom: 8 },
  header: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 8, paddingHorizontal: 20, marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1a1a2e' },
  sub:   { fontSize: 12, color: '#999', fontWeight: '500' },
  scroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  card: {
    width: 130,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBg: {
    height: 80, position: 'relative',
    alignItems: 'flex-end', justifyContent: 'space-between',
    padding: 8, flexDirection: 'row',
  },
  rank: {
    position: 'absolute', left: 8, top: 8,
    color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '900',
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  vtBadge: {
    position: 'absolute', right: 6, top: 6,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  vtBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 10, alignItems: 'center', gap: 2 },
  cardEmoji: { fontSize: 24 },
  cardName: { fontSize: 12, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  cardMeta: { fontSize: 10, color: '#999' },
});

// ─── Challenge Card ───────────────────────────────────────────────────────────

interface CardProps {
  item: Template;
  cardWidth: number;
  onPress: (t: Template) => void;
}

function ChallengeCard({ item: t, cardWidth, onPress }: CardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colors = GENRE_GRADIENTS[t.genre] ?? ['#667eea', '#764ba2'];
  const vt = getTemplateByMissionId(t.genre);
  const missionTypes = [...new Set(t.missions.map(m => m.type))] as MissionType[];
  const diffColor = DIFF_COLORS[t.difficulty] ?? '#888';
  const diffLabel = DIFF_LABELS[t.difficulty] ?? '';

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1.0,  useNativeDriver: true }).start();

  return (
    <Animated.View style={[card.wrap, { width: cardWidth, transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={() => onPress(t)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={card.pressable}
      >
        {/* Top gradient band */}
        <View
          style={[
            card.band,
            {
              // @ts-ignore web only
              background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
              backgroundColor: colors[0],
            },
          ]}
        >
          <Text style={card.bandEmoji}>{t.theme_emoji}</Text>
          {/* Difficulty badge */}
          <View style={[card.diffBadge, { backgroundColor: diffColor + 'ee' }]}>
            <Text style={card.diffText}>{diffLabel}</Text>
          </View>
          {/* Video template badge */}
          {vt && (
            <View style={card.vtBadge}>
              <Text style={card.vtText}>🎬 영상 템플릿</Text>
            </View>
          )}
          {/* Decorative circles */}
          <View style={[card.deco1, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          <View style={[card.deco2, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />
        </View>

        {/* Body */}
        <View style={card.body}>
          <Text style={card.title} numberOfLines={1}>{t.name}</Text>
          {t.scene ? (
            <Text style={card.desc} numberOfLines={2}>{t.scene}</Text>
          ) : null}

          {/* Stats row */}
          <View style={card.statsRow}>
            <View style={card.statChip}>
              <Text style={card.statText}>⏱ {t.duration_sec}s</Text>
            </View>
            <View style={card.statChip}>
              <Text style={card.statText}>🎯 {t.missions.length}미션</Text>
            </View>
            <View style={card.statChip}>
              <Text style={card.statText}>{'★'.repeat(t.difficulty)}{'☆'.repeat(3 - t.difficulty)}</Text>
            </View>
          </View>

          {/* Mission type pills */}
          {missionTypes.length > 0 && (
            <View style={card.pillRow}>
              {missionTypes.map((type) => {
                const s = MISSION_STYLES[type];
                return (
                  <View key={type} style={[card.pill, { backgroundColor: s.bg }]}>
                    <Text style={[card.pillText, { color: s.text }]}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* CTA button */}
        <View
          style={[
            card.cta,
            {
              // @ts-ignore web only
              background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
              backgroundColor: colors[0],
            },
          ]}
        >
          <Text style={card.ctaText}>▶  챌린지 시작</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  pressable: { flex: 1 },
  band: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bandEmoji: { fontSize: 52 },
  diffBadge: {
    position: 'absolute', top: 10, left: 10,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  diffText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  vtBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  vtText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  deco1: {
    position: 'absolute', right: -20, top: -20,
    width: 80, height: 80, borderRadius: 40,
  },
  deco2: {
    position: 'absolute', left: -10, bottom: -30,
    width: 80, height: 80, borderRadius: 40,
  },
  body: { padding: 14, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', lineHeight: 21 },
  desc: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statChip: {
    backgroundColor: '#F5F5F8', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statText: { fontSize: 11, color: '#888', fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  cta: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ total }: { total: number }) {
  return (
    <View style={stats.wrap}>
      {[
        { label: '챌린지 수', value: String(total), icon: '🎯' },
        { label: '영상 템플릿', value: String(VIDEO_TEMPLATES.length), icon: '🎬' },
        { label: '미션 종류', value: '4', icon: '⚡' },
      ].map((s) => (
        <View key={s.label} style={stats.item}>
          <Text style={stats.icon}>{s.icon}</Text>
          <Text style={stats.value}>{s.value}</Text>
          <Text style={stats.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const stats = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  item: {
    flex: 1, alignItems: 'center', gap: 2,
    borderRightWidth: 1, borderRightColor: '#EBEBEB',
  },
  icon: { fontSize: 18 },
  value: { fontSize: 18, fontWeight: '900', color: '#7c3aed' },
  label: { fontSize: 10, color: '#999', fontWeight: '500' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // ✅ BUG FIX: separate selectors prevent object-reference infinite loop (#185)
  const startSession = useSessionStore(s => s.startSession);

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  const numCols  = width >= 700 ? 2 : 1;
  const cardWidth = numCols === 2 ? (width - 48) / 2 : width - 32;

  const handleSelect = useCallback(
    (t: Template) => {
      startSession(t);   // sessionKey++ 내부에서 자동 처리, reset() 불필요
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

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#302b63" />

      {/* Sticky header */}
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerLogo}>챌린지 스튜디오</Text>
            <Text style={s.headerSub}>최고의 챌린지를 경험하세요</Text>
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

            {/* Stats bar */}
            {!loading && !error && <StatsBar total={templates.length} />}

            {/* Genre filter chips */}
            <View style={s.filterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterContent}
              >
                {GENRES.map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[s.chip, selectedGenre === g.value && s.chipActive]}
                    onPress={() => setSelectedGenre(g.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.chipEmoji}>{g.emoji}</Text>
                    <Text style={[s.chipLabel, selectedGenre === g.value && s.chipLabelActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Featured row */}
            {!loading && !error && templates.length > 0 && (
              <FeaturedRow templates={templates} onSelect={handleSelect} />
            )}

            {/* Section header */}
            {!loading && !error && (
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>
                  {selectedGenre === 'all' ? '🎬 전체 챌린지' : `${GENRES.find(g => g.value === selectedGenre)?.emoji} ${GENRES.find(g => g.value === selectedGenre)?.label} 챌린지`}
                </Text>
                <Text style={s.sectionCount}>{templates.length}개</Text>
              </View>
            )}

            {/* Loading skeleton */}
            {loading && (
              <View style={s.skeletonWrap}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[s.skeleton, { opacity: 1 - i * 0.25 }]} />
                ))}
                <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 8 }} />
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
  root: { flex: 1, backgroundColor: '#F4F5F9' },
  safeTop: { backgroundColor: '#302b63' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#302b63',
  },
  headerLeft: { gap: 1 },
  headerLogo: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  profileBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  profileBtnText: { fontSize: 20 },

  filterWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 36,
  },
  chipActive: {
    backgroundColor: '#EDE9FF',
    borderColor: '#7c3aed',
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { color: '#555', fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: '#7c3aed', fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a2e' },
  sectionCount: { fontSize: 13, color: '#999', fontWeight: '600' },

  listContent: { paddingBottom: 80 },
  colWrap: { paddingHorizontal: 16, gap: 16, marginBottom: 16 },

  // Loading
  skeletonWrap: { padding: 16, gap: 12, alignItems: 'center' },
  skeleton: { width: '100%', height: 200, backgroundColor: '#E8E8EC', borderRadius: 20 },
  loadingText: { color: '#999', fontSize: 13, marginTop: 4 },

  // Error / Empty
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#7c3aed', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14, minHeight: 50, justifyContent: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  emptyDesc:  { fontSize: 13, color: '#999' },
});
