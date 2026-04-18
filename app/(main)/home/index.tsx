/**
 * home/index.tsx — 모바일 퍼스트 홈 화면
 * AAA 게임 품질 UI · 어두운 그라디언트 배경 · 카드 UI · 반응형
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
import { VIDEO_TEMPLATES } from '../../../utils/videoTemplates';
import type { Template } from '../../../types/template';

const GENRES = [
  { label: '전체', value: 'all', emoji: '🌟' },
  { label: '일상', value: 'daily', emoji: '📱' },
  { label: '뉴스', value: 'news', emoji: '📺' },
  { label: 'K-POP', value: 'kpop', emoji: '🎤' },
  { label: '여행', value: 'travel', emoji: '✈️' },
  { label: '영어', value: 'english', emoji: '🇺🇸' },
  { label: '동화', value: 'kids', emoji: '📖' },
  { label: '챌린지', value: 'challenge', emoji: '🔥' },
  { label: '피트니스', value: 'fitness', emoji: '💪' },
  { label: '힙합', value: 'hiphop', emoji: '🎵' },
];

const GENRE_COLORS: Record<string, [string, string]> = {
  daily:     ['#667eea', '#764ba2'],
  news:      ['#0a1628', '#1565c0'],
  kpop:      ['#1a1a2e', '#e94560'],
  travel:    ['#0099f7', '#f11712'],
  english:   ['#667eea', '#2196f3'],
  kids:      ['#ffa87d', '#fcb69f'],
  challenge: ['#1a1a2e', '#ff6b35'],
  promotion: ['#f093fb', '#f5576c'],
  fitness:   ['#4facfe', '#00f2fe'],
  hiphop:    ['#2c3e50', '#4a235a'],
};

const GENRE_TO_VT: Record<string, string> = {
  daily: 'vt-vlog',
  news: 'vt-news',
  kpop: 'vt-kpop',
  english: 'vt-english',
  kids: 'vt-fairy',
};

export default function HomeScreen() {
  const router = useRouter();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const startSession = useSessionStore((s) => s.startSession);

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  const handleSelect = useCallback(
    (t: Template) => {
      startSession(t);
      router.push('/(main)/record');
    },
    [startSession, router],
  );

  const renderCard = useCallback(
    ({ item: t }: { item: Template }) => {
      const colors = GENRE_COLORS[t.genre] ?? ['#1a1a2e', '#333'];
      const missionTypes = [...new Set(t.missions.map((m) => m.type))];
      const typeIcons = missionTypes
        .map((tp) =>
          tp === 'gesture' ? '🤲' :
          tp === 'voice_read' ? '🎤' :
          tp === 'timing' ? '⏱' : '😊',
        )
        .join(' ');

      const vtId = GENRE_TO_VT[t.genre];
      const vt = vtId ? VIDEO_TEMPLATES.find((v) => v.id === vtId) : null;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSelect(t)}
          activeOpacity={0.88}
        >
          {/* Gradient header */}
          <View
            style={[
              styles.cardHeader,
              {
                // @ts-ignore web-only property
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                backgroundColor: colors[0],
              },
            ]}
          >
            <Text style={styles.cardEmoji}>{(t as any).theme_emoji ?? '🎬'}</Text>
            <View style={styles.cardHeaderInfo}>
              <View style={[styles.genreBadge, { backgroundColor: colors[1] + 'cc' }]}>
                <Text style={styles.genreBadgeText}>{t.genre.toUpperCase()}</Text>
              </View>
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraBadgeText}>
                  {(t as any).camera_mode === 'selfie' ? '🤳 셀카' : '📷 일반'}
                </Text>
              </View>
            </View>
          </View>

          {/* Card body */}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
            {(t as any).scene ? (
              <Text style={styles.cardScene} numberOfLines={2}>{(t as any).scene}</Text>
            ) : null}

            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>⏱</Text>
                <Text style={styles.metaText}>{t.duration_sec}초</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>🎯</Text>
                <Text style={styles.metaText}>{t.missions.length}개 미션</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>⭐</Text>
                <Text style={styles.metaText}>
                  {'★'.repeat(t.difficulty)}{'☆'.repeat(3 - t.difficulty)}
                </Text>
              </View>
            </View>

            <View style={styles.missionTypes}>
              <Text style={styles.missionTypesText}>{typeIcons} 미션 타입</Text>
            </View>

            {vt ? (
              <View style={styles.vtInfo}>
                <Text style={styles.vtIcon}>🎬</Text>
                <Text style={styles.vtText} numberOfLines={1}>
                  {vt.name} · {vt.clip_slots.length}개 클립 · {Math.round(vt.duration_ms / 1000)}초 완성 영상
                </Text>
              </View>
            ) : null}
          </View>

          {/* Start button */}
          <TouchableOpacity
            style={[
              styles.startCardBtn,
              {
                // @ts-ignore web-only property
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                backgroundColor: colors[1],
              },
            ]}
            onPress={() => handleSelect(t)}
            activeOpacity={0.85}
          >
            <Text style={styles.startCardBtnText}>▶ 챌린지 시작</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [handleSelect],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🎬 챌린지</Text>
            <Text style={styles.headerSub}>원하는 챌린지를 선택하세요</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(main)/profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.profileBtnText}>👤</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Genre filter row */}
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

      {/* Content */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>템플릿 불러오는 중...</Text>
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !error && (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyText}>템플릿이 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a1a' },
  safeTop: { backgroundColor: '#0a0a1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#888', fontSize: 13, marginTop: 2 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: { fontSize: 20 },

  filterScroll: { maxHeight: 56 },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  filterChipActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  filterEmoji: { fontSize: 14 },
  filterLabel: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterLabelActive: { color: '#fff' },

  listContent: { padding: 16, gap: 16, paddingBottom: 80 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 80,
  },
  cardEmoji: { fontSize: 40 },
  cardHeaderInfo: { gap: 6, alignItems: 'flex-end' },
  genreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  genreBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  cameraBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cameraBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  cardBody: { padding: 16, gap: 8 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardScene: { color: '#9ca3af', fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 14 },
  metaText: { color: '#9ca3af', fontSize: 13 },
  missionTypes: { backgroundColor: '#1f2937', borderRadius: 8, padding: 8 },
  missionTypesText: { color: '#9ca3af', fontSize: 12 },

  vtInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vtIcon: { fontSize: 14 },
  vtText: { color: '#94a3b8', fontSize: 11, flex: 1 },

  startCardBtn: {
    margin: 12,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  startCardBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    minHeight: 200,
  },
  loadingText: { color: '#9ca3af', fontSize: 14 },
  errorEmoji: { fontSize: 40 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: '#9ca3af', fontSize: 14 },
});
