/**
 * profile/index.tsx
 *
 * 사용자 프로필 화면
 *  - 총 세션 수, 평균 성공률, 선호 장르
 *  - 최근 세션 목록
 *  - 지속학습 프로파일링 현황 (Phase 2 확장 기반)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useUserStore }   from '../../../store/userStore';
import { fetchUserSessions, fetchUserProfile } from '../../../services/supabase';
import type { UserSession } from '../../../types/session';
import { Claude, ClaudeFont } from '../../../constants/claudeTheme';

const GENRE_LABEL: Record<string, string> = {
  kpop: 'K-POP', hiphop: '힙합', fitness: '피트니스',
  challenge: '챌린지', promotion: '프로모션',
};

export default function ProfileScreen() {
  const { userId, profile, setProfile } = useUserStore();
  const [sessions, setSessions]         = useState<UserSession[]>([]);
  const [loading,  setLoading]          = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    Promise.all([
      fetchUserProfile(userId),
      fetchUserSessions(userId),
    ]).then(([prof, sess]) => {
      if (prof) setProfile(prof);
      setSessions(sess.slice(0, 10));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  // ── 로그인 안 된 상태 ─────────────────────────
  if (!userId) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>로그인이 필요합니다</Text>
          <Text style={styles.emptySubtext}>
            Supabase Auth 연동 후 이용 가능합니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  const totalSessions  = profile?.total_sessions ?? 0;
  const preferredGenres = profile?.preferred_genres ?? [];
  const successRates   = profile?.success_rates ?? {};
  const avgSuccess     = Object.values(successRates).length
    ? Object.values(successRates).reduce((a, b) => a + b, 0) /
      Object.values(successRates).length
    : 0;
  const bestScore = sessions.length
    ? Math.max(...sessions.map(s => s.avg_score))
    : 0;
  const bestStreak = (() => {
    // consecutive sessions with avg_score >= 0.6 starting from most recent
    let streak = 0;
    for (const s of sessions) {
      if (s.avg_score >= 0.6) streak++; else break;
    }
    return streak;
  })();

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── 헤더 ────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userId.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userId}>
            {userId.slice(0, 8)}...
          </Text>
        </View>

        {/* ── 통계 카드 ────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>총 세션</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4caf50' }]}>
              {Math.round(avgSuccess * 100)}%
            </Text>
            <Text style={styles.statLabel}>평균 성공률</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#fbbf24' }]}>
              {Math.round(bestScore * 100)}
            </Text>
            <Text style={styles.statLabel}>🏆 최고점</Text>
          </View>
        </View>

        {/* ── 연속 성공 스트릭 ──────────────────── */}
        {bestStreak > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>{bestStreak}회 연속 성공</Text>
              <Text style={styles.streakSub}>
                최근 {bestStreak}개 세션이 모두 60점 이상
              </Text>
            </View>
          </View>
        )}

        {/* ── 선호 장르 ────────────────────────── */}
        {preferredGenres.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>선호 장르</Text>
            <View style={styles.chipRow}>
              {preferredGenres.map((g) => (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {GENRE_LABEL[g] ?? g}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 템플릿별 성공률 ──────────────────── */}
        {Object.keys(successRates).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>챌린지 성공률</Text>
            {Object.entries(successRates).map(([id, rate]) => (
              <View key={id} style={styles.rateRow}>
                <Text style={styles.rateId} numberOfLines={1}>
                  {id.slice(0, 12)}...
                </Text>
                <View style={styles.rateTrack}>
                  <View
                    style={[
                      styles.rateBar,
                      { width: `${(rate as number) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.ratePct}>
                  {Math.round((rate as number) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 최근 세션 ────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 기록</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptySubtext}>아직 기록이 없습니다</Text>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionDate}>
                    {new Date(s.recorded_at).toLocaleDateString('ko-KR')}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    성공률 {Math.round(s.success_rate * 100)}%
                  </Text>
                </View>
                <Text style={[
                  styles.sessionScore,
                  { color: s.avg_score >= 0.85 ? '#4caf50'
                          : s.avg_score >= 0.65 ? '#ffc107' : '#ff6b6b' }
                ]}>
                  {Math.round(s.avg_score * 100)}점
                </Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Claude.paper,
    // @ts-ignore web
    backgroundImage:
      'radial-gradient(120% 80% at 50% -10%, #FBF7EE 0%, #F7F3EB 55%, #EEE6D5 100%)',
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // ── 헤더 ──
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Claude.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Claude.amber,
    // @ts-ignore web
    boxShadow: '0 14px 30px -12px rgba(63,42,31,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  avatarText: {
    color: Claude.paper,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif,
  },
  userId: {
    color: Claude.inkFaint,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  // ── 통계 ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Claude.hairline,
    // @ts-ignore web
    boxShadow: '0 10px 24px -14px rgba(63,42,31,0.35)',
  },
  statValue: {
    color: Claude.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif,
  },
  statLabel: {
    color: Claude.inkFaint,
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1.2,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  // ── 섹션 ──
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionTitle: {
    color: Claude.ink,
    fontSize: 18,
    fontWeight: '800',
    // @ts-ignore web
    fontFamily: ClaudeFont.serif,
  },
  // ── 장르 칩 ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(204,120,92,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Claude.hairlineStrong,
  },
  chipText: {
    color: Claude.amberDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // ── 성공률 바 ──
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateId: {
    color: Claude.inkMuted,
    fontSize: 11,
    width: 80,
    fontWeight: '600',
  },
  rateTrack: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(161,98,68,0.14)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rateBar: {
    height: '100%',
    backgroundColor: Claude.amber,
    borderRadius: 4,
    // @ts-ignore web
    backgroundImage: `linear-gradient(90deg, ${Claude.amberDeep}, ${Claude.amber})`,
  },
  ratePct: {
    color: Claude.ink,
    fontSize: 11,
    width: 32,
    textAlign: 'right',
    fontWeight: '800',
  },
  // ── 세션 목록 ──
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Claude.hairline,
  },
  sessionInfo: {
    gap: 2,
  },
  sessionDate: {
    color: Claude.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  sessionMeta: {
    color: Claude.inkFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  sessionScore: {
    fontSize: 20,
    fontWeight: '900',
  },
  // 연속 성공 스트릭
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(204,120,92,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Claude.hairlineStrong,
    marginBottom: 24,
    // @ts-ignore web
    boxShadow: '0 10px 22px -14px rgba(204,120,92,0.5)',
  },
  streakEmoji: { fontSize: 34 },
  streakTitle: { color: Claude.ink, fontSize: 15, fontWeight: '800', letterSpacing: 0.3,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif },
  streakSub:   { color: Claude.inkMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  emptyText: {
    color: Claude.ink,
    fontSize: 17,
    fontWeight: '800',
    // @ts-ignore web
    fontFamily: ClaudeFont.serif,
  },
  emptySubtext: {
    color: Claude.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
});
