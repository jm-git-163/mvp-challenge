/**
 * home/index.tsx — Pro rebuild
 * Linear/Notion-grade design. Monochrome, typography-first, thumbnail-centric.
 * No emoji chrome, no gradients, no bouncing animations.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTemplates } from '../../../hooks/useTemplates';
import { useSessionStore } from '../../../store/sessionStore';
import type { Template } from '../../../types/template';
import { getThumbnailUrl } from '../../../utils/thumbnails';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        '#FAFAFA',
  surface:   '#FFFFFF',
  ink:       '#0A0A0A',
  inkSub:    '#3F3F46',
  inkMuted:  '#71717A',
  inkFaint:  '#A1A1AA',
  border:    '#E5E5E5',
  borderStrong: '#D4D4D8',
  accent:    '#0A0A0A',
  fontSans:  Platform.select({
    web: '"Pretendard Variable",Pretendard,"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif',
    default: 'System',
  }) as string,
  fontMono:  Platform.select({
    web: '"JetBrains Mono","SF Mono",Menlo,monospace',
    default: 'Menlo',
  }) as string,
};

const GENRES = [
  { label: '전체',    value: 'all' },
  { label: 'K-POP',  value: 'kpop' },
  { label: '피트니스', value: 'fitness' },
  { label: '뉴스',    value: 'news' },
  { label: '일상',    value: 'daily' },
  { label: '여행',    value: 'travel' },
  { label: '동화',    value: 'kids' },
  { label: '힙합',    value: 'hiphop' },
  { label: '영어',    value: 'english' },
];

// Extra genre labels shown on cards even when not in the filter chip row
const GENRE_LABEL_MAP: Record<string, string> = {
  all: '전체', kpop: 'K-POP', fitness: '피트니스', news: '뉴스',
  daily: '일상', travel: '여행', kids: '동화', hiphop: '힙합',
  english: '영어', promotion: '프로모션', challenge: '챌린지',
};

const DIFF_LABELS = ['', '입문', '보통', '상급'];

const MISSION_LABEL: Record<string, string> = {
  gesture: '포즈',
  voice_read: '음성',
  timing: '타이밍',
  expression: '표정',
};

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  item: Template;
  width: number;
  onPress: (t: Template) => void;
}

function ChallengeCard({ item: t, width, onPress }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const genreLabel = GENRE_LABEL_MAP[t.genre] ?? t.genre;
  const diffLabel  = DIFF_LABELS[t.difficulty] ?? '';
  const missionSummary = useMemo(() => {
    const types = [...new Set(t.missions.map(m => m.type))];
    return types.map(ty => MISSION_LABEL[ty] ?? ty).join(' · ');
  }, [t.missions]);
  const mins = Math.floor(t.duration_sec / 60);
  const secs = t.duration_sec % 60;
  const timeLabel = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <Pressable
      onPress={() => onPress(t)}
      // @ts-ignore web
      onHoverIn={() => setHovered(true)}
      // @ts-ignore web
      onHoverOut={() => setHovered(false)}
      style={[
        card.wrap,
        { width },
        hovered && card.wrapHover,
      ]}
    >
      {/* 16:9 thumbnail — real Unsplash image */}
      <View style={card.thumb}>
        <Image
          source={{ uri: t.thumbnail_url || getThumbnailUrl(t.genre, t.id, 640) }}
          style={card.thumbImg}
          // @ts-ignore web
          loading="lazy"
        />
        <View style={card.thumbOverlay} pointerEvents="none" />
        <View style={card.playBadge} pointerEvents="none">
          <View style={card.playTri} />
        </View>
        {diffLabel ? (
          <View style={card.diffTag}>
            <Text style={card.diffTagText}>{diffLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={card.body}>
        <Text style={card.title} numberOfLines={2}>{t.name}</Text>
        <View style={card.metaRow}>
          <Text style={card.meta}>{timeLabel}</Text>
          <View style={card.dot} />
          <Text style={card.meta}>{genreLabel}</Text>
          {missionSummary ? (
            <>
              <View style={card.dot} />
              <Text style={card.meta} numberOfLines={1}>{missionSummary}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: T.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    // @ts-ignore web
    transition: 'border-color 160ms ease, transform 160ms ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  wrapHover: {
    borderColor: T.borderStrong,
    // @ts-ignore web
    transform: 'translateY(-1px)',
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F4F4F5',
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    // @ts-ignore web — subtle gradient to lift contrast for badges
    background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 55%, rgba(0,0,0,0.35) 100%)',
  },
  playBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore web
    backdropFilter: 'blur(8px)',
  },
  playTri: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderTopColor: 'transparent',
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
    borderLeftWidth: 10,
    borderLeftColor: '#FFFFFF',
  },
  diffTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: T.surface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: T.border,
  },
  diffTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: T.inkSub,
    letterSpacing: 0.2,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: T.ink,
    letterSpacing: -0.2,
    lineHeight: 20,
    fontFamily: T.fontSans,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 12,
    color: T.inkMuted,
    fontWeight: '500',
    fontFamily: T.fontSans,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: T.inkFaint,
  },
});

