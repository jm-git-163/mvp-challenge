/**
 * home/index.tsx — Canva-quality 홈 화면
 * 밝은 배경 · 흰색 카드 · 보라색 액센트 · 반응형 2열 그리드
 * 미션 타입 배지 · 완성영상 템플릿 표시
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTemplates } from '../../../hooks/useTemplates';
import { useSessionStore } from '../../../store/sessionStore';
import { VIDEO_TEMPLATES, getTemplateByMissionId } from '../../../utils/videoTemplates';
import type { Template, MissionType } from '../../../types/template';

// Genre → video template mapping
const GENRE_TO_VT: Record<string, string> = {
  daily: 'vt-vlog', news: 'vt-news', kpop: 'vt-kpop',
  english: 'vt-english', kids: 'vt-fairy',
};

const GENRES = [
  { label: '전체',     value: 'all',       emoji: '✨' },
  { label: '일상',     value: 'daily',     emoji: '📱' },
  { label: '뉴스',     value: 'news',      emoji: '📺' },
  { label: 'K-POP',   value: 'kpop',      emoji: '🎤' },
  { label: '여행',     value: 'travel',    emoji: '✈️' },
  { label: '영어',     value: 'english',   emoji: '🌍' },
  { label: '동화',     value: 'kids',      emoji: '📖' },
  { label: '챌린지',  value: 'challenge',  emoji: '🔥' },
];

const GENRE_COLORS: Record<string, [string, string]> = {
  daily:     ['#667eea', '#764ba2'],
  news:      ['#1565c0', '#0d47a1'],
  kpop:      ['#e94560', '#c2185b'],
  travel:    ['#00acc1', '#0097a7'],
  english:   ['#2563eb', '#1e3a8a'],
  kids:      ['#7c3aed', '#db2777'],
  challenge: ['#f44336', '#c62828'],
  promotion: ['#9c27b0', '#6a1b9a'],
  fitness:   ['#00bcd4', '#0097a7'],
  hiphop:    ['#424242', '#212121'],
};

const GENRE_EMOJIS: Record<string, string> = {
  daily: '📱', news: '📺', kpop: '🎤', travel: '✈️',
  english: '🌍', kids: '📖', challenge: '🔥', promotion: '🛒',
  fitness: '💪', hiphop: '🎵',
};

// Mission type colors and labels
const MISSION_TYPE_STYLES: Record<MissionType, { bg: string; text: string; label: string }> = {
  gesture:    { bg: '#ede9fe', text: '#7c3aed', label: '🤲 제스처' },
  voice_read: { bg: '#fce7f3', text: '#db2777', label: '🎤 따라읽기' },
  timing:     { bg: '#e0f2fe', text: '#0891b2', label: '⏱ 유지' },
  expression: { bg: '#fef3c7', text: '#d97706', label: '😊 표정' },
};

export default function HomeScreen() {
  const router = useRouter();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const { startSession, reset } = useSessionStore(s => ({ startSession: s.startSession, reset: s.reset }));

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  const handleSelect = useCallback(
    (t: Template) => {
      reset();          // clear any previous session
      startSession(t);  // set new template
      router.push('/(main)/record');
    },
    [reset, startSession, router],
  );

  const { width } = Dimensions.get('window');
  const numCols  = width >= 680 ? 2 : 1;
  const cardWidth = width >= 680 ? (width - 48) / 2 : width - 32;

  const renderCard = useCallback(
    ({ item: t }: { item: Template }) => {
      const colors = GENRE_COLORS[t.genre] ?? ['#667eea', '#764ba2'];
      const emoji  = t.theme_emoji ?? GENRE_EMOJIS[t.genre] ?? '🎬';
      const vt     = getTemplateByMissionId(t.genre);
      const hasVideoTemplate = !!vt && VIDEO_TEMPLATES.some((v) => v.id === vt.id);

      const difficultyStars =
        '★'.repeat(t.difficulty) + '☆'.repeat(Math.max(0, 3 - t.difficulty));

      // Collect unique mission types
      const missionTypes: MissionType[] = [];
      for (const m of t.missions) {
        if (!missionTypes.includes(m.type)) missionTypes.push(m.type);
      }

      return (
        <View style={[styles.card, { width: cardWidth }]}>
          {/* Colored gradient top band */}
          <View
            style={[
              styles.cardBand,
              {
                // @ts-ignore web-only property
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                backgroundColor: colors[0],
              },
            ]}
          >
            <Text style={styles.cardBandEmoji}>{emoji}</Text>
            {hasVideoTemplate && (
              <View style={styles.videoBadge}>
                <Text style={styles.videoBadgeText}>🎬 영상 템플릿 포함</Text>
              </View>
            )}
          </View>

          {/* Card body */}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
            {t.scene ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{t.scene}</Text>
            ) : null}

            {/* Metadata row */}
            <View style={styles.metaRow}>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>⏱ {t.duration_sec}초</Text>
              </View>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>🎯 {t.missions.length}개</Text>
              </View>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>{difficultyStars}</Text>
              </View>
            </View>

            {/* Mission type badges */}
            {missionTypes.length > 0 && (
              <View style={styles.missionTypesRow}>
                {missionTypes.map((type) => {
                  const s = MISSION_TYPE_STYLES[type];
                  return (
                    <View key={type} style={[styles.missionTypePill, { backgroundColor: s.bg }]}>
                      <Text style={[styles.missionTypePillText, { color: s.text }]}>{s.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Full-width start button */}
          <TouchableOpacity
            style={[
              styles.startBtn,
              {
                // @ts-ignore web-only property
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                backgroundColor: colors[1],
              },
            ]}
            onPress={() => handleSelect(t)}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>▶ 챌린지 시작</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [handleSelect, cardWidth],
  );

  const keyExtractor = useCallback((t: Template) => t.id, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Sticky header */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerLogo}>🎬 챌린지 스튜디오</Text>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(main)/profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Genre filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {GENRES.map((g) => (
          <TouchableOpacity
            key={g.value}
            style={[styles.filterChip, selectedGenre === g.value && styles.filterChipActive]}
            onPress={() => setSelectedGenre(g.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.filterEmoji}>{g.emoji}</Text>
            <Text style={[styles.filterLabel, selectedGenre === g.value && styles.filterLabelActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading state */}
      {loading && (
        <View style={styles.center}>
          <View style={styles.skeletonCard} />
          <View style={[styles.skeletonCard, { opacity: 0.6 }]} />
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 16 }} />
          <Text style={styles.loadingText}>템플릿 불러오는 중...</Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Template list */}
      {!loading && !error && (
        <FlatList
          data={templates}
          keyExtractor={keyExtractor}
          renderItem={renderCard}
          key={`list-${numCols}`}
          numColumns={numCols}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numCols > 1 ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyText}>템플릿이 없습니다</Text>
              <Text style={styles.emptySubText}>다른 장르를 선택해보세요</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5F9' },
  safeTop: { backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLogo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.3,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0EFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: { fontSize: 20 },

  // Filter chips
  filterScroll: {
    maxHeight: 60,
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
  filterChip: {
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
  filterChipActive: {
    backgroundColor: '#EDE9FF',
    borderColor: '#7C3AED',
  },
  filterEmoji: { fontSize: 13 },
  filterLabel: { color: '#555', fontSize: 13, fontWeight: '600' },
  filterLabelActive: { color: '#7C3AED', fontWeight: '700' },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 16,
  },
  columnWrapper: {
    gap: 16,
    justifyContent: 'flex-start',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  // Card top band
  cardBand: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardBandEmoji: { fontSize: 40 },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Card body
  cardBody: {
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a2e',
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaTag: {
    backgroundColor: '#F5F5F8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaTagText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  // Mission type badges
  missionTypesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  missionTypePill: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  missionTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Start button (full-width, 52px)
  startBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    minHeight: 200,
  },
  skeletonCard: {
    width: '90%',
    height: 160,
    backgroundColor: '#E8E8EC',
    borderRadius: 16,
  },
  loadingText: { color: '#999', fontSize: 14, marginTop: 4 },
  errorEmoji: { fontSize: 40 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: '#333', fontSize: 16, fontWeight: '700' },
  emptySubText: { color: '#999', fontSize: 13 },
});
