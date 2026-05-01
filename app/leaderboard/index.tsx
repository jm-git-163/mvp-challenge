/**
 * app/(main)/leaderboard/index.tsx
 *
 * 로컬 리더보드 화면. 서버 조회 없음. store/leaderboardStore 의 IDB/LS
 * 기록을 그대로 집계/정렬해서 표시.
 *
 * 탭:
 *   - 내 기록: 템플릿별 최고점 + 최근 5회
 *   - 친구 랭킹: 도전장으로 받은 친구 점수 (같은 슬러그 안에서 정렬)
 *
 * 진입:
 *   - 홈 최상단 카드 → 이 화면
 *   - URL: /leaderboard (expo-router file-route)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useLeaderboardStore,
  aggregateBySlug,
  recentSelf,
  friendRanking,
  type LeaderboardEntry,
  type SlugAggregate,
} from '../../store/leaderboardStore';

type Tab = 'mine' | 'friends';

function fmtDate(ms: number): string {
  try {
    const d = new Date(ms);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  } catch { return '—'; }
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#6366f1';
  return '#a1a1aa';
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const entries = useLeaderboardStore((s) => s.entries);
  const loaded  = useLeaderboardStore((s) => s.loaded);
  const load    = useLeaderboardStore((s) => s.load);
  const clearAll = useLeaderboardStore((s) => s.clearAll);

  const [tab, setTab] = useState<Tab>('mine');
  const [selectedSlug, setSelectedSlug] = useState<string | 'all'>('all');

  useEffect(() => { load(); }, [load]);

  const aggregates: SlugAggregate[] = useMemo(
    () => aggregateBySlug(entries),
    [entries],
  );
  const myRecent: LeaderboardEntry[] = useMemo(() => recentSelf(entries, 5), [entries]);
  const friends: LeaderboardEntry[] = useMemo(
    () => friendRanking(entries, selectedSlug === 'all' ? undefined : selectedSlug),
    [entries, selectedSlug],
  );

  const slugOptions: Array<{ slug: string; name: string }> = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (e.kind === 'friend' && !seen.has(e.slug)) seen.set(e.slug, e.templateName || e.slug);
    }
    return [...seen.entries()].map(([slug, name]) => ({ slug, name }));
  }, [entries]);

  return (
    <SafeAreaView style={st.root} edges={['top', 'bottom']}>
      <View style={st.header}>
        <Pressable
          onPress={() => router.back()}
          style={st.backBtn}
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로 돌아가기"
        >
          <Text style={st.backText}>←</Text>
        </Pressable>
        <Text style={st.title}>리더보드</Text>
        <Pressable
          onPress={async () => {
            if (typeof window !== 'undefined' && !window.confirm('모든 기록을 지울까요? (서버 없음 · 복구 불가)')) return;
            await clearAll();
          }}
          style={st.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="모든 기록 초기화"
          accessibilityHint="저장된 모든 챌린지 기록을 삭제합니다. 복구 불가."
        >
          <Text style={st.clearText}>초기화</Text>
        </Pressable>
      </View>

      <View style={st.tabs}>
        <Pressable
          style={[st.tab, tab === 'mine' && st.tabActive]}
          onPress={() => setTab('mine')}
          accessibilityRole="tab"
          accessibilityLabel="내 기록 탭"
          accessibilityState={{ selected: tab === 'mine' }}
        >
          <Text style={[st.tabText, tab === 'mine' && st.tabTextActive]}>내 기록</Text>
        </Pressable>
        <Pressable
          style={[st.tab, tab === 'friends' && st.tabActive]}
          onPress={() => setTab('friends')}
          accessibilityRole="tab"
          accessibilityLabel="친구 랭킹 탭"
          accessibilityState={{ selected: tab === 'friends' }}
        >
          <Text style={[st.tabText, tab === 'friends' && st.tabTextActive]}>친구 랭킹</Text>
        </Pressable>
      </View>

      {!loaded ? (
        <View style={st.center}><ActivityIndicator color="#111" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content}>
          {tab === 'mine' ? (
            <MineTab aggregates={aggregates} recent={myRecent} onStart={() => router.push('/home' as any)} />
          ) : (
            <FriendsTab
              slugOptions={slugOptions}
              selected={selectedSlug}
              onSelect={setSelectedSlug}
              list={friends}
              onStart={() => router.push('/home' as any)}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Mine tab ───────────────────────────────────────────────────────────

function MineTab({
  aggregates, recent, onStart,
}: {
  aggregates: SlugAggregate[];
  recent: LeaderboardEntry[];
  onStart: () => void;
}) {
  const selfAggs = aggregates.filter((a) => a.selfCount > 0);
  const totalRuns = recent.length > 0
    ? selfAggs.reduce((n, a) => n + a.selfCount, 0)
    : 0;

  if (selfAggs.length === 0) {
    return (
      <View style={st.emptyBlock}>
        <Text style={st.emptyEmoji}>🏁</Text>
        <Text style={st.emptyTitle}>아직 기록이 없어요</Text>
        <Text style={st.emptySub}>챌린지를 완료하면 여기 쌓여요.</Text>
        <Pressable
          style={st.ctaBtn}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="챌린지 고르러 가기"
          accessibilityHint="홈 화면으로 이동해 챌린지를 선택합니다"
        >
          <Text style={st.ctaText}>챌린지 고르러 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={st.statsRow}>
        <StatBox label="도전 횟수" value={`${totalRuns}회`} />
        <StatBox label="최고 점수" value={`${Math.max(...selfAggs.map((a) => a.selfBest))}점`} />
        <StatBox label="템플릿" value={`${selfAggs.length}개`} />
      </View>

      <Text style={st.sectionH}>템플릿별 최고점</Text>
      <View style={{ gap: 8 }}>
        {selfAggs
          .slice()
          .sort((a, b) => b.selfBest - a.selfBest)
          .map((a) => (
            <View key={a.slug} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle}>{a.templateName || a.slug}</Text>
                <Text style={st.rowSub}>{a.selfCount}회 · {fmtDate(a.lastAt)}</Text>
              </View>
              <Text style={[st.scorePill, { color: scoreColor(a.selfBest), borderColor: scoreColor(a.selfBest) + '55' }]}>
                {a.selfBest}
              </Text>
            </View>
          ))}
      </View>

      <Text style={[st.sectionH, { marginTop: 20 }]}>최근 5회</Text>
      <View style={{ gap: 8 }}>
        {recent.map((e) => (
          <View key={e.id} style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.rowTitle}>{e.templateName || e.slug}</Text>
              <Text style={st.rowSub}>{fmtDate(e.createdAt)}</Text>
            </View>
            <Text style={[st.scorePill, { color: scoreColor(e.score), borderColor: scoreColor(e.score) + '55' }]}>
              {e.score}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ─── Friends tab ────────────────────────────────────────────────────────

function FriendsTab({
  slugOptions, selected, onSelect, list, onStart,
}: {
  slugOptions: Array<{ slug: string; name: string }>;
  selected: string | 'all';
  onSelect: (v: string | 'all') => void;
  list: LeaderboardEntry[];
  onStart: () => void;
}) {
  if (list.length === 0 && slugOptions.length === 0) {
    return (
      <View style={st.emptyBlock}>
        <Text style={st.emptyEmoji}>🥊</Text>
        <Text style={st.emptyTitle}>친구 기록이 없어요</Text>
        <Text style={st.emptySub}>
          친구에게 도전장을 보내고 받은 점수가 여기 쌓여요.{'\n'}
          (친구가 결과 링크에서 점수를 공유하면 자동 기록)
        </Text>
        <Pressable
          style={st.ctaBtn}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel="챌린지 골라 도전장 보내기"
          accessibilityHint="홈 화면으로 이동해 도전장을 보낼 챌린지를 선택합니다"
        >
          <Text style={st.ctaText}>챌린지 골라 도전장 보내기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
        <Pressable
          onPress={() => onSelect('all')}
          style={[st.chip, selected === 'all' && st.chipActive]}
          accessibilityRole="button"
          accessibilityLabel="전체 친구 기록 보기"
          accessibilityState={{ selected: selected === 'all' }}
        >
          <Text style={[st.chipText, selected === 'all' && st.chipTextActive]}>전체</Text>
        </Pressable>
        {slugOptions.map((o) => (
          <Pressable
            key={o.slug}
            onPress={() => onSelect(o.slug)}
            style={[st.chip, selected === o.slug && st.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={`${o.name} 챌린지 친구 기록 보기`}
            accessibilityState={{ selected: selected === o.slug }}
          >
            <Text style={[st.chipText, selected === o.slug && st.chipTextActive]}>{o.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ gap: 8, marginTop: 10 }}>
        {list.map((e, i) => (
          <View key={e.id} style={st.row}>
            <Text style={st.rank}>#{i + 1}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={st.rowTitle}>{e.fromName || '친구'}</Text>
              <Text style={st.rowSub}>{e.templateName || e.slug} · {fmtDate(e.createdAt)}</Text>
            </View>
            <Text style={[st.scorePill, { color: scoreColor(e.score), borderColor: scoreColor(e.score) + '55' }]}>
              {e.score}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ─── Small bits ─────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.statBox}>
      <Text style={st.statVal}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0A0A0F' },
  header:  {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 8, gap: 12,
  },
  backBtn: {
    width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  title:   { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  clearBtn: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8,
    minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  clearText: { color: '#D1D5DB', fontSize: 12, fontWeight: '700' },

  tabs:    {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 4, marginBottom: 4,
  },
  tab:     {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tabActive: {
    backgroundColor: 'rgba(236,72,153,0.18)',
    borderColor: 'rgba(236,72,153,0.55)',
  },
  tabText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  content: { padding: 16, paddingBottom: 80, gap: 10 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionH: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 6, marginBottom: 2, letterSpacing: 0.3 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statVal:   { color: '#fff', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  rank:     { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '800', width: 32 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2, fontWeight: '500' },
  scorePill: {
    fontSize: 18, fontWeight: '900', minWidth: 48, textAlign: 'center',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5,
    fontVariant: ['tabular-nums'] as any,
  },

  chipRow: { gap: 8, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999,
    minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(236,72,153,0.18)',
    borderColor: 'rgba(236,72,153,0.55)',
  },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  emptyBlock: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  emptySub:   { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  ctaBtn:     {
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 999,
    backgroundColor: '#ec4899',
  },
  ctaText:    { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});