// ─── Genre filter (underline style) ───────────────────────────────────────────

interface FilterProps {
  selected: string;
  onSelect: (v: string) => void;
}

function GenreFilter({ selected, onSelect }: FilterProps) {
  return (
    <View style={gf.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={gf.scroll}
      >
        {GENRES.map(g => {
          const active = selected === g.value;
          return (
            <Pressable
              key={g.value}
              onPress={() => onSelect(g.value)}
              style={gf.item}
            >
              <Text style={[gf.label, active ? gf.labelActive : gf.labelInactive]}>
                {g.label}
              </Text>
              <View style={[gf.underline, active && gf.underlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const gf = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: T.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    gap: 0,
  },
  item: {
    paddingHorizontal: 14,
    paddingTop: 14,
    alignItems: 'center',
    gap: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    paddingBottom: 12,
    fontFamily: T.fontSans,
  },
  labelActive:   { color: T.ink },
  labelInactive: { color: T.inkMuted },
  underline: {
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: T.ink,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const startSession = useSessionStore(s => s.startSession);

  const { templates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  // Responsive grid
  const contentMax = 1200;
  const contentW = Math.min(width, contentMax);
  const gutter = 16;
  const sidePad = width >= 720 ? 24 : 16;
  let numCols = 1;
  if      (contentW >= 1100) numCols = 4;
  else if (contentW >= 860)  numCols = 3;
  else if (contentW >= 560)  numCols = 2;
  const cardW = (contentW - sidePad * 2 - gutter * (numCols - 1)) / numCols;

  const handleSelect = useCallback(
    (t: Template) => {
      startSession(t);
      router.push('/record');
    },
    [startSession, router],
  );

  const renderCard = useCallback(
    ({ item }: { item: Template }) => (
      <ChallengeCard item={item} width={cardW} onPress={handleSelect} />
    ),
    [cardW, handleSelect],
  );

  const keyExtractor = useCallback((t: Template) => t.id, []);

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safeTop}>
        <View style={[s.header, { paddingHorizontal: sidePad }]}>
          <View style={s.brand}>
            <View style={s.brandMark} />
            <Text style={s.brandName}>Challenge</Text>
          </View>
          <View style={s.headerRight}>
            <Pressable
              onPress={() => router.push('/(main)/profile')}
              style={s.iconBtn}
              // @ts-ignore web
              accessibilityLabel="Profile"
            >
              <Text style={s.iconBtnText}>프로필</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <GenreFilter selected={selectedGenre} onSelect={setSelectedGenre} />

      <FlatList
        data={loading || error ? [] : templates}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        key={`grid-${numCols}`}
        numColumns={numCols}
        contentContainerStyle={[
          s.listContent,
          { paddingHorizontal: sidePad, maxWidth: contentMax },
        ]}
        columnWrapperStyle={numCols > 1 ? { gap: gutter, marginBottom: gutter } : undefined}
        ItemSeparatorComponent={numCols === 1 ? () => <View style={{ height: gutter }} /> : undefined}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.listHeader}>
            <Text style={s.h1}>챌린지</Text>
            <Text style={s.h1Sub}>
              {loading ? '불러오는 중' : error ? '오류 발생' : `${templates.length}개의 챌린지`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.center}>
              <ActivityIndicator size="small" color={T.ink} />
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.errorText}>{error}</Text>
              <Pressable onPress={refetch} style={s.retryBtn}>
                <Text style={s.retryBtnText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.emptyText}>선택한 장르에 챌린지가 없습니다</Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeTop: {
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: T.ink,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: T.ink,
    fontFamily: T.fontSans,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore web
    cursor: 'pointer',
    // @ts-ignore web
    transition: 'border-color 140ms ease, background-color 140ms ease',
  },
  iconBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.inkSub,
    letterSpacing: -0.1,
    fontFamily: T.fontSans,
  },
  listContent: {
    paddingTop: 28,
    paddingBottom: 96,
    alignSelf: 'center',
    width: '100%',
  },
  listHeader: {
    paddingBottom: 24,
    gap: 4,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: T.ink,
    fontFamily: T.fontSans,
  },
  h1Sub: {
    fontSize: 13,
    color: T.inkMuted,
    fontWeight: '500',
    fontFamily: T.fontSans,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 14,
  },
  errorText: {
    fontSize: 13,
    color: T.inkMuted,
    fontFamily: T.fontSans,
  },
  emptyText: {
    fontSize: 13,
    color: T.inkMuted,
    fontFamily: T.fontSans,
  },
  retryBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.borderStrong,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.ink,
    fontFamily: T.fontSans,
  },
});
