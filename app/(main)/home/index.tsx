import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTemplates } from '../../../hooks/useTemplates';
import { TemplateCard } from '../../../components/ui/TemplateCard';
import { useSessionStore } from '../../../store/sessionStore';
import type { Template } from '../../../types/template';

const GENRES: Array<{ label: string; value: Template['genre'] | 'all' }> = [
  { label: '전체',       value: 'all' },
  { label: 'K-POP',     value: 'kpop' },
  { label: '힙합',       value: 'hiphop' },
  { label: '피트니스',   value: 'fitness' },
  { label: '챌린지',     value: 'challenge' },
  { label: '여행',       value: 'travel' },
  { label: '일상',       value: 'daily' },
  { label: '프로모션',   value: 'promotion' },
  { label: '뉴스',       value: 'news' },
  { label: '영어',       value: 'english' },
  { label: '동화/키즈',  value: 'kids' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [selectedGenre, setSelectedGenre] = useState<Template['genre'] | 'all'>('all');
  const startSession = useSessionStore((s) => s.startSession);

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre } : undefined,
  );

  const handleSelectTemplate = (template: Template) => {
    startSession(template);
    router.push('/record');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🎬 챌린지 선택</Text>

      {/* 장르 필터 */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={GENRES}
          keyExtractor={(g) => g.value}
          renderItem={({ item: g }) => (
            <TouchableOpacity
              style={[styles.filterChip, selectedGenre === g.value && styles.filterChipActive]}
              onPress={() => setSelectedGenre(g.value)}
            >
              <Text
                style={[styles.filterText, selectedGenre === g.value && styles.filterTextActive]}
              >
                {g.label}
              </Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>템플릿 불러오는 중...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TemplateCard template={item} onPress={handleSelectTemplate} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>템플릿이 없습니다</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0e17',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    padding: 16,
    paddingBottom: 8,
  },
  filterRow: {
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
  },
  filterChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  filterText: {
    color: '#aaa',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: { color: '#aaa', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
  emptyText: { color: '#aaa', fontSize: 14 },
  retryBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
