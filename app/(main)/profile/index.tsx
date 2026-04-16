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
            <Text style={styles.statValue}>{preferredGenres.length}</Text>
            <Text style={styles.statLabel}>장르</Text>
          </View>
        </View>

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
    backgroundColor: '#0f0e17',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e94560',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  userId: {
    color: '#aaa',
    fontSize: 13,
  },
  // ── 통계 ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
    padding: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  // ── 섹션 ──
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // ── 장르 칩 ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  chipText: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: '600',
  },
  // ── 성공률 바 ──
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateId: {
    color: '#aaa',
    fontSize: 11,
    width: 80,
  },
  rateTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rateBar: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 3,
  },
  ratePct: {
    color: '#fff',
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },
  // ── 세션 목록 ──
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
  },
  sessionInfo: {
    gap: 2,
  },
  sessionDate: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sessionMeta: {
    color: '#888',
    fontSize: 11,
  },
  sessionScore: {
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
  },
});
