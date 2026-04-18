/**
 * result/index.tsx
 *
 * 촬영 완료 후 결과 화면 — CapCut 스타일 비디오 합성 + SNS 공유
 *
 * 기능:
 *  1. 세션 요약 (평균 점수, 성공률, Perfect/Good/Fail 분포)
 *  2. 템플릿 다이어그램 미리보기 (합성 전)
 *  3. "완성 영상 만들기" → composeVideo() → 합성 진행바 → 완성 영상 미리보기
 *  4. 합성 영상 다운로드 (webm)
 *  5. SNS 공유 (Web Share API with blob / 클립보드 폴백)
 *  6. 플랫폼별 직접 공유 버튼 (Twitter/Facebook/Instagram/YouTube)
 *  7. 해시태그 칩 + 캡션 미리보기
 *  8. Supabase 세션 저장
 *  9. "다시 촬영" 버튼
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useUserStore } from '../../../store/userStore';
import {
  createSession,
  upsertUserProfile,
  fetchUserProfile,
} from '../../../services/supabase';
import { requestAutoEdit } from '../../../services/api';
import { composeVideo, type CompositorProgress } from '../../../utils/videoCompositor';
import { getVideoTemplate, VIDEO_TEMPLATES } from '../../../utils/videoTemplates';
import type { JudgementTag } from '../../../types/session';
import type { RecordedClip } from '../../../utils/videoCompositor';

const TAG_COLORS: Record<JudgementTag, string> = {
  perfect: '#4caf50',
  good: '#ffc107',
  fail: '#ff6b6b',
};

// ─── Platform share helper ────────────────────────────────────────────────────

function openPlatformShare(platform: string, text: string, videoUri?: string): void {
  const encoded = encodeURIComponent(text);
  const urls: Record<string, string> = {
    twitter:   'https://twitter.com/intent/tweet?text=' + encoded,
    facebook:  'https://www.facebook.com/sharer/sharer.php?u=' +
                encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '') +
                '&quote=' + encoded,
    instagram: 'https://www.instagram.com/',
    youtube:   'https://studio.youtube.com/',
  };
  if (typeof window !== 'undefined' && urls[platform]) {
    window.open(urls[platform], '_blank');
  }
}

// ─── Share function (Web Share API with blob + clipboard fallback) ────────────

async function doShare(
  composedBlob: Blob | null,
  rawUri: string,
  template: any,
  avgScore: number,
): Promise<string> {
  const caption = template.sns_template?.caption_template
    ? template.sns_template.caption_template
        .replace('{template_name}', template.name)
        .replace('{score}', String(Math.round(avgScore * 100)))
    : `${template.name ?? ''} 챌린지 완성! 🎉 점수 ${Math.round(avgScore * 100)}점!`;
  const ht = (template.sns_template?.hashtags ?? template.hashtags ?? []) as string[];
  const fullText = caption + '\n' + ht.map((h: string) => '#' + h).join(' ');

  // Mobile: try sharing the video file directly (works on iOS Safari, Android Chrome)
  if (composedBlob && navigator?.share) {
    try {
      const file = new File([composedBlob], 'challenge.webm', {
        type: composedBlob.type || 'video/webm',
      });
      if ((navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: template.name ?? '챌린지', text: fullText });
        return 'shared';
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }

  // Desktop / text-only fallback: clipboard
  try {
    await navigator.clipboard.writeText(fullText);
    return 'copied';
  } catch { /* ignore */ }

  return 'none';
}

// ─── Download helper ──────────────────────────────────────────────────────────

