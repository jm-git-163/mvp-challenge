/**
 * result/index.tsx
 *
 * 촬영 완료 후 결과 화면
 *
 * 기능:
 *  1. 세션 요약 (평균 점수, 성공률, Perfect/Good/Fail 분포)
 *  2. SNS 공유 (Web Share API / 클립보드 폴백)
 *  3. 영상 다운로드 버튼
 *  4. 해시태그 칩 표시
 *  5. 이원화 렌더링 선택 (성공 장면만 / 전체 기록)
 *  6. 완료 후 Supabase에 세션 저장
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useUserStore }    from '../../../store/userStore';
import { createSession, uploadVideo, upsertUserProfile, fetchUserProfile } from '../../../services/supabase';
import { requestAutoEdit } from '../../../services/api';
import type { JudgementTag } from '../../../types/session';
import type { Template } from '../../../types/template';

const TAG_COLORS: Record<JudgementTag, string> = {
  perfect: '#4caf50',
  good:    '#ffc107',
  fail:    '#ff6b6b',
};

// ── SNS 공유 ────────────────────────────────────────────────────────────────
async function handleShare(
  videoUri: string,
  template: Template,
  avgScore: number,
): Promise<void> {
  const caption = template.sns_template.caption_template
    .replace('{template_name}', template.name)
    .replace('{score}', String(Math.round(avgScore * 100)));

  const hashtagStr = template.sns_template.hashtags
    .map((h) => '#' + h)
    .join(' ');
  const fullText = caption + '\n' + hashtagStr;

  if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title: `${template.theme_emoji} ${template.name} 챌린지 완성!`,
        text: fullText,
        url: typeof window !== 'undefined' ? window.location.origin : '',
      });
    } catch {
      // User cancelled share — silently ignore
    }
    return;
  }

  // Fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(fullText);
    Alert.alert('클립보드에 복사됨!', '캡션이 복사되었습니다. SNS에 붙여넣으세요!');
  } else {
    Alert.alert('공유', fullText);
  }
}

// ── 영상 다운로드 (웹) ─────────────────────────────────────────────────────
function handleDownload(videoUri: string, templateName: string): void {
  if (typeof window === 'undefined' || !videoUri) return;
  const a = document.createElement('a');
  a.href = videoUri;
  a.download = `${templateName}_챌린지.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ResultScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams<{ videoUri: string }>();
  const videoUri = params.videoUri ?? '';

  const { frameTags, activeTemplate, setLastSession, reset } = useSessionStore();
  const { userId } = useUserStore();

  const [editMode, setEditMode] = useState<'auto' | 'full' | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [shared,   setShared]   = useState(false);

  // ── 세션 통계 계산 ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!frameTags.length) {
      return { avgScore: 0, successRate: 0, counts: { perfect: 0, good: 0, fail: 0 } };
    }
    const total = frameTags.length;
    const avgScore = frameTags.reduce((s, f) => s + f.score, 0) / total;
    const counts: Record<JudgementTag, number> = { perfect: 0, good: 0, fail: 0 };
    frameTags.forEach((f) => { counts[f.tag]++; });
    const successRate = (counts.perfect + counts.good) / total;
    return { avgScore, successRate, counts };
  }, [frameTags]);

  // ── 저장 처리 ──────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (mode: 'auto' | 'full') => {
      if (!userId || !activeTemplate) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }
      setEditMode(mode);
      setSaving(true);
      try {
        let editedUri: string | null = null;
        if (mode === 'auto' && frameTags.length > 0) {
          editedUri = await requestAutoEdit(videoUri, frameTags);
        }
        const session = await createSession({
          user_id:          userId,
          template_id:      activeTemplate.id,
          avg_score:        stats.avgScore,
          success_rate:     stats.successRate,
          tag_timeline:     frameTags,
          video_url:        videoUri || null,
          edited_video_url: editedUri,
        });
        setLastSession(session);

        const currentProfile = await fetchUserProfile(userId);
        const totalSessions  = (currentProfile?.total_sessions ?? 0) + 1;
        const prevRates      = currentProfile?.success_rates ?? {};

        await upsertUserProfile({
          user_id:          userId,
          preferred_genres: [
            ...(currentProfile?.preferred_genres ?? []),
            activeTemplate.genre,
          ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
          success_rates: { ...prevRates, [activeTemplate.id]: stats.successRate },
          total_sessions: totalSessions,
          weak_joints: currentProfile?.weak_joints ?? [],
        });

        setDone(true);
      } catch (e) {
        Alert.alert('저장 실패', e instanceof Error ? e.message : '저장 실패');
      } finally {
        setSaving(false);
      }
    },
    [userId, activeTemplate, frameTags, videoUri, stats],
  );

  const goHome = useCallback(() => {
    reset();
    router.replace('/(main)/home');
  }, [reset]);

  // ── 완료 화면 ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎬</Text>
          <Text style={styles.doneTitle}>저장 완료!</Text>
          <Text style={styles.doneDesc}>
            {editMode === 'auto'
              ? '성공 장면만 편집된 영상이 저장되었습니다.'
              : '전체 영상이 저장되었습니다.'}
          </Text>
          {activeTemplate && (
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => handleShare(videoUri, activeTemplate, stats.avgScore).then(() => setShared(true))}
            >
              <Text style={styles.shareBtnText}>📤 SNS 공유하기</Text>
            </TouchableOpacity>
          )}
          {shared && (
            <Text style={styles.sharedHint}>공유 또는 클립보드 복사 완료!</Text>
          )}
          <TouchableOpacity style={styles.homeBtn} onPress={goHome}>
            <Text style={styles.homeBtnText}>홈으로</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── 헤더 ─────────────────────────────── */}
        <Text style={styles.title}>
          {activeTemplate?.theme_emoji ?? '🎬'} 챌린지 완료!
        </Text>
        {activeTemplate && (
          <Text style={styles.subtitle}>{activeTemplate.name}</Text>
        )}

        {/* ── 점수 요약 ─────────────────────────── */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreMain}>{Math.round(stats.avgScore * 100)}</Text>
          <Text style={styles.scoreLabel}>평균 점수</Text>
          <Text style={styles.successRate}>
            성공률 {Math.round(stats.successRate * 100)}%
          </Text>
          {stats.avgScore >= 0.8 && (
            <Text style={styles.starRating}>🌟🌟🌟 완벽해요!</Text>
          )}
          {stats.avgScore >= 0.6 && stats.avgScore < 0.8 && (
            <Text style={styles.starRating}>⭐⭐ 잘했어요!</Text>
          )}
        </View>

        {/* ── 판정 분포 ─────────────────────────── */}
        <View style={styles.tagRow}>
          {(['perfect', 'good', 'fail'] as JudgementTag[]).map((tag) => (
            <View key={tag} style={styles.tagCard}>
              <Text style={[styles.tagCount, { color: TAG_COLORS[tag] }]}>
                {stats.counts[tag]}
              </Text>
              <Text style={styles.tagLabel}>
                {tag === 'perfect' ? 'PERFECT' : tag === 'good' ? 'GOOD' : 'MISS'}
              </Text>
            </View>
          ))}
        </View>

        {/* ── SNS 공유 섹션 ──────────────────────── */}
        {activeTemplate && (
          <View style={styles.snsSection}>
            <Text style={styles.sectionTitle}>📤 SNS 공유</Text>

            {/* 해시태그 칩 */}
            <View style={styles.hashtagRow}>
              {activeTemplate.sns_template.hashtags.map((tag) => (
                <View key={tag} style={styles.hashtagChip}>
                  <Text style={styles.hashtagText}>#{tag}</Text>
                </View>
              ))}
            </View>

            {/* 캡션 미리보기 */}
            <View style={styles.captionBox}>
              <Text style={styles.captionText}>
                {activeTemplate.sns_template.caption_template
                  .replace('{template_name}', activeTemplate.name)
                  .replace('{score}', String(Math.round(stats.avgScore * 100)))}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() =>
                handleShare(videoUri, activeTemplate, stats.avgScore).then(() => setShared(true))
              }
            >
              <Text style={styles.shareBtnText}>📤 SNS 공유하기</Text>
            </TouchableOpacity>

            {videoUri !== '' && (
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => handleDownload(videoUri, activeTemplate.name)}
              >
                <Text style={styles.downloadBtnText}>⬇ 영상 다운로드</Text>
              </TouchableOpacity>
            )}

            {shared && (
              <Text style={styles.sharedHint}>클립보드에 복사되었습니다!</Text>
            )}
          </View>
        )}

        {/* ── 저장 방식 선택 ─────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>영상 저장 방식</Text>

        <TouchableOpacity
          style={[styles.modeCard, styles.modeCardAuto]}
          onPress={() => handleSave('auto')}
          disabled={saving}
        >
          <Text style={styles.modeIcon}>✂️</Text>
          <View style={styles.modeInfo}>
            <Text style={styles.modeName}>성공 장면만</Text>
            <Text style={styles.modeDesc}>
              Good + Perfect 구간만 자동 편집 · 소셜 공유 최적화
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, styles.modeCardFull]}
          onPress={() => handleSave('full')}
          disabled={saving}
        >
          <Text style={styles.modeIcon}>📼</Text>
          <View style={styles.modeInfo}>
            <Text style={styles.modeName}>전체 기록</Text>
            <Text style={styles.modeDesc}>
              실패 구간 포함 전체 영상 · 퍼포먼스 아카이브
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── 로딩 ─────────────────────────────── */}
        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="large" color="#e94560" />
            <Text style={styles.savingText}>
              {editMode === 'auto' ? '영상 편집 중...' : '저장 중...'}
            </Text>
          </View>
        )}

        {/* ── 취소 ─────────────────────────────── */}
        <TouchableOpacity style={styles.cancelBtn} onPress={goHome}>
          <Text style={styles.cancelText}>저장 안 하고 나가기</Text>
        </TouchableOpacity>

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
    paddingBottom: 48,
  },

  // ── 헤더 ──
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── 점수 카드 ──
  scoreCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
  },
  scoreMain: {
    color: '#e94560',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  scoreLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  successRate: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: '700',
  },
  starRating: {
    fontSize: 15,
    marginTop: 4,
    color: '#ffd700',
  },

  // ── 판정 분포 ──
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tagCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    alignItems: 'center',
    padding: 12,
  },
  tagCount: {
    fontSize: 28,
    fontWeight: '900',
  },
  tagLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // ── SNS 섹션 ──
  snsSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hashtagChip: {
    backgroundColor: '#e9456022',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hashtagText: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '600',
  },
  captionBox: {
    backgroundColor: '#0f0e17',
    borderRadius: 10,
    padding: 12,
  },
  captionText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
  },
  shareBtn: {
    backgroundColor: '#1877f2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  downloadBtn: {
    backgroundColor: '#0f0e17',
    borderWidth: 1.5,
    borderColor: '#555',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '700',
  },
  sharedHint: {
    color: '#4caf50',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },

  // ── 모드 카드 ──
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  modeCardAuto: {
    backgroundColor: '#0d2137',
    borderWidth: 1.5,
    borderColor: '#e94560',
  },
  modeCardFull: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
  },
  modeIcon: {
    fontSize: 28,
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDesc: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
  },

  // ── 저장 중 ──
  savingOverlay: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  savingText: {
    color: '#aaa',
    fontSize: 14,
  },

  // ── 취소 ──
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#555',
    fontSize: 13,
  },

  // ── 완료 화면 ──
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  doneDesc: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  homeBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 8,
  },
  homeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
