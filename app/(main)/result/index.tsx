/**
 * result/index.tsx — 챌린지 완료 & CapCut 스타일 영상 합성 화면
 *
 * 🎮 최신 게임/캡컷 수준 UI:
 *   - 애니메이션 스코어 카운터 (숫자 올라가는 효과)
 *   - 파티클 confetti 축하 효과
 *   - 7레이어 템플릿 합성 (ClipArea 개념)
 *   - Web Share API (파일 공유) + 플랫폼별 버튼
 *   - Glassmorphism 카드 디자인
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
  Animated,
  useWindowDimensions,
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

// ─── Types ────────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<JudgementTag, string> = {
  perfect: '#22c55e',
  good:    '#f59e0b',
  fail:    '#ef4444',
};

const TAG_LABELS: Record<JudgementTag, string> = {
  perfect: 'PERFECT',
  good:    'GOOD',
  fail:    'MISS',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openPlatformShare(platform: string, text: string): void {
  const enc = encodeURIComponent(text);
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const urls: Record<string, string> = {
    twitter:   `https://twitter.com/intent/tweet?text=${enc}`,
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}&quote=${enc}`,
    instagram: 'https://www.instagram.com/',
    youtube:   'https://studio.youtube.com/',
    tiktok:    'https://www.tiktok.com/upload',
  };
  if (typeof window !== 'undefined' && urls[platform]) {
    window.open(urls[platform], '_blank');
  }
}

async function doShare(
  composedBlob: Blob | null,
  rawUri: string,
  templateName: string,
  hashtags: string[],
  caption: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'none'> {
  const fullText = caption + '\n' + hashtags.map(h => '#' + h).join(' ');

  if (composedBlob && navigator?.share) {
    try {
      const file = new File([composedBlob], 'challenge.webm', { type: composedBlob.type || 'video/webm' });
      if ((navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: templateName, text: fullText });
        return 'shared';
      }
      // text-only share
      await navigator.share({ title: templateName, text: fullText });
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    await navigator.clipboard.writeText(fullText);
    return 'copied';
  } catch { /* ignore */ }
  return 'none';
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

// ─── Score Counter Animation ──────────────────────────────────────────────────

function AnimatedScore({ targetScore, color }: { targetScore: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Count-up animation
    let start = 0;
    const step = Math.ceil(targetScore / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= targetScore) { setDisplayed(targetScore); clearInterval(timer); }
      else setDisplayed(start);
    }, 30);

    // Scale in
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(opacAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => clearInterval(timer);
  }, [targetScore]);

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
      <Text style={[sc.scoreNum, { color }]}>{displayed}</Text>
      <Text style={sc.scoreLabel}>점</Text>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  scoreNum: { fontSize: 88, fontWeight: '900', lineHeight: 96, letterSpacing: -2 },
  scoreLabel: { fontSize: 16, color: '#999', fontWeight: '600', marginTop: -4 },
});

// ─── Confetti Particle ────────────────────────────────────────────────────────

function Confetti({ show }: { show: boolean }) {
  const items = useMemo(() =>
    ['🎉','🎊','⭐','✨','🌟','💫','🎈','🎁','🔥','💥'].map((e, i) => ({
      emoji: e,
      left: `${5 + i * 9}%`,
      delay: i * 120,
    })),
  []);

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item, i) => (
        <Text
          key={i}
          style={[
            conf.item,
            { left: item.left as any },
            // @ts-ignore web
            { animationDelay: `${item.delay}ms` },
          ]}
        >
          {item.emoji}
        </Text>
      ))}
    </View>
  );
}

const conf = StyleSheet.create({
  item: {
    position: 'absolute',
    top: -20,
    fontSize: 28,
    zIndex: 100,
    // @ts-ignore web
    animation: 'confettiFall 2s ease-in forwards',
  },
});

// ─── Template Preview Card ────────────────────────────────────────────────────