function doDownload(uri: string, name: string): void {
  if (typeof window === 'undefined' || !uri) return;
  const a = document.createElement('a');
  a.href = uri;
  a.download = `${name}_챌린지.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    videoUri: string;
    videoTemplateId?: string;
    clipsJson?: string;
  }>();

  const rawVideoUri    = params.videoUri ?? '';
  const videoTemplateId = params.videoTemplateId ?? '';

  const { frameTags, activeTemplate, setLastSession, reset } = useSessionStore();
  const { userId } = useUserStore();

  // Composed video state
  const [composedUri,  setComposedUri]  = useState<string | null>(null);
  const [composedBlob, setComposedBlob] = useState<Blob | null>(null);
  const [composing,    setComposing]    = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [progress,     setProgress]     = useState<CompositorProgress | null>(null);

  // Saving / sharing state
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [shared, setShared] = useState(false);
  const [shareResult, setShareResult] = useState<string>('');

  // Stats
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

  // Resolve video template
  const videoTemplate = useMemo(() => {
    if (videoTemplateId) return getVideoTemplate(videoTemplateId);
    if (activeTemplate) {
      const genreMap: Record<string, string> = {
        daily:   'vt-vlog',
        news:    'vt-news',
        kpop:    'vt-kpop',
        english: 'vt-english',
        kids:    'vt-fairy',
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
      slot_id: slot.id,
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
      setComposedBlob(blob);
      const url = URL.createObjectURL(blob);
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
        user_id: userId,
        template_id: activeTemplate.id,
        avg_score: stats.avgScore,
        success_rate: stats.successRate,
        tag_timeline: frameTags,
        video_url: rawVideoUri || null,
        edited_video_url: composedUri || editedUri,
      });
      setLastSession(session);

      const currentProfile = await fetchUserProfile(userId);
      await upsertUserProfile({
        user_id: userId,
        preferred_genres: [
          ...(currentProfile?.preferred_genres ?? []),
          activeTemplate.genre,
        ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
        success_rates: {
          ...(currentProfile?.success_rates ?? {}),
          [activeTemplate.id]: stats.successRate,
        },
        total_sessions: (currentProfile?.total_sessions ?? 0) + 1,
        weak_joints: currentProfile?.weak_joints ?? [],
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

  const scoreNum = Math.round(stats.avgScore * 100);
  const scoreGrade =
    stats.avgScore >= 0.8 ? '🌟🌟🌟 완벽해요!' :
    stats.avgScore >= 0.6 ? '⭐⭐ 잘했어요!' :
    stats.avgScore >= 0.4 ? '⭐ 노력해봐요!' : null;

  const scoreAccentColor =
    stats.avgScore >= 0.8 ? '#7C3AED' :
    stats.avgScore >= 0.6 ? '#ff9800' : '#e94560';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goHome} style={styles.backIconBtn}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {activeTemplate?.theme_emoji ?? '🎬'} 챌린지 완료!
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {activeTemplate && (
          <Text style={styles.subtitle}>{activeTemplate.name}</Text>
        )}

        {/* Score card */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreAccentBar, { backgroundColor: scoreAccentColor }]} />
          <View style={styles.scoreCardBody}>
            <Text style={[styles.scoreMain, { color: scoreAccentColor }]}>{scoreNum}</Text>
            <Text style={styles.scoreLabel}>평균 점수</Text>
            <View style={styles.successRateRow}>
              <Text style={styles.successRateText}>
                성공률 {Math.round(stats.successRate * 100)}%
              </Text>
            </View>
            {scoreGrade ? <Text style={styles.starRating}>{scoreGrade}</Text> : null}
          </View>
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

        {/* VIDEO COMPOSE SECTION */}
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

            {/* ── TEMPLATE DIAGRAM (shown before composing) ── */}
            {!composedUri && !composing && videoTemplate && (
              <View style={styles.templateDiagram}>
                <Text style={styles.templateDiagramTitle}>🎬 {videoTemplate.name} 템플릿</Text>
                <Text style={styles.templateDiagramDesc}>{videoTemplate.description}</Text>
                <View style={[styles.diagramBox, { backgroundColor: videoTemplate.gradientColors[0] + '22' }]}>
                  <View style={styles.diagTop}>
                    <Text style={styles.diagTopText}>📺 상단 타이틀 존</Text>
                  </View>
                  <View style={styles.diagCenter}>
                    <Text style={styles.diagCenterIcon}>🎬</Text>
                    <Text style={styles.diagCenterText}>내 챌린지 영상</Text>
                    <Text style={styles.diagCenterSub}>(촬영본이 이 위치에 삽입)</Text>
                  </View>
                  <View style={styles.diagBottom}>
                    <Text style={styles.diagBottomText}>▶ 해시태그 스크롤 바</Text>
                  </View>
                </View>
                <View style={styles.diagFeatures}>
                  <Text style={styles.diagFeature}>🎨 배경: 전용 그라디언트 디자인</Text>
                  <Text style={styles.diagFeature}>🎵 BGM: {videoTemplate.bgm.genre} 스타일 배경음</Text>
                  <Text style={styles.diagFeature}>📝 자막: {videoTemplate.text_overlays.length}개 자동 삽입</Text>
                  <Text style={styles.diagFeature}>📱 크기: 720×1280 (Instagram/TikTok 최적)</Text>
                </View>
              </View>
            )}

            {!composedUri && !composing && (
              <View style={styles.composeSection}>
                <Text style={styles.composeSectionTitle}>🎬 CapCut 스타일 완성 영상 만들기</Text>
                <Text style={styles.composeDesc}>
                  촬영한 영상 + 사전 제작 템플릿을 합성하여{'\n'}
                  고퀄리티 SNS 영상을 완성합니다
                </Text>
                <View style={styles.templateInfoCard}>
                  <Text style={styles.templateInfoTitle}>📋 {videoTemplate.name}</Text>
                  <Text style={styles.templateInfoDesc}>{videoTemplate.description}</Text>
                  <Text style={styles.templateInfoTime}>
                    ⏱ 합성 소요 시간: 약 {Math.round(videoTemplate.duration_ms / 1000)}초
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.composeBtn, !rawVideoUri && styles.composeBtnDisabled]}
                  onPress={handleCompose}
                  disabled={!rawVideoUri}
                  activeOpacity={0.85}
                >
                  <Text style={styles.composeBtnText}>✨ 완성 영상 만들기</Text>
                </TouchableOpacity>
                {!rawVideoUri && (
                  <Text style={styles.noVideoHint}>먼저 챌린지를 녹화해주세요</Text>
                )}
              </View>
            )}

            {composing && (
              <View style={styles.composingSection}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.composingTitle}>🎬 영상 합성 중...</Text>
                <Text style={styles.composingDesc}>{progress?.phase ?? '준비 중...'}</Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress?.percent ?? 0}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.composingPct}>{Math.round(progress?.percent ?? 0)}% 완료</Text>
                <Text style={styles.composingNote}>
                  📌 실시간 처리 방식입니다 — 영상 길이만큼 소요됩니다
                </Text>
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
              <View style={styles.videoPreviewSection}>
                <Text style={styles.videoPreviewTitle}>🎉 완성 영상</Text>
                {/* @ts-ignore */}
                <video
                  src={composedUri}
                  controls
                  playsInline
                  style={{
                    width: '100%',
                    maxHeight: 400,
                    borderRadius: 16,
                    display: 'block',
                    background: '#000',
                  }}
                />
                <View style={styles.videoActionRow}>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => doDownload(composedUri, activeTemplate?.name ?? 'challenge')}
                  >
                    <Text style={styles.downloadBtnText}>⬇ 다운로드</Text>
                  </TouchableOpacity>
                  {activeTemplate && (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={async () => {
                        const result = await doShare(composedBlob, rawVideoUri, activeTemplate, stats.avgScore);
                        setShared(true);
                        setShareResult(result);
                        if (result === 'copied') {
                          Alert.alert('클립보드에 복사됨!', '캡션이 복사되었습니다. SNS에 붙여넣으세요!');
                        }
                      }}
                    >
                      <Text style={styles.shareBtnText}>📤 SNS 공유</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {shared && (
                  <Text style={styles.sharedText}>
                    {shareResult === 'shared' ? '✅ 공유 완료!' :
                     shareResult === 'copied' ? '✅ 클립보드에 복사됨!' :
                     shareResult === 'cancelled' ? '공유가 취소되었습니다.' :
                     '✅ 공유 또는 복사 완료!'}
                  </Text>
                )}
              </View>
            )}

            {/* ── PLATFORM SHARE BUTTONS (shown after composedUri is ready) ── */}
            {composedUri && (
              <View style={styles.platformRow}>
                <Text style={styles.platformLabel}>📤 SNS에 공유하기</Text>
                <View style={styles.platformBtns}>
                  {[
                    { key: 'twitter',   label: '𝕏 Twitter',   color: '#000' },
                    { key: 'facebook',  label: 'f Facebook',   color: '#1877f2' },
                    { key: 'instagram', label: '📸 Instagram', color: '#e1306c' },
                    { key: 'youtube',   label: '▶ YouTube',    color: '#ff0000' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      style={[styles.platformBtn, { backgroundColor: p.color }]}
                      onPress={() => {
                        const text =
                          (activeTemplate?.name ?? '챌린지') +
                          ' 완성! ' +
                          (
                            activeTemplate?.sns_template?.hashtags ??
                            []
                          )
                            .map((h: string) => '#' + h)
                            .join(' ');
                        openPlatformShare(p.key, text, composedUri ?? undefined);
                      }}
                    >
                      <Text style={styles.platformBtnText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.platformHint}>
                  💡 다운로드 후 Instagram/YouTube에 직접 업로드 가능합니다
                </Text>
              </View>
            )}
          </View>
        )}

        {/* RAW VIDEO SHARE (before composing) */}
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
            <View style={styles.videoActionRow}>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={async () => {
                  const result = await doShare(null, rawVideoUri, activeTemplate, stats.avgScore);
                  setShared(true);
                  setShareResult(result);
                  if (result === 'copied') {
                    Alert.alert('클립보드에 복사됨!', '캡션이 복사되었습니다. SNS에 붙여넣으세요!');
                  }
                }}
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
            {shared && !composedUri && (
              <Text style={styles.sharedText}>
                {shareResult === 'copied' ? '클립보드에 복사되었습니다!' : '✅ 공유 완료!'}
              </Text>
            )}
          </View>
        )}

        {/* SAVE SECTION */}
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

        {/* BOTTOM ACTIONS */}
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
  root: { flex: 1, backgroundColor: '#F7F8FC' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backIconText: { fontSize: 20, color: '#333', fontWeight: '700' },

  title: {
    color: '#1a1a2e',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
  },
  subtitle: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -8,
  },

  // Score card
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    flexDirection: 'row',
  },
  scoreAccentBar: {
    width: 6,
    borderRadius: 0,
  },
  scoreCardBody: {
    flex: 1,
    alignItems: 'center',
    padding: 28,
    gap: 4,
  },
  scoreMain: { fontSize: 80, fontWeight: '900', lineHeight: 88 },
  scoreLabel: { color: '#999', fontSize: 14, marginBottom: 4 },
  successRateRow: {
    backgroundColor: '#F0FFF4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  successRateText: { color: '#2e7d32', fontSize: 16, fontWeight: '700' },
  starRating: { fontSize: 16, marginTop: 6, color: '#1a1a2e', fontWeight: '700' },

  // Tag row
  tagRow: { flexDirection: 'row', gap: 10 },
  tagCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tagCount: { fontSize: 30, fontWeight: '900' },
  tagLabel: { color: '#999', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },

  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { color: '#1a1a2e', fontSize: 16, fontWeight: '800' },

  // Video template meta
  vtMeta: { gap: 8 },
  vtMetaText: { color: '#666', fontSize: 13 },
  vtHashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashChip: {
    backgroundColor: '#EDE9FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hashChipText: { color: '#7C3AED', fontSize: 12, fontWeight: '600' },

  // Template diagram
  templateDiagram: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  templateDiagramTitle: { color: '#1a1a2e', fontSize: 16, fontWeight: '800' },
  templateDiagramDesc: { color: '#6b7280', fontSize: 13 },
  diagramBox: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  diagTop: { backgroundColor: '#4f46e5', padding: 10, alignItems: 'center' },
  diagTopText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  diagCenter: {
    backgroundColor: '#111',
    padding: 20,
    alignItems: 'center',
    gap: 4,
    minHeight: 100,
    justifyContent: 'center',
  },
  diagCenterIcon: { fontSize: 32 },
  diagCenterText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  diagCenterSub: { color: '#9ca3af', fontSize: 11 },
  diagBottom: { backgroundColor: '#312e81', padding: 8, alignItems: 'center' },
  diagBottomText: { color: '#c4b5fd', fontSize: 11 },
  diagFeatures: { gap: 4 },
  diagFeature: { color: '#374151', fontSize: 12 },

  // Compose section (pre-compose)
  composeSection: {
    gap: 12,
  },
  composeSectionTitle: {
    color: '#1a1a2e',
    fontSize: 15,
    fontWeight: '800',
  },
  composeDesc: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
  },
  templateInfoCard: {
    backgroundColor: '#F7F4FF',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  templateInfoTitle: {
    color: '#5B21B6',
    fontSize: 14,
    fontWeight: '800',
  },
  templateInfoDesc: {
    color: '#7C3AED',
    fontSize: 12,
    lineHeight: 18,
  },
  templateInfoTime: {
    color: '#6D28D9',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  composeBtn: {
    // @ts-ignore web gradient
    background: 'linear-gradient(135deg, #7C3AED, #9b59b6)',
    backgroundColor: '#7C3AED',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 58,
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  composeBtnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  composeBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  noVideoHint: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Composing section (in-progress)
  composingSection: {
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  composingTitle: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  composingDesc: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: '#F0EFFF',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 5,
  },
  composingPct: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },
  composingNote: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
  },

  // Error
  errorBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  errorBoxText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },
  retrySmallBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retrySmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Video preview section (post-compose)
  videoPreviewSection: {
    gap: 12,
  },
  videoPreviewTitle: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '800',
  },
  videoActionRow: { flexDirection: 'row', gap: 10 },
  sharedText: {
    color: '#2e7d32',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Platform share buttons
  platformRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  platformLabel: { color: '#1a1a2e', fontSize: 15, fontWeight: '800' },
  platformBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  platformBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  platformHint: { color: '#9ca3af', fontSize: 11 },

  // SNS / raw share
  hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashtagChip: {
    backgroundColor: '#EDE9FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hashtagText: { color: '#7C3AED', fontSize: 12, fontWeight: '600' },
  captionBox: { backgroundColor: '#F7F8FC', borderRadius: 10, padding: 12 },
  captionText: { color: '#666', fontSize: 13, lineHeight: 20 },

  // Share / download
  shareBtn: {
    flex: 1,
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    borderWidth: 1.5,
    borderColor: '#E0E0E8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  downloadBtnText: { color: '#555', fontSize: 14, fontWeight: '700' },

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
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#ccc', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  savedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  savedEmoji: { fontSize: 24 },
  savedText: { color: '#059669', fontSize: 16, fontWeight: '700' },

  // Bottom actions
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E8',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  retakeBtnText: { color: '#333', fontSize: 15, fontWeight: '800' },
  homeBtn: {
    flex: 1,
    // @ts-ignore web gradient
    background: 'linear-gradient(135deg, #7C3AED, #9b59b6)',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  homeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
