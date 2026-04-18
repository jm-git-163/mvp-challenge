/**
 * result/index.tsx
 *
 * 촬영 완료 후 결과 화면 — CapCut 스타일 비디오 합성 + SNS 공유
 *
 * 기능:
 *  1. 세션 요약 (평균 점수, 성공률, Perfect/Good/Fail 분포)
 *  2. "완성 영상 만들기" → composeVideo() → 합성 진행바 → 완성 영상 미리보기
 *  3. 합성 영상 다운로드 (webm)
 *  4. SNS 공유 (Web Share API / 클립보드 폴백)
 *  5. 해시태그 칩 + 캡션 미리보기
 *  6. Supabase 세션 저장
 *  7. "다시 촬영" 버튼
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useUserStore }    from '../../../store/userStore';
import {
  createSession,
  upsertUserProfile,
  fetchUserProfile,
} from '../../../services/supabase';
import { requestAutoEdit } from '../../../services/api';
import { composeVideo, type CompositorProgress } from '../../../utils/videoCompositor';
import { getVideoTemplate, VIDEO_TEMPLATES }       from '../../../utils/videoTemplates';
import type { JudgementTag } from '../../../types/session';
import type { RecordedClip } from '../../../utils/videoCompositor';

const TAG_COLORS: Record<JudgementTag, string> = {
  perfect: '#4caf50',
  good:    '#ffc107',
  fail:    '#ff6b6b',
};

async function doShare(
  composedUri: string,
  rawUri: string,
  template: { name: string; theme_emoji: string; sns_template: { caption_template: string; hashtags: string[] } },
  avgScore: number,
): Promise<void> {
  const caption = template.sns_template.caption_template
    .replace('{template_name}', template.name)
    .replace('{score}', String(Math.round(avgScore * 100)));
  const hashtagStr = template.sns_template.hashtags.map((h) => '#' + h).join(' ');
  const fullText = caption + '\n' + hashtagStr;

  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({
        title: `${template.theme_emoji} ${template.name} 챌린지 완성!`,
        text: fullText,
        url: typeof window !== 'undefined' ? window.location.origin : '',
      });
    } catch {
      // user cancelled
    }
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(fullText);
    Alert.alert('클립보드에 복사됨!', '캡션이 복사되었습니다. SNS에 붙여넣으세요!');
  } else {
    Alert.alert('공유', fullText);
  }
}

function doDownload(uri: string, name: string): void {
  if (typeof window === 'undefined' || !uri) return;
  const a = document.createElement('a');
  a.href = uri;
  a.download = `${name}_챌린지.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    videoUri: string;
    videoTemplateId?: string;
    clipsJson?: string;
  }>();

  const rawVideoUri     = params.videoUri ?? '';
  const videoTemplateId = params.videoTemplateId ?? '';

  const { frameTags, activeTemplate, setLastSession, reset } = useSessionStore();
  const { userId } = useUserStore();

  // Composed video state
  const [composedUri,  setComposedUri]  = useState<string | null>(null);
  const [composing,    setComposing]    = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [progress,     setProgress]     = useState<CompositorProgress | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [shared, setShared] = useState(false);

  // Stats
  const stats = useMemo(() => {
    if (!frameTags.length) {
      return { avgScore: 0, successRate: 0, counts: { perfect: 0, good: 0, fail: 0 } };
    }
    const total    = frameTags.length;
    const avgScore = frameTags.reduce((s, f) => s + f.score, 0) / total;
    const counts: Record<JudgementTag, number> = { perfect: 0, good: 0, fail: 0 };
    frameTags.forEach((f) => { counts[f.tag]++; });
    const successRate = (counts.perfect + counts.good) / total;
    return { avgScore, successRate, counts };
  }, [frameTags]);

  // Resolve video template
  const videoTemplate = useMemo(() => {
    if (videoTemplateId) return getVideoTemplate(videoTemplateId);
    if (activeTemplate) {
      const genreMap: Record<string, string> = {
        daily: 'vt-vlog', news: 'vt-news', kpop: 'vt-kpop',
        english: 'vt-english', kids: 'vt-fairy',
      };
      const vtId = genreMap[activeTemplate.genre];
      if (vtId) return getVideoTemplate(vtId);
    }
    return VIDEO_TEMPLATES[0];
  }, [videoTemplateId, activeTemplate]);

  // Build RecordedClip[] — all slots share the same raw recording blob
  const buildClips = useCallback(async (): Promise<RecordedClip[]> => {
    if (!rawVideoUri || !videoTemplate) return [];
    const resp = await fetch(rawVideoUri);
    const blob = await resp.blob();
    return videoTemplate.clip_slots.map((slot) => ({
      slot_id:     slot.id,
      blob,
      duration_ms: slot.end_ms - slot.start_ms,
    }));
  }, [rawVideoUri, videoTemplate]);

  // Compose video handler
  const handleCompose = useCallback(async () => {
    if (!videoTemplate || !rawVideoUri) return;
    setComposing(true);
    setComposeError(null);
    setProgress({ phase: '준비 중...', percent: 0 });
    try {
      const clips = await buildClips();
      if (!clips.length) throw new Error('클립을 불러올 수 없습니다');
      const blob = await composeVideo(videoTemplate, clips, (p) => setProgress(p));
      const url  = URL.createObjectURL(blob);
      setComposedUri(url);
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : '합성 실패');
    } finally {
      setComposing(false);
    }
  }, [videoTemplate, rawVideoUri, buildClips]);

  // Save session handler
  const handleSave = useCallback(async () => {
    if (!userId || !activeTemplate) {
      Alert.alert('오류', '로그인이 필요합니다.');
      return;
    }
    setSaving(true);
    try {
      let editedUri: string | null = null;
      if (frameTags.length > 0) {
        try { editedUri = await requestAutoEdit(rawVideoUri, frameTags); } catch { /* ignore */ }
      }
      const session = await createSession({
        user_id:          userId,
        template_id:      activeTemplate.id,
        avg_score:        stats.avgScore,
        success_rate:     stats.successRate,
        tag_timeline:     frameTags,
        video_url:        rawVideoUri || null,
        edited_video_url: composedUri || editedUri,
      });
      setLastSession(session);

      const currentProfile = await fetchUserProfile(userId);
      await upsertUserProfile({
        user_id:          userId,
        preferred_genres: [
          ...(currentProfile?.preferred_genres ?? []),
          activeTemplate.genre,
        ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
        success_rates: {
          ...(currentProfile?.success_rates ?? {}),
          [activeTemplate.id]: stats.successRate,
        },
        total_sessions: (currentProfile?.total_sessions ?? 0) + 1,
        weak_joints:    currentProfile?.weak_joints ?? [],
      });
      setSaved(true);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }, [userId, activeTemplate, frameTags, rawVideoUri, composedUri, stats]);

  const goHome = useCallback(() => {
    if (composedUri) URL.revokeObjectURL(composedUri);
    reset();
    router.replace('/(main)/home');
  }, [reset, composedUri]);

  const doRetake = useCallback(() => {
    if (composedUri) URL.revokeObjectURL(composedUri);
    reset();
    router.replace('/(main)/record');
  }, [reset, composedUri]);

  const scoreGrade =
    stats.avgScore >= 0.8 ? '🌟🌟🌟 완벽해요!' :
    stats.avgScore >= 0.6 ? '⭐⭐ 잘했어요!'   :
    stats.avgScore >= 0.4 ? '⭐ 노력해봐요!'    : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>
          {activeTemplate?.theme_emoji ?? '🎬'} 챌린지 완료!
        </Text>
        {activeTemplate && (
          <Text style={styles.subtitle}>{activeTemplate.name}</Text>
        )}

        {/* Score card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreMain}>{Math.round(stats.avgScore * 100)}</Text>
          <Text style={styles.scoreLabel}>평균 점수</Text>
          <Text style={styles.successRate}>
            성공률 {Math.round(stats.successRate * 100)}%
          </Text>
          {scoreGrade ? <Text style={styles.starRating}>{scoreGrade}</Text> : null}
        </View>

        {/* Tag distribution */}
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

        {/* ── VIDEO TEMPLATE / COMPOSE SECTION ─────── */}
        {videoTemplate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎬 CapCut 스타일 완성 영상</Text>

            <View style={styles.vtMeta}>
              <Text style={styles.vtMetaText}>
                {videoTemplate.name} · {videoTemplate.clip_slots.length}개 클립 슬롯 · {Math.round(videoTemplate.duration_ms / 1000)}초
              </Text>
              <View style={styles.vtHashtags}>
                {videoTemplate.hashtags.map((h) => (
                  <View key={h} style={styles.hashChip}>
                    <Text style={styles.hashChipText}>#{h}</Text>
                  </View>
                ))}
              </View>
            </View>

            {!composedUri && !composing && (
              <TouchableOpacity
                style={styles.composeBtn}
                onPress={handleCompose}
                activeOpacity={0.85}
                disabled={!rawVideoUri}
              >
                <Text style={styles.composeBtnText}>✨ 완성 영상 만들기</Text>
              </TouchableOpacity>
            )}

            {composing && (
              <View style={styles.progressBox}>
                <Text style={styles.progressPhase}>{progress?.phase ?? '처리 중...'}</Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress?.percent ?? 0}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.progressPct}>
                  {Math.round(progress?.percent ?? 0)}%
                </Text>
                <ActivityIndicator size="small" color="#e94560" />
              </View>
            )}

            {composeError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>⚠️ {composeError}</Text>
                <TouchableOpacity style={styles.retrySmallBtn} onPress={handleCompose}>
                  <Text style={styles.retrySmallText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {composedUri && (
              <View style={styles.videoPreviewBox}>
                {typeof document !== 'undefined' && (
                  <video
                    src={composedUri}
                    controls
                    playsInline
                    style={{
                      width: '100%',
                      maxHeight: 420,
                      borderRadius: 12,
                      background: '#000',
                      display: 'block',
                    }}
                  />
                )}
                <Text style={styles.videoPreviewLabel}>완성 영상 미리보기</Text>

                <View style={styles.videoActions}>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => doDownload(composedUri, activeTemplate?.name ?? 'challenge')}
                  >
                    <Text style={styles.downloadBtnText}>⬇ 다운로드</Text>
                  </TouchableOpacity>

                  {activeTemplate && (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() =>
                        doShare(composedUri, rawVideoUri, activeTemplate, stats.avgScore).then(
                          () => setShared(true),
                        )
                      }
                    >
                      <Text style={styles.shareBtnText}>📤 SNS 공유</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {shared && (
                  <Text style={styles.sharedHint}>공유 또는 클립보드 복사 완료!</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── RAW VIDEO SHARE (before composing) ──── */}
        {activeTemplate && !composedUri && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📤 원본 영상 공유</Text>
            <View style={styles.hashtagRow}>
              {activeTemplate.sns_template.hashtags.map((tag) => (
                <View key={tag} style={styles.hashtagChip}>
                  <Text style={styles.hashtagText}>#{tag}</Text>
                </View>
              ))}
            </View>
            <View style={styles.captionBox}>
              <Text style={styles.captionText}>
                {activeTemplate.sns_template.caption_template
                  .replace('{template_name}', activeTemplate.name)
                  .replace('{score}', String(Math.round(stats.avgScore * 100)))}
              </Text>
            </View>
            <View style={styles.videoActions}>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() =>
                  doShare('', rawVideoUri, activeTemplate, stats.avgScore).then(() =>
                    setShared(true),
                  )
                }
              >
                <Text style={styles.shareBtnText}>📤 공유하기</Text>
              </TouchableOpacity>
              {rawVideoUri !== '' && (
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => doDownload(rawVideoUri, activeTemplate.name)}
                >
                  <Text style={styles.downloadBtnText}>⬇ 다운로드</Text>
                </TouchableOpacity>
              )}
            </View>
            {shared && (
              <Text style={styles.sharedHint}>클립보드에 복사되었습니다!</Text>
            )}
          </View>
        )}

        {/* ── SAVE SECTION ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 세션 저장</Text>
          {saved ? (
            <View style={styles.savedBox}>
              <Text style={styles.savedEmoji}>✅</Text>
              <Text style={styles.savedText}>저장 완료!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>💾 기록 저장하기</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── BOTTOM ACTIONS ──────────────────────────── */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={doRetake} activeOpacity={0.85}>
            <Text style={styles.retakeBtnText}>🔄 다시 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={goHome} activeOpacity={0.85}>
            <Text style={styles.homeBtnText}>🏠 홈으로</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0a0a1a' },
  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 16 },

  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },

  // Score card
  scoreCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  scoreMain:   { color: '#e94560', fontSize: 80, fontWeight: '900', lineHeight: 88 },
  scoreLabel:  { color: '#9ca3af', fontSize: 14, marginBottom: 4 },
  successRate: { color: '#4caf50', fontSize: 18, fontWeight: '700' },
  starRating:  { fontSize: 16, marginTop: 6, color: '#ffd700' },

  // Tag row
  tagRow: { flexDirection: 'row', gap: 8 },
  tagCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  tagCount: { fontSize: 30, fontWeight: '900' },
  tagLabel: { color: '#6b7280', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },

  // Sections
  section: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Video template meta
  vtMeta:    { gap: 8 },
  vtMetaText:{ color: '#94a3b8', fontSize: 13 },
  vtHashtags:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashChip:  { backgroundColor: '#1e3a5f', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  hashChipText: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },

  // Compose
  composeBtn: {
    // @ts-ignore web gradient
    background: 'linear-gradient(135deg, #e94560, #764ba2)',
    backgroundColor: '#e94560',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 58,
    justifyContent: 'center',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  composeBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },

  // Progress
  progressBox:   { alignItems: 'center', gap: 10, padding: 8 },
  progressPhase: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#e94560', borderRadius: 4 },
  progressPct:     { color: '#9ca3af', fontSize: 13 },

  // Error
  errorBox: {
    backgroundColor: '#2d1515',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  errorBoxText:   { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
  retrySmallBtn:  { backgroundColor: '#e94560', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  retrySmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Video preview
  videoPreviewBox:   { gap: 10 },
  videoPreviewLabel: { color: '#9ca3af', fontSize: 12, textAlign: 'center' },
  videoActions:      { flexDirection: 'row', gap: 10 },

  // SNS / raw share
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashtagChip: {
    backgroundColor: 'rgba(233,69,96,0.13)',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hashtagText: { color: '#e94560', fontSize: 12, fontWeight: '600' },
  captionBox:  { backgroundColor: '#0a0a1a', borderRadius: 10, padding: 12 },
  captionText: { color: '#9ca3af', fontSize: 13, lineHeight: 20 },
  sharedHint:  { color: '#4caf50', fontSize: 12, textAlign: 'center', fontWeight: '600' },

  // Share / download
  shareBtn: {
    flex: 1,
    backgroundColor: '#1877f2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  downloadBtnText: { color: '#9ca3af', fontSize: 14, fontWeight: '700' },

  // Save
  saveBtn: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  saveBtnDisabled: { backgroundColor: '#374151', shadowOpacity: 0 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  savedBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  savedEmoji:      { fontSize: 24 },
  savedText:       { color: '#4caf50', fontSize: 16, fontWeight: '700' },

  // Bottom actions
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  retakeBtnText: { color: '#e2e8f0', fontSize: 15, fontWeight: '800' },
  homeBtn: {
    flex: 1,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  homeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