function TemplatePreview({ vtId, genre }: { vtId: string; genre: string }) {
  const vt = getVideoTemplate(vtId);
  if (!vt) return null;

  const colors = vt.gradientColors;

  return (
    <View style={tp.wrap}>
      <Text style={tp.label}>🎬 적용될 영상 템플릿</Text>
      <View style={tp.card}>
        {/* Top zone */}
        <View style={[tp.topZone, { backgroundColor: colors[0] }]}>
          <Text style={tp.topText}>{vt.topZone?.text ?? '상단 타이틀'}</Text>
          {vt.topZone?.subtext && <Text style={tp.topSub}>{vt.topZone.subtext}</Text>}
        </View>
        {/* Clip area visualization */}
        <View
          style={[
            tp.clipArea,
            {
              // @ts-ignore web
              background: `linear-gradient(180deg, ${colors[0]}22, ${colors[1]}22)`,
              backgroundColor: colors[0] + '22',
              borderColor: colors[0] + '66',
            },
          ]}
        >
          <Text style={tp.clipIcon}>🎬</Text>
          <Text style={tp.clipTitle}>내 챌린지 영상</Text>
          <Text style={tp.clipSub}>촬영본이 이 위치에 삽입됩니다</Text>
        </View>
        {/* Bottom zone */}
        <View style={[tp.bottomZone, { backgroundColor: colors[1] }]}>
          <Text style={tp.bottomText} numberOfLines={1}>
            {vt.bottomZone?.text ?? '해시태그 스크롤'}
          </Text>
        </View>
      </View>
      {/* Features */}
      <View style={tp.feats}>
        <View style={tp.featRow}>
          <Text style={tp.feat}>🎨 {vt.name} 전용 디자인</Text>
          <Text style={tp.feat}>🎵 {vt.bgm.genre} BGM 내장</Text>
        </View>
        <View style={tp.featRow}>
          <Text style={tp.feat}>📝 자막 {vt.text_overlays.length}개 자동 삽입</Text>
          <Text style={tp.feat}>📱 720×1280 (9:16 최적화)</Text>
        </View>
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  wrap: { gap: 12 },
  label: { fontSize: 14, fontWeight: '800', color: '#374151' },
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  topZone: { padding: 12, alignItems: 'center' },
  topText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  topSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  clipArea: {
    minHeight: 100, alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: 16, borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#e5e7eb',
  },
  clipIcon: { fontSize: 32 },
  clipTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  clipSub:   { fontSize: 11, color: '#9ca3af' },
  bottomZone: { padding: 8, alignItems: 'center' },
  bottomText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  feats: { gap: 6 },
  featRow: { flexDirection: 'row', gap: 10 },
  feat: { flex: 1, fontSize: 12, color: '#6b7280', fontWeight: '500' },
});

// ─── Platform buttons ─────────────────────────────────────────────────────────

const PLATFORMS = [
  { key: 'instagram', label: '📸 Instagram', color: '#c13584' },
  { key: 'tiktok',    label: '🎵 TikTok',    color: '#010101' },
  { key: 'youtube',   label: '▶ YouTube',    color: '#ff0000' },
  { key: 'twitter',   label: '𝕏 Twitter',   color: '#000000' },
  { key: 'facebook',  label: 'f Facebook',   color: '#1877f2' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const router  = useRouter();
  const { width } = useWindowDimensions();
  const params  = useLocalSearchParams<{ videoUri: string; videoTemplateId?: string }>();

  const rawVideoUri     = params.videoUri ?? '';
  const videoTemplateId = params.videoTemplateId ?? '';

  const frameTags      = useSessionStore(s => s.frameTags);
  const activeTemplate = useSessionStore(s => s.activeTemplate);
  const setLastSession = useSessionStore(s => s.setLastSession);
  const reset          = useSessionStore(s => s.reset);
  const { userId }     = useUserStore();

  // Composed video
  const [composedUri,  setComposedUri]  = useState<string | null>(null);
  const [composedBlob, setComposedBlob] = useState<Blob | null>(null);
  const [composing,    setComposing]    = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [progress,     setProgress]     = useState<CompositorProgress | null>(null);

  // UX state
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [shareResult, setShareResult] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(cardsAnim,  { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    // Show confetti if good score
    const avg = frameTags.length
      ? frameTags.reduce((s, f) => s + f.score, 0) / frameTags.length
      : 0;
    if (avg >= 0.6) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, []);

  // Stats
  const stats = useMemo(() => {
    if (!frameTags.length) return { avgScore: 0, successRate: 0, counts: { perfect: 0, good: 0, fail: 0 } };
    const total = frameTags.length;
    const avgScore = frameTags.reduce((s, f) => s + f.score, 0) / total;
    const counts: Record<JudgementTag, number> = { perfect: 0, good: 0, fail: 0 };
    frameTags.forEach(f => counts[f.tag]++);
    const successRate = (counts.perfect + counts.good) / total;
    return { avgScore, successRate, counts };
  }, [frameTags]);

  // Resolve video template
  const videoTemplate = useMemo(() => {
    if (videoTemplateId) return getVideoTemplate(videoTemplateId);
    if (activeTemplate) {
      const map: Record<string, string> = {
        daily: 'vt-vlog', news: 'vt-news', kpop: 'vt-kpop',
        english: 'vt-english', kids: 'vt-fairy',
      };
      const vtId = map[activeTemplate.genre];
      if (vtId) return getVideoTemplate(vtId);
    }
    return VIDEO_TEMPLATES[0];
  }, [videoTemplateId, activeTemplate]);

  // Compose handler
  const handleCompose = useCallback(async () => {
    if (!videoTemplate || !rawVideoUri) return;
    setComposing(true);
    setComposeError(null);
    setProgress({ phase: '준비 중...', percent: 0 });
    try {
      const resp = await fetch(rawVideoUri);
      const blob = await resp.blob();
      const clips = videoTemplate.clip_slots.map(slot => ({
        slot_id: slot.id,
        blob,
        duration_ms: slot.end_ms - slot.start_ms,
      }));
      const resultBlob = await composeVideo(videoTemplate, clips, p => setProgress(p));
      setComposedBlob(resultBlob);
      setComposedUri(URL.createObjectURL(resultBlob));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : '합성 실패');
    } finally {
      setComposing(false);
    }
  }, [videoTemplate, rawVideoUri]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!userId || !activeTemplate) { Alert.alert('오류', '로그인이 필요합니다.'); return; }
    setSaving(true);
    try {
      let editedUri: string | null = null;
      try { editedUri = await requestAutoEdit(rawVideoUri, frameTags); } catch { /* ignore */ }
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
      const prof = await fetchUserProfile(userId);
      await upsertUserProfile({
        user_id: userId,
        preferred_genres: [...(prof?.preferred_genres ?? []), activeTemplate.genre]
          .filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
        success_rates: { ...(prof?.success_rates ?? {}), [activeTemplate.id]: stats.successRate },
        total_sessions: (prof?.total_sessions ?? 0) + 1,
        weak_joints: prof?.weak_joints ?? [],
      });
      setSaved(true);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }, [userId, activeTemplate, frameTags, rawVideoUri, composedUri, stats]);

  const handleShare = useCallback(async (blob: Blob | null) => {
    if (!activeTemplate) return;
    const caption = activeTemplate.sns_template.caption_template
      .replace('{template_name}', activeTemplate.name)
      .replace('{score}', String(Math.round(stats.avgScore * 100)));
    const result = await doShare(
      blob, rawVideoUri, activeTemplate.name,
      activeTemplate.sns_template.hashtags, caption,
    );
    setShareResult(result);
    if (result === 'copied') Alert.alert('📋 복사 완료!', '캡션이 클립보드에 복사되었습니다.');
  }, [activeTemplate, rawVideoUri, stats.avgScore]);

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

  const scoreNum   = Math.round(stats.avgScore * 100);
  const isHighScore = stats.avgScore >= 0.8;
  const accentColor =
    stats.avgScore >= 0.8 ? '#7c3aed' :
    stats.avgScore >= 0.6 ? '#f59e0b' : '#ef4444';

  const scoreGrade =
    stats.avgScore >= 0.8 ? '🏆 완벽해요!' :
    stats.avgScore >= 0.6 ? '🌟 잘했어요!' :
    stats.avgScore >= 0.4 ? '💪 노력해봐요!' : '다음엔 더 잘할 수 있어요!';

  return (
    <SafeAreaView style={st.root} edges={['top', 'bottom']}>
      {/* Confetti overlay */}
      <Confetti show={showConfetti} />

      {/* CSS injection for confetti animation */}
      {/* @ts-ignore */}
      {typeof window !== 'undefined' && (
        <style>{`
          @keyframes confettiFall {
            0%   { transform: translateY(0) rotate(0deg); opacity:1; }
            100% { transform: translateY(120vh) rotate(720deg); opacity:0; }
          }
        `}</style>
      )}

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingHorizontal: Math.min(20, (width - 360) / 2 + 16) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ─────────────────────────── */}
        <Animated.View
          style={[
            st.headerRow,
            { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-20, 0] }) }] },
          ]}
        >
          <TouchableOpacity onPress={goHome} style={st.backBtn}>
            <Text style={st.backText}>←</Text>
          </TouchableOpacity>
          <View style={st.headerCenter}>
            <Text style={st.headerTitle}>
              {activeTemplate?.theme_emoji ?? '🎬'} 챌린지 완료!
            </Text>
            {activeTemplate && <Text style={st.headerSub}>{activeTemplate.name}</Text>}
          </View>
          <View style={{ width: 44 }} />
        </Animated.View>

        {/* ── SCORE CARD ─────────────────────── */}
        <Animated.View
          style={[
            st.scoreCard,
            {
              opacity: cardsAnim,
              transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0,1], outputRange: [30, 0] }) }],
              // @ts-ignore web
              background: isHighScore
                ? `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`
                : undefined,
            },
          ]}
        >
          <View style={[st.scoreAccent, { backgroundColor: accentColor }]} />
          <View style={st.scoreBody}>
            <AnimatedScore targetScore={scoreNum} color={accentColor} />
            <View style={[st.gradeChip, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <Text style={[st.gradeText, { color: accentColor }]}>{scoreGrade}</Text>
            </View>
            <View style={st.successRow}>
              <Text style={st.successLabel}>성공률</Text>
              <View style={st.successBarBg}>
                <View style={[st.successBarFill, { width: `${Math.round(stats.successRate * 100)}%` as any, backgroundColor: accentColor }]} />
              </View>
              <Text style={[st.successPct, { color: accentColor }]}>{Math.round(stats.successRate * 100)}%</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── TAG DISTRIBUTION ───────────────── */}
        <View style={st.tagRow}>
          {(['perfect', 'good', 'fail'] as JudgementTag[]).map(tag => (
            <View key={tag} style={[st.tagCard, { borderTopColor: TAG_COLORS[tag] }]}>
              <Text style={[st.tagCount, { color: TAG_COLORS[tag] }]}>{stats.counts[tag]}</Text>
              <Text style={st.tagName}>{TAG_LABELS[tag]}</Text>
            </View>
          ))}
        </View>

        {/* ── VIDEO COMPOSE SECTION ──────────── */}
        {videoTemplate && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>🎬 CapCut 스타일 완성 영상</Text>

            {/* Template info chips */}
            <View style={st.vtChips}>
              <View style={st.vtChip}>
                <Text style={st.vtChipText}>📋 {videoTemplate.name}</Text>
              </View>
              <View style={st.vtChip}>
                <Text style={st.vtChipText}>⏱ {Math.round(videoTemplate.duration_ms / 1000)}초</Text>
              </View>
              <View style={st.vtChip}>
                <Text style={st.vtChipText}>🎵 {videoTemplate.bgm.genre}</Text>
              </View>
            </View>

            {/* Hashtags */}
            <View style={st.hashRow}>
              {videoTemplate.hashtags.slice(0, 6).map(h => (
                <View key={h} style={st.hashChip}>
                  <Text style={st.hashText}>#{h}</Text>
                </View>
              ))}
            </View>

            {/* Template diagram (before composing) */}
            {!composedUri && !composing && (
              <TemplatePreview vtId={videoTemplate.id} genre={activeTemplate?.genre ?? ''} />
            )}

            {/* Pre-compose CTA */}
            {!composedUri && !composing && (
              <View style={st.composeBlock}>
                <Text style={st.composeDesc}>
                  촬영한 영상 + {videoTemplate.name} 템플릿을 합성하여{'\n'}
                  Instagram / TikTok용 고퀄리티 영상을 완성합니다
                </Text>
                <TouchableOpacity
                  style={[st.composeBtn, !rawVideoUri && st.composeBtnDis]}
                  onPress={handleCompose}
                  disabled={!rawVideoUri}
                  activeOpacity={0.85}
                >
                  <Text style={st.composeBtnText}>✨ 완성 영상 만들기</Text>
                </TouchableOpacity>
                {!rawVideoUri && (
                  <Text style={st.noVideoHint}>먼저 챌린지를 녹화해주세요</Text>
                )}
              </View>
            )}

            {/* Composing progress */}
            {composing && (
              <View style={st.composingBlock}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={st.composingTitle}>🎬 영상 합성 중...</Text>
                <Text style={st.composingPhase}>{progress?.phase ?? '준비 중...'}</Text>
                <View style={st.progBg}>
                  <View style={[st.progFill, { width: `${progress?.percent ?? 0}%` as any }]} />
                </View>
                <Text style={st.progPct}>{Math.round(progress?.percent ?? 0)}%</Text>
                <Text style={st.composingNote}>
                  📌 실시간 처리 방식 — 영상 길이만큼 소요됩니다
                </Text>
              </View>
            )}

            {/* Error */}
            {composeError && (
              <View style={st.errorBox}>
                <Text style={st.errorText}>⚠️ {composeError}</Text>
                <TouchableOpacity style={st.retrySmall} onPress={handleCompose}>
                  <Text style={st.retrySmallText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Composed video preview */}
            {composedUri && (
              <View style={st.videoBlock}>
                <View style={st.videoTitleRow}>
                  <Text style={st.videoTitle}>🎉 완성 영상</Text>
                  <View style={[st.readyBadge, { backgroundColor: accentColor }]}>
                    <Text style={st.readyText}>완성!</Text>
                  </View>
                </View>
                {/* @ts-ignore */}
                <video
                  src={composedUri}
                  controls
                  playsInline
                  style={{
                    width: '100%',
                    maxHeight: 380,
                    borderRadius: 16,
                    display: 'block',
                    background: '#000',
                    // @ts-ignore
                    boxShadow: `0 8px 32px ${accentColor}44`,
                  }}
                />
                {/* Action row */}
                <View style={st.actionRow}>
                  <TouchableOpacity
                    style={st.downloadBtn}
                    onPress={() => doDownload(composedUri, activeTemplate?.name ?? 'challenge')}
                  >
                    <Text style={st.downloadText}>⬇ 다운로드</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.shareBtn, { backgroundColor: accentColor }]}
                    onPress={() => handleShare(composedBlob)}
                  >
                    <Text style={st.shareText}>📤 SNS 공유</Text>
                  </TouchableOpacity>
                </View>
                {shareResult !== '' && (
                  <Text style={st.shareResult}>
                    {shareResult === 'shared'    ? '✅ 공유 완료!' :
                     shareResult === 'copied'    ? '✅ 클립보드에 복사됨!' :
                     shareResult === 'cancelled' ? '공유가 취소되었습니다.' : ''}
                  </Text>
                )}
              </View>
            )}

            {/* Platform share buttons */}
            {composedUri && (
              <View style={st.platformBlock}>
                <Text style={st.platformTitle}>📤 직접 업로드하기</Text>
                <Text style={st.platformSub}>다운로드 후 각 플랫폼에 업로드하세요</Text>
                <View style={st.platformGrid}>
                  {PLATFORMS.map(p => (
                    <TouchableOpacity
                      key={p.key}
                      style={[st.platformBtn, { backgroundColor: p.color }]}
                      onPress={() => {
                        const caption = activeTemplate?.sns_template.caption_template
                          ?.replace('{template_name}', activeTemplate.name)
                          ?.replace('{score}', String(scoreNum)) ?? '';
                        const ht = (activeTemplate?.sns_template.hashtags ?? [])
                          .map(h => '#' + h).join(' ');
                        openPlatformShare(p.key, caption + ' ' + ht);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={st.platformBtnText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={st.platformNote}>
                  💡 영상을 다운로드한 후 Instagram 릴스, TikTok, YouTube 쇼츠에 직접 업로드할 수 있습니다
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── RAW SHARE (before compose) ───── */}
        {activeTemplate && !composedUri && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>📤 원본 영상 공유</Text>
            <View style={st.captionBox}>
              <Text style={st.captionText}>
                {activeTemplate.sns_template.caption_template
                  .replace('{template_name}', activeTemplate.name)
                  .replace('{score}', String(scoreNum))}
              </Text>
            </View>
            <View style={st.hashRow}>
              {activeTemplate.sns_template.hashtags.map(h => (
                <View key={h} style={st.hashChip}>
                  <Text style={st.hashText}>#{h}</Text>
                </View>
              ))}
            </View>
            <View style={st.actionRow}>
              <TouchableOpacity
                style={[st.shareBtn, { backgroundColor: '#7c3aed', flex: 1 }]}
                onPress={() => handleShare(null)}
              >
                <Text style={st.shareText}>📤 공유하기</Text>
              </TouchableOpacity>
              {rawVideoUri !== '' && (
                <TouchableOpacity
                  style={st.downloadBtn}
                  onPress={() => doDownload(rawVideoUri, activeTemplate.name)}
                >
                  <Text style={st.downloadText}>⬇ 원본</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── SAVE SECTION ───────────────────── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>💾 세션 저장</Text>
          {saved ? (
            <View style={st.savedRow}>
              <Text style={st.savedEmoji}>✅</Text>
              <Text style={st.savedText}>저장 완료! 기록에 남겨졌어요.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[st.saveBtn, saving && st.saveBtnDis]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={st.saveBtnText}>💾 내 기록 저장</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── BOTTOM ACTIONS ─────────────────── */}
        <View style={st.bottomRow}>
          <TouchableOpacity style={st.retakeBtn} onPress={doRetake} activeOpacity={0.85}>
            <Text style={st.retakeText}>🔄 다시 도전</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.homeBtn, { backgroundColor: accentColor }]} onPress={goHome} activeOpacity={0.85}>
            <Text style={st.homeText}>🏠 홈으로</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5F9' },
  scroll: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 80, gap: 14 },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  backText: { fontSize: 22, color: '#333', fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a2e', textAlign: 'center' },
  headerSub:   { fontSize: 12, color: '#999' },

  // Score card
  scoreCard: {
    backgroundColor: '#fff', borderRadius: 24,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  scoreAccent: { width: 6 },
  scoreBody: {
    flex: 1, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, gap: 10,
  },
  gradeChip: {
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 18, paddingVertical: 7,
  },
  gradeText: { fontSize: 15, fontWeight: '800' },
  successRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  successLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600', width: 40 },
  successBarBg: {
    flex: 1, height: 8, backgroundColor: '#f1f5f9',
    borderRadius: 4, overflow: 'hidden',
  },
  successBarFill: { height: '100%', borderRadius: 4 },
  successPct: { fontSize: 13, fontWeight: '800', width: 38, textAlign: 'right' },

  // Tag distribution
  tagRow: { flexDirection: 'row', gap: 10 },
  tagCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    alignItems: 'center', paddingVertical: 16,
    borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tagCount: { fontSize: 32, fontWeight: '900' },
  tagName:  { color: '#9ca3af', fontSize: 10, fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },

  // Section
  section: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },

  // Video template chips
  vtChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  vtChip: {
    backgroundColor: '#EDE9FF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  vtChipText: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },

  // Hashtags
  hashRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashChip: {
    backgroundColor: '#F0F9FF', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  hashText: { color: '#0369a1', fontSize: 12, fontWeight: '600' },

  // Compose block
  composeBlock: { gap: 12 },
  composeDesc: { color: '#6b7280', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  composeBtn: {
    // @ts-ignore web
    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
    backgroundColor: '#7c3aed',
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', minHeight: 58, justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  composeBtnDis: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  composeBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  noVideoHint: { color: '#9ca3af', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },

  // Composing progress
  composingBlock: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  composingTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  composingPhase: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
  progBg: { width: '100%', height: 8, backgroundColor: '#EDE9FF', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 4 },
  progPct: { color: '#7c3aed', fontSize: 13, fontWeight: '700' },
  composingNote: { color: '#9ca3af', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // Error
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, gap: 8,
    borderWidth: 1, borderColor: '#FECACA', alignItems: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },
  retrySmall: {
    backgroundColor: '#7c3aed', paddingHorizontal: 22, paddingVertical: 8, borderRadius: 10,
  },
  retrySmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Video preview
  videoBlock: { gap: 12 },
  videoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', flex: 1 },
  readyBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  readyText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Action row
  actionRow: { flexDirection: 'row', gap: 10 },
  downloadBtn: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    minHeight: 50, justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  downloadText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  shareBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', minHeight: 50, justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  shareText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  shareResult: { color: '#059669', fontSize: 13, textAlign: 'center', fontWeight: '600' },

  // Platform share
  platformBlock: { gap: 10 },
  platformTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  platformSub: { fontSize: 12, color: '#6b7280' },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  platformBtn: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10,
    minHeight: 40, justifyContent: 'center',
  },
  platformBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  platformNote: { color: '#9ca3af', fontSize: 11, lineHeight: 16 },

  // Caption
  captionBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  captionText: { color: '#6b7280', fontSize: 13, lineHeight: 20 },

  // Save
  saveBtn: {
    backgroundColor: '#059669', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', minHeight: 54, justifyContent: 'center',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  saveBtnDis: { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  savedEmoji: { fontSize: 24 },
  savedText: { color: '#059669', fontSize: 15, fontWeight: '700' },

  // Bottom actions
  bottomRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  retakeBtn: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    minHeight: 56, justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  retakeText: { color: '#374151', fontSize: 15, fontWeight: '800' },
  homeBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  homeText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
