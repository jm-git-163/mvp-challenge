/**
 * result/index.tsx — 챌린지 완료 결과 화면 (게임급 UI)
 *
 * Features:
 *  - 애니메이션 스코어 카운터 (숫자 올라가는 효과)
 *  - 미션별 결과 카드 (MissionResultCard)
 *  - 달성 뱃지 시스템 (PERFECT / COMBO / SPEED / VOICE / SQUAT)
 *  - 영상 재생 + 다운로드
 *  - SNS 공유 모달 (Web Share / TikTok / Instagram / 카카오 / 링크 복사)
 *  - Confetti 파티클 효과
 */

import React, {
  useEffect, useMemo, useState, useCallback, useRef,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated, Modal, useWindowDimensions,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionStore } from '../../store/sessionStore';
import { useUserStore }    from '../../store/userStore';
import {
  createSession, upsertUserProfile, fetchUserProfile,
} from '../../services/supabase';
import { requestAutoEdit }  from '../../services/api';
import { composeVideo, type CompositorProgress } from '../../utils/videoCompositor';
import { getVideoTemplate, VIDEO_TEMPLATES }     from '../../utils/videoTemplates';
import type { JudgementTag, FrameTag } from '../../types/session';
import type { MissionType } from '../../types/template';
import { Claude, ClaudeFont } from '../../constants/claudeTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  gesture:    '제스처',
  voice_read: '음성',
  timing:     '타이밍',
  expression: '표정',
};

const MISSION_TYPE_ICON: Record<MissionType, string> = {
  gesture:    '🤸',
  voice_read: '🎤',
  timing:     '⏱',
  expression: '😊',
};

// ─── Badge definitions ────────────────────────────────────────────────────────

interface BadgeInfo {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  color: string;
}

const ALL_BADGES: BadgeInfo[] = [
  { id: 'PERFECT', emoji: '👑', label: '왕관',        desc: '90%+ 점수 달성',      color: '#f59e0b' },
  { id: 'COMBO',   emoji: '🔥', label: '콤보마스터',   desc: '3회+ 연속 PERFECT',  color: '#ef4444' },
  { id: 'SPEED',   emoji: '⚡', label: '스피드스타',   desc: '빠른 미션 완료',      color: '#6366f1' },
  { id: 'VOICE',   emoji: '🎤', label: '보이스킹',    desc: '음성 80%+ 정확도',    color: '#8b5cf6' },
  { id: 'SQUAT',   emoji: '💪', label: '스쿼트챔피언', desc: '10회+ 스쿼트',        color: '#059669' },
];

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreToColor(score: number): string {
  if (score >= 0.8) return '#22c55e';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
}

function scoreToGradient(score: number): [string, string] {
  if (score >= 0.8) return ['#22c55e', '#16a34a'];
  if (score >= 0.6) return ['#f59e0b', '#d97706'];
  return ['#ef4444', '#dc2626'];
}

function computeBadges(
  avgScore: number,
  frameTags: FrameTag[],
  squatCount: number,
): string[] {
  const unlocked: string[] = [];

  if (avgScore >= 0.9) unlocked.push('PERFECT');

  // COMBO: 3+ consecutive perfect tags
  let consecutive = 0;
  let maxConsecutive = 0;
  for (const ft of frameTags) {
    if (ft.tag === 'perfect') { consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive); }
    else consecutive = 0;
  }
  if (maxConsecutive >= 3) unlocked.push('COMBO');

  // SPEED: avg score good AND fast mission transitions (heuristic: many tags per time)
  if (frameTags.length > 0 && avgScore >= 0.7) {
    const durationMs = (frameTags[frameTags.length - 1]?.timestamp_ms ?? 0) -
                       (frameTags[0]?.timestamp_ms ?? 0);
    const tagsPerSec = (frameTags.length / Math.max(1, durationMs / 1000));
    if (tagsPerSec >= 5) unlocked.push('SPEED');
  }

  // VOICE: check voice_read mission scores above 0.8
  const voiceTags = frameTags.filter(ft => ft.score >= 0.8);
  if (voiceTags.length >= frameTags.length * 0.3 && avgScore >= 0.75) unlocked.push('VOICE');

  // SQUAT: 10+ squats
  if (squatCount >= 10) unlocked.push('SQUAT');

  return unlocked;
}

// ─── Per-mission result computation ──────────────────────────────────────────

interface MissionResult {
  seq: number;
  type: MissionType;
  avgScore: number;
  count: number;
}

function computeMissionResults(frameTags: FrameTag[]): MissionResult[] {
  const map = new Map<number, { totalScore: number; count: number; type: MissionType }>();
  for (const ft of frameTags) {
    const seq = ft.mission_seq;
    if (!map.has(seq)) {
      map.set(seq, { totalScore: 0, count: 0, type: 'timing' });
    }
    const entry = map.get(seq)!;
    entry.totalScore += ft.score;
    entry.count++;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([seq, data]) => ({
      seq,
      type: data.type,
      avgScore: data.count > 0 ? data.totalScore / data.count : 0,
      count: data.count,
    }));
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function doDownload(uri: string, name: string, mimeType?: string): Promise<void> {
  if (typeof window === 'undefined' || !uri) return;

  // If mime is unknown (e.g. raw recording blob URL), fetch and inspect.
  // Saving a WebM file as ".mp4" produces an unplayable file on most players.
  let resolvedMime = mimeType;
  if (!resolvedMime && uri.startsWith('blob:')) {
    try {
      const resp = await fetch(uri);
      resolvedMime = resp.headers.get('content-type') || (await resp.blob()).type || '';
    } catch { /* ignore — fall back to guess below */ }
  }

  const ext =
    resolvedMime?.includes('mp4') ? 'mp4' :
    resolvedMime?.includes('webm') ? 'webm' :
    uri.toLowerCase().endsWith('.webm') ? 'webm' :
    uri.toLowerCase().endsWith('.mp4') ? 'mp4' :
    'webm'; // Chrome MediaRecorder default — safer than defaulting to mp4

  const safeName = (name || 'challenge')
    .replace(/[^\w가-힣\s-]/g, '')   // strip emoji + symbols, keep Korean
    .trim()
    .replace(/\s+/g, '_')            // spaces → underscores (filesystem-friendly)
    .slice(0, 40);                   // limit filename length
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const a = document.createElement('a');
  a.href = uri;
  a.download = `${safeName || 'challenge'}_${stamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getBlobExt(blob: Blob): string {
  if (blob.type.includes('mp4')) return 'mp4';
  if (blob.type.includes('webm')) return 'webm';
  return 'mp4';
}

function openPlatformShare(platform: string, text: string): void {
  if (typeof window === 'undefined') return;
  const enc = encodeURIComponent(text);
  const shareMap: Record<string, string> = {
    twitter:   `https://twitter.com/intent/tweet?text=${enc}`,
    facebook:  `https://www.facebook.com/sharer/sharer.php?quote=${enc}`,
    threads:   `https://www.threads.net/intent/post?text=${enc}`,
    instagram: 'https://www.instagram.com/create/story',
    tiktok:    'https://www.tiktok.com/upload',
  };
  const url = shareMap[platform];
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** 숫자가 0에서 목표까지 카운트업하는 애니메이션 */
function AnimatedScore({ targetScore, color }: { targetScore: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let current = 0;
    const step = Math.max(1, Math.ceil(targetScore / 40));
    const timer = setInterval(() => {
      current += step;
      if (current >= targetScore) { setDisplayed(targetScore); clearInterval(timer); }
      else setDisplayed(current);
    }, 28);

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 7, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    return () => clearInterval(timer);
  }, [targetScore]);

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
      <Text style={[sc.scoreNum, { color }]}>{displayed}</Text>
      <Text style={sc.scoreUnit}>점</Text>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  scoreNum:  { fontSize: 88, fontWeight: '900', lineHeight: 96, letterSpacing: -2 },
  scoreUnit: { fontSize: 16, color: '#999', fontWeight: '600', marginTop: -4 },
});

/** 점수 바 (그라디언트 느낌, 0~100%) */
function ScoreBar({ score, color, animated = false }: { score: number; color: string; animated?: boolean }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: score,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }
  }, [score, animated]);

  const pct = animated
    ? widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
    : `${Math.round(score)}%`;

  return (
    <View style={bar.bg}>
      <Animated.View style={[bar.fill, { width: pct as any, backgroundColor: color }]} />
    </View>
  );
}

const bar = StyleSheet.create({
  bg:   { flex: 1, height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

/** 미션별 결과 카드 */
function MissionResultCard({ result, missionType, index }: {
  result: MissionResult;
  missionType?: MissionType;
  index: number;
}) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  const type = missionType ?? result.type;
  const pct  = Math.round(result.avgScore * 100);
  const color = scoreToColor(result.avgScore);
  const success = result.avgScore >= 0.55;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[mrc.wrap, { opacity: opacAnim, transform: [{ translateX: slideAnim }] }]}>
      <View style={[mrc.iconWrap, { backgroundColor: color + '18' }]}>
        <Text style={mrc.icon}>{MISSION_TYPE_ICON[type]}</Text>
      </View>
      <View style={mrc.center}>
        <Text style={mrc.typeLabel}>{MISSION_TYPE_LABEL[type]}</Text>
        <View style={mrc.barRow}>
          <ScoreBar score={pct} color={color} animated />
          <Text style={[mrc.pct, { color }]}>{pct}%</Text>
        </View>
      </View>
      <View style={[mrc.badge, {
        backgroundColor: success ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)',
        borderWidth: 1,
        borderColor: success ? 'rgba(34,197,94,0.45)' : 'rgba(245,158,11,0.45)',
      }]}>
        <Text style={[mrc.badgeText, { color: success ? '#86efac' : '#fcd34d' }]}>
          {success ? '✅ 성공' : '⚠️ 아쉬움'}
        </Text>
      </View>
    </Animated.View>
  );
}

const mrc = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 22 },
  center:   { flex: 1, gap: 6 },
  typeLabel: { fontSize: 14, fontWeight: '800', color: '#f1f5f9', letterSpacing: 0.2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pct:   { fontSize: 13, fontWeight: '900', width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] as any },
  badge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});

/** 달성 뱃지 아이템 (spring pop-in 애니메이션) */
function BadgeItem({ badge, unlocked, index }: {
  badge: BadgeInfo;
  unlocked: boolean;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!unlocked) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 80, friction: 5, delay: index * 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacAnim, {
        toValue: 1, duration: 200, delay: index * 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [unlocked]);

  return (
    <Animated.View
      style={[
        bdg.wrap,
        unlocked ? { borderColor: badge.color, backgroundColor: badge.color + '12' } : bdg.locked,
        { opacity: unlocked ? opacAnim : 0.35, transform: [{ scale: unlocked ? scaleAnim : 1 }] },
      ]}
    >
      <Text style={bdg.emoji}>{badge.emoji}</Text>
      <Text style={[bdg.label, { color: unlocked ? badge.color : 'rgba(255,255,255,0.35)' }]} numberOfLines={1}>
        {badge.label}
      </Text>
      {unlocked && (
        <View style={[bdg.dot, { backgroundColor: badge.color }]} />
      )}
    </Animated.View>
  );
}

const bdg = StyleSheet.create({
  wrap: {
    width: 76, alignItems: 'center', gap: 5,
    paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: 18, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  locked: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 13, letterSpacing: 0.2 },
  dot:   { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});

/** Confetti overlay */
function Confetti({ show, tier = 'normal' }: { show: boolean; tier?: 'mini' | 'normal' | 'epic' }) {
  const items = useMemo(() => {
    const pools: Record<typeof tier, string[]> = {
      mini:   ['✨','⭐','💫','🌟'],
      normal: ['🎉','🎊','⭐','✨','🌟','💫','🎈','🔥','💥','🏆'],
      epic:   ['🎉','🎊','🏆','👑','⭐','✨','🌟','💫','🎈','🎁','🔥','💥','💎','🥇','🌈','🪩','💖','🎆'],
    };
    const pool = pools[tier];
    const count = tier === 'epic' ? 36 : tier === 'normal' ? 18 : 10;
    const dur   = tier === 'epic' ? 2.8 : 2.2;
    return Array.from({ length: count }, (_, i) => {
      // deterministic sin-hash for SSR-safe stable positions
      const h1 = Math.abs(Math.sin((i + 1) * 97.13));
      const h2 = Math.abs(Math.sin((i + 1) * 53.31));
      const h3 = Math.abs(Math.sin((i + 1) * 17.71));
      return {
        emoji: pool[i % pool.length],
        left: `${2 + (h1 * 96)}%`,
        delay: Math.floor(h2 * 800),
        size: tier === 'epic' ? 26 + h3 * 18 : 22 + h3 * 14,
        duration: dur + h1 * 0.8,
        drift: (h2 - 0.5) * 60, // horizontal wobble
      };
    });
  }, [tier]);

  if (!show) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item, i) => (
        <Text
          key={i}
          // @ts-ignore web — left is a string %, animation* and CSS vars are web-only
          style={[cft.item, {
            left: item.left as any,
            fontSize: item.size,
            animationDelay: `${item.delay}ms`,
            animationDuration: `${item.duration}s`,
            ['--drift' as any]: `${item.drift}px`,
          } as any]}
        >
          {item.emoji}
        </Text>
      ))}
    </View>
  );
}

const cft = StyleSheet.create({
  item: {
    position: 'absolute', top: -24, zIndex: 100,
    // @ts-ignore web
    animation: 'confettiFall 2.4s cubic-bezier(.32,.72,.44,1) forwards',
    // @ts-ignore web
    textShadow: '0 2px 8px rgba(0,0,0,0.35)',
    // @ts-ignore web
    willChange: 'transform, opacity',
  },
});

// ─── Share Modal ──────────────────────────────────────────────────────────────

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  composedUri: string | null;
  composedBlob: Blob | null;
  rawVideoUri: string;
  shareText: string;
  templateName: string;
  scoreNum: number;
}

function ShareModal({
  visible, onClose, composedUri, composedBlob,
  rawVideoUri, shareText, templateName, scoreNum,
}: ShareModalProps) {
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handleWebShare = async () => {
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      try {
        // Use the ACTUAL blob mime so Web Share doesn't reject a mislabeled file
        const realMime = composedBlob?.type || 'video/webm';
        const ext = realMime.includes('mp4') ? 'mp4' : 'webm';
        const safeName = (templateName || 'challenge').replace(/[^\w가-힣\s-]/g, '').trim().slice(0, 40);
        if (composedBlob) {
          const probe = new File([composedBlob], `${safeName}.${ext}`, { type: realMime });
          if ((navigator as any).canShare?.({ files: [probe] })) {
            await navigator.share({ files: [probe], title: `${templateName} 챌린지 완료!`, text: shareText });
          } else {
            // canShare rejected files (e.g. iOS Safari with webm) — fall back to link share
            await navigator.share({ title: `${templateName} 챌린지 완료!`, text: shareText, url: typeof window !== 'undefined' ? window.location.href : '' });
          }
        } else {
          await navigator.share({ title: `${templateName} 챌린지 완료!`, text: shareText, url: typeof window !== 'undefined' ? window.location.href : '' });
        }
        onClose();
      } catch (e: any) {
        if (e?.name !== 'AbortError') showToast('공유 실패. 다른 방법을 시도해보세요.');
      }
    }
  };

  const handleDownload = () => {
    const uri = composedUri ?? rawVideoUri;
    if (uri) {
      // doDownload is async (may fetch blob mime), but we fire-and-forget for UX
      doDownload(uri, templateName, composedBlob?.type).catch(() => {});
      showToast('📥 영상 저장 중...');
    }
  };

  const handleCopyLink = async () => {
    if (typeof navigator === 'undefined') return;
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(shareText + '\n' + url);
      showToast('🔗 링크 복사됨!');
    } catch {
      showToast('복사 실패');
    }
  };

  // Copy caption to clipboard (used before opening platform since uploads need manual caption paste)
  const copyCaption = async () => {
    if (typeof navigator === 'undefined') return;
    try { await navigator.clipboard.writeText(shareText); } catch {}
  };

  const shareOptions: Array<{
    label: string; sub: string; accent: boolean;
    onPress: () => void;
  }> = [
    {
      label: '영상 다운로드', sub: 'MP4 · 기기에 저장', accent: true,
      onPress: handleDownload,
    },
    {
      label: '캡션 복사', sub: '해시태그 포함',        accent: false,
      onPress: async () => { await copyCaption(); showToast('캡션 복사 완료'); },
    },
    {
      label: 'TikTok 업로드', sub: '영상+캡션 자동 준비', accent: false,
      onPress: async () => { handleDownload(); await copyCaption(); openPlatformShare('tiktok', shareText); showToast('영상 저장·캡션 복사 완료'); },
    },
    {
      label: 'Instagram 업로드', sub: 'Stories · Reels',  accent: false,
      onPress: async () => { handleDownload(); await copyCaption(); openPlatformShare('instagram', shareText); showToast('영상 저장·캡션 복사 완료'); },
    },
    {
      label: 'X / Twitter',     sub: '게시글로 공유',      accent: false,
      onPress: () => openPlatformShare('twitter', shareText),
    },
    {
      label: 'Threads',         sub: '게시글로 공유',      accent: false,
      onPress: () => openPlatformShare('threads', shareText),
    },
    {
      label: '링크 복사',        sub: '페이지 URL + 캡션',   accent: false,
      onPress: handleCopyLink,
    },
  ];

  // Add Web Share option if available
  const hasWebShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={sm.sheet}>
          <View style={sm.handle} />

          <Text style={sm.title}>공유</Text>
          <Text style={sm.subtitle}>{templateName} · {scoreNum}점</Text>

          {hasWebShare && (
            <Pressable
              style={({ hovered }: any) => [sm.primaryRow, hovered && sm.primaryRowHover]}
              onPress={handleWebShare}
            >
              <View style={sm.primaryRowInner}>
                <Text style={sm.primaryRowLabel}>기기 기본 공유</Text>
                <Text style={sm.primaryRowSub}>시스템 공유 시트</Text>
              </View>
              <Text style={sm.primaryRowArrow}>→</Text>
            </Pressable>
          )}

          <View style={{ height: 4 }} />

          {shareOptions.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ hovered }: any) => [
                opt.accent ? sm.accentRow : sm.rowPro,
                hovered && (opt.accent ? sm.accentRowHover : sm.rowProHover),
              ]}
              onPress={opt.onPress}
            >
              <View style={sm.rowInner}>
                <Text style={opt.accent ? sm.accentLabel : sm.rowLabelPro}>{opt.label}</Text>
                <Text style={opt.accent ? sm.accentSub : sm.rowSubPro}>{opt.sub}</Text>
              </View>
              <Text style={opt.accent ? sm.accentArrow : sm.rowArrowPro}>→</Text>
            </Pressable>
          ))}

          <Pressable style={sm.cancelBtnPro} onPress={onClose}>
            <Text style={sm.cancelTextPro}>취소</Text>
          </Pressable>
        </TouchableOpacity>
      </TouchableOpacity>

      <Animated.View style={[sm.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <Text style={sm.toastText}>{toastMsg}</Text>
      </Animated.View>
    </Modal>
  );
}

const PRO = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkSub: '#3F3F46',
  inkMuted: '#71717A',
  border: '#E5E5E5',
  borderStrong: '#D4D4D8',
  fontSans: Platform.select({
    web: '"Pretendard Variable",Pretendard,"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif',
    default: 'System',
  }) as string,
};

const sm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(10,10,10,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: PRO.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    gap: 8,
    borderTopWidth: 1, borderColor: PRO.border,
    // @ts-ignore web
    boxShadow: '0 -12px 32px -12px rgba(10,10,10,0.18)',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    width: 36, height: 4, backgroundColor: PRO.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: PRO.ink,
    textAlign: 'left', letterSpacing: -0.4,
    paddingHorizontal: 4,
    fontFamily: PRO.fontSans,
  },
  subtitle: {
    fontSize: 13, color: PRO.inkMuted,
    textAlign: 'left', paddingHorizontal: 4, paddingBottom: 10,
    fontFamily: PRO.fontSans,
  },
  primaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: PRO.ink,
    gap: 12,
    // @ts-ignore web
    transition: 'background-color 160ms ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  primaryRowHover: { backgroundColor: '#1F1F1F' },
  primaryRowInner: { flex: 1, gap: 2 },
  primaryRowLabel: {
    fontSize: 14, fontWeight: '600', color: '#FFFFFF',
    letterSpacing: -0.1, fontFamily: PRO.fontSans,
  },
  primaryRowSub: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)',
    fontFamily: PRO.fontSans,
  },
  primaryRowArrow: {
    fontSize: 16, color: '#FFFFFF', fontWeight: '400',
    fontFamily: PRO.fontSans,
  },

  rowPro: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1, borderColor: PRO.border,
    backgroundColor: PRO.surface,
    gap: 12,
    // @ts-ignore web
    transition: 'border-color 160ms ease, background-color 160ms ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  rowProHover: { borderColor: PRO.borderStrong, backgroundColor: '#F8F8F8' },
  rowInner: { flex: 1, gap: 2 },
  rowLabelPro: {
    fontSize: 14, fontWeight: '600', color: PRO.ink,
    letterSpacing: -0.1, fontFamily: PRO.fontSans,
  },
  rowSubPro: {
    fontSize: 11, fontWeight: '500', color: PRO.inkMuted,
    fontFamily: PRO.fontSans,
  },
  rowArrowPro: {
    fontSize: 16, color: PRO.inkMuted, fontWeight: '400',
    fontFamily: PRO.fontSans,
  },

  accentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: PRO.ink,
    gap: 12, marginBottom: 2,
    // @ts-ignore web
    transition: 'background-color 160ms ease',
    // @ts-ignore web
    cursor: 'pointer',
  },
  accentRowHover: { backgroundColor: '#1F1F1F' },
  accentLabel: {
    fontSize: 14, fontWeight: '600', color: '#FFFFFF',
    letterSpacing: -0.1, fontFamily: PRO.fontSans,
  },
  accentSub: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)',
    fontFamily: PRO.fontSans,
  },
  accentArrow: {
    fontSize: 16, color: '#FFFFFF', fontWeight: '400',
    fontFamily: PRO.fontSans,
  },

  cancelBtnPro: {
    alignItems: 'center', paddingVertical: 14, marginTop: 8,
    borderRadius: 10,
    borderWidth: 1, borderColor: PRO.border,
  },
  cancelTextPro: {
    fontSize: 13, fontWeight: '600', color: PRO.inkSub,
    fontFamily: PRO.fontSans,
  },

  toast: {
    position: 'absolute', bottom: 120, left: 20, right: 20,
    backgroundColor: PRO.ink, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center',
    maxWidth: 480, alignSelf: 'center', width: 'auto',
  },
  toastText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '600',
    fontFamily: PRO.fontSans,
  },
});

// ─── Compositing progress bar ─────────────────────────────────────────────────

function ComposeProgress({ progress }: { progress: CompositorProgress | null }) {
  const pct = Math.round(progress?.percent ?? 0);
  const phaseText = progress?.phase ?? '준비 중...';
  // Phase emoji hint
  const phaseEmoji =
    pct < 10 ? '📦' :
    pct < 30 ? '🎞️' :
    pct < 60 ? '🎨' :
    pct < 90 ? '🎧' :
    pct < 100 ? '📼' : '✅';
  return (
    <View style={cp.wrap}>
      {typeof window !== 'undefined' && (
        // @ts-ignore web
        <style>{`
          @keyframes barShimmer {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }
        `}</style>
      )}
      <Text style={cp.emoji}>{phaseEmoji}</Text>
      <Text style={cp.title}>🎬 영상 합성 중</Text>
      <Text style={cp.phase}>{phaseText}</Text>
      <View style={cp.barBg}>
        <View style={[cp.barFill, { width: `${pct}%` as any }]} />
        <View style={cp.barShimmer} pointerEvents="none" />
      </View>
      <Text style={cp.pct}>{pct}%</Text>
      <Text style={cp.note}>실시간 처리 — 영상 길이만큼 소요됩니다</Text>
    </View>
  );
}

const cp = StyleSheet.create({
  wrap: {
    alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 16,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', letterSpacing: 0.3 },
  phase: { color: '#c4b5fd', fontSize: 13, fontWeight: '600' },
  emoji: { fontSize: 36, marginTop: -4 },
  barBg: {
    width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6, overflow: 'hidden', position: 'relative',
  },
  barFill: {
    height: '100%', backgroundColor: '#a78bfa', borderRadius: 6,
    // @ts-ignore web
    backgroundImage: 'linear-gradient(90deg, #7c3aed, #ec4899, #f59e0b)',
    // @ts-ignore web
    backgroundSize: '200% 100%',
    // @ts-ignore web
    boxShadow: '0 0 14px rgba(167,139,250,0.65)',
    // @ts-ignore web
    transition: 'width 0.35s cubic-bezier(.4,0,.2,1)',
  },
  barShimmer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%',
    // @ts-ignore web
    backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
    // @ts-ignore web
    animation: 'barShimmer 1.6s linear infinite',
  },
  pct:  { color: '#c4b5fd', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  note: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const router  = useRouter();
  const { width } = useWindowDimensions();
  const params  = useLocalSearchParams<{
    videoUri?: string;
    videoTemplateId?: string;
    squatCount?: string;
  }>();

  const rawVideoUri     = params.videoUri ?? '';
  const videoTemplateId = params.videoTemplateId ?? '';
  const squatCountParam = parseInt(params.squatCount ?? '0', 10);

  const frameTags      = useSessionStore(s => s.frameTags);
  const activeTemplate = useSessionStore(s => s.activeTemplate);
  const setLastSession = useSessionStore(s => s.setLastSession);
  const reset          = useSessionStore(s => s.reset);
  const startSession   = useSessionStore(s => s.startSession);
  const { userId }     = useUserStore();

  // Composed video state
  const [composedUri,  setComposedUri]  = useState<string | null>(null);
  const [composedBlob, setComposedBlob] = useState<Blob | null>(null);
  const [composing,    setComposing]    = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [progress,     setProgress]     = useState<CompositorProgress | null>(null);

  // UX state
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Animations
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const scoreAnim   = useRef(new Animated.Value(0)).current;
  const sectionsAnim = useRef(new Animated.Value(0)).current;

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

  const scoreNum    = Math.round(stats.avgScore * 100);
  const accentColor = stats.avgScore >= 0.8 ? '#7c3aed' : stats.avgScore >= 0.6 ? '#f59e0b' : '#ef4444';

  const scoreGrade =
    stats.avgScore >= 0.9 ? '🏆 완벽해요!' :
    stats.avgScore >= 0.8 ? '🌟 훌륭해요!' :
    stats.avgScore >= 0.6 ? '💪 잘했어요!' :
    stats.avgScore >= 0.4 ? '🙌 노력했어요!' : '다음엔 더 잘할 수 있어요!';

  // Badges
  const unlockedBadges = useMemo(
    () => computeBadges(stats.avgScore, frameTags, squatCountParam),
    [stats.avgScore, frameTags, squatCountParam],
  );

  // Mission results grouped by seq
  const missionResults = useMemo(() => computeMissionResults(frameTags), [frameTags]);

  // Resolve video template
  const videoTemplate = useMemo(() => {
    if (videoTemplateId) return getVideoTemplate(videoTemplateId);
    if (activeTemplate) {
      const map: Record<string, string> = {
        daily: 'vt-vlog', vlog: 'vt-vlog',
        news: 'vt-news', promotion: 'vt-news',
        kpop: 'vt-kpop', challenge: 'vt-kpop',
        english: 'vt-english',
        kids: 'vt-fairy', fairy: 'vt-fairy', children: 'vt-fairy',
        fitness: 'vt-fitness', workout: 'vt-fitness',
        travel: 'vt-travel',
        hiphop: 'vt-hiphop', hip_hop: 'vt-hiphop',
      };
      const vtId = map[activeTemplate.genre];
      if (vtId) return getVideoTemplate(vtId);
    }
    return VIDEO_TEMPLATES[0];
  }, [videoTemplateId, activeTemplate]);

  // Share text for modal — score-aware caption with badge shoutouts
  const shareText = useMemo(() => {
    const grade =
      scoreNum >= 90 ? '🏆 PERFECT CLEAR' :
      scoreNum >= 80 ? '🌟 거의 완벽' :
      scoreNum >= 60 ? '💪 성공' :
      scoreNum >= 40 ? '🙌 도전 완료' : '🔄 리트라이 각';
    const badgeLine = unlockedBadges.length > 0
      ? `획득 뱃지: ${unlockedBadges.map(id => {
          const b = ALL_BADGES.find(x => x.id === id);
          return b ? `${b.emoji} ${b.label}` : '';
        }).filter(Boolean).join(' · ')}`
      : '';
    const perfects = stats.counts.perfect;
    const hint = perfects > 0 ? `PERFECT ${perfects}번!` : '';

    if (!activeTemplate) {
      return [
        `${grade} · ${scoreNum}점`,
        hint,
        '#챌린지스튜디오 #챌린지 #shorts',
      ].filter(Boolean).join('\n');
    }

    const caption = activeTemplate.sns_template.caption_template
      .replace('{template_name}', activeTemplate.name)
      .replace('{score}', String(scoreNum));
    const hashtags = activeTemplate.sns_template.hashtags.map(h => '#' + h).join(' ');

    return [
      `${grade} · ${scoreNum}점`,
      caption,
      hint,
      badgeLine,
      hashtags + ' #shorts #챌린지',
    ].filter(Boolean).join('\n');
  }, [activeTemplate, scoreNum, unlockedBadges, stats.counts.perfect]);

  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      Animated.spring(scoreAnim,  { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      Animated.spring(sectionsAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();

    if (stats.avgScore >= 0.6) {
      const t = setTimeout(() => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // ▶ Auto-compose on mount: template(intro/overlays/BGM/outro) + recording → 세로형 쇼츠 MP4
  const autoComposedRef = useRef(false);
  useEffect(() => {
    if (autoComposedRef.current) return;
    if (!videoTemplate || !rawVideoUri) return;
    if (composedUri || composing) return;
    autoComposedRef.current = true;
    // 살짝 딜레이 — 애니메이션 끝난 뒤 시작
    const t = setTimeout(() => { handleCompose(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTemplate, rawVideoUri]);

  // Handlers
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
      const composedUrl = URL.createObjectURL(resultBlob);
      setComposedBlob(resultBlob);
      setComposedUri(composedUrl);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      // 자동 다운로드는 제거 — 사용자는 아래 다운로드/공유 버튼으로 직접 저장
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : '합성 실패');
    } finally {
      setComposing(false);
    }
  }, [videoTemplate, rawVideoUri, activeTemplate]);

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

  const goHome = useCallback(() => {
    if (composedUri) URL.revokeObjectURL(composedUri);
    reset();
    router.replace('/(main)/home');   // home is still inside (main)
  }, [reset, composedUri, router]);

  const doRetake = useCallback(() => {
    if (composedUri) URL.revokeObjectURL(composedUri);
    if (activeTemplate) startSession(activeTemplate);
    router.replace('/record');
  }, [activeTemplate, startSession, composedUri, router]);

  const hPad = Math.min(20, (width - 360) / 2 + 16);

  return (
    <SafeAreaView style={st.root} edges={['top', 'bottom']}>
      {/* CSS for confetti animation */}
      {typeof window !== 'undefined' && (
        // @ts-ignore
        <style>{`
          @keyframes confettiFall {
            0%   { transform: translate(0, 0) rotate(0deg); opacity: 0; }
            8%   { opacity: 1; }
            60%  { opacity: 1; }
            100% { transform: translate(var(--drift, 0px), 130vh) rotate(720deg); opacity: 0; }
          }
        `}</style>
      )}

      <Confetti
        show={showConfetti}
        tier={scoreNum >= 90 ? 'epic' : scoreNum >= 75 ? 'normal' : 'mini'}
      />

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        composedUri={composedUri}
        composedBlob={composedBlob}
        rawVideoUri={rawVideoUri}
        shareText={shareText}
        templateName={activeTemplate?.name ?? '챌린지'}
        scoreNum={scoreNum}
      />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.content, { paddingHorizontal: hPad }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HEADER ───────────────────────────────────── */}
        <Animated.View style={[
          st.headerRow,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-24, 0] }) }],
          },
        ]}>
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

        {/* ── SCORE CARD ───────────────────────────────── */}
        <Animated.View style={[
          st.scoreCard,
          {
            opacity: scoreAnim,
            transform: [{ scale: scoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            borderTopColor: accentColor,
            // @ts-ignore web radial-glow per score tier
            backgroundImage:
              scoreNum >= 90
                ? `radial-gradient(90% 60% at 50% 0%, ${accentColor}26 0%, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)`
                : scoreNum >= 75
                  ? `radial-gradient(80% 50% at 50% 0%, ${accentColor}1a 0%, transparent 70%)`
                  : undefined,
            boxShadow:
              scoreNum >= 90
                ? `0 18px 60px ${accentColor}44, 0 4px 14px rgba(0,0,0,0.45)`
                : undefined,
          } as any,
        ]}>
          {/* Accent stripe */}
          <View style={[st.scoreStripe, { backgroundColor: accentColor }]} />

          <View style={st.scoreBody}>
            <AnimatedScore targetScore={scoreNum} color={accentColor} />

            {/* Grade chip */}
            <View style={[st.gradeChip, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <Text style={[st.gradeText, { color: accentColor }]}>{scoreGrade}</Text>
            </View>

            {/* Animated score bar */}
            <View style={st.bigBarRow}>
              <Text style={st.bigBarLabel}>최종 점수</Text>
              <ScoreBar score={scoreNum} color={accentColor} animated />
              <Text style={[st.bigBarPct, { color: accentColor }]}>{scoreNum}%</Text>
            </View>

            {/* Tag counts */}
            <View style={st.tagRow}>
              {(['perfect', 'good', 'fail'] as JudgementTag[]).map(tag => (
                <View key={tag} style={[st.tagCard, { borderTopColor: TAG_COLORS[tag] }]}>
                  <Text style={[st.tagCount, { color: TAG_COLORS[tag] }]}>{stats.counts[tag]}</Text>
                  <Text style={st.tagName}>{TAG_LABELS[tag]}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── MISSION RESULTS ──────────────────────────── */}
        {missionResults.length > 0 && (
          <Animated.View style={[
            st.section,
            { opacity: sectionsAnim, transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }] },
          ]}>
            <Text style={st.sectionTitle}>📊 미션별 결과</Text>
            <View style={st.missionList}>
              {missionResults.map((mr, i) => {
                // Try to get mission type from template
                const mission = activeTemplate?.missions.find(m => m.seq === mr.seq);
                return (
                  <MissionResultCard
                    key={mr.seq}
                    result={mr}
                    missionType={mission?.type}
                    index={i}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── BADGES ───────────────────────────────────── */}
        <Animated.View style={[
          st.section,
          { opacity: sectionsAnim, transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0,1], outputRange: [30, 0] }) }] },
        ]}>
          <Text style={st.sectionTitle}>🎯 달성 뱃지</Text>
          {unlockedBadges.length === 0 ? (
            <Text style={st.noBadge}>아직 뱃지가 없어요. 더 높은 점수에 도전해보세요!</Text>
          ) : (
            <Text style={st.badgeHint}>{unlockedBadges.length}개 달성!</Text>
          )}
          <View style={st.badgeRow}>
            {ALL_BADGES.map((badge, i) => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                unlocked={unlockedBadges.includes(badge.id)}
                index={i}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── VIDEO PLAYBACK & COMPOSE ──────────────────── */}
        <Animated.View style={[
          st.section,
          { opacity: sectionsAnim, transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0,1], outputRange: [40, 0] }) }] },
        ]}>
          <Text style={st.sectionTitle}>🎬 영상</Text>

          {/* Empty state when there's literally no video yet */}
          {!composedUri && !rawVideoUri && !composing && (
            <View style={{
              paddingVertical: 40,
              alignItems: 'center',
              gap: 8,
            }}>
              <Text style={{ fontSize: 40 }}>🎞️</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
                영상이 아직 준비되지 않았어요
              </Text>
            </View>
          )}

          {/* Video player: composed first, else raw */}
          {(composedUri || rawVideoUri) && (
            <View style={st.videoWrap}>
              {/* @ts-ignore */}
              <video
                src={composedUri ?? rawVideoUri}
                controls
                playsInline
                style={{
                  width: 'min(360px, 78vw)',
                  aspectRatio: '9 / 16',
                  maxHeight: '72vh',
                  borderRadius: 22,
                  display: 'block',
                  background: '#000',
                  margin: '0 auto',
                  objectFit: 'cover',
                  // @ts-ignore
                  boxShadow: `0 18px 48px ${accentColor}55, 0 4px 12px rgba(0,0,0,0.4)`,
                  border: `1px solid ${accentColor}33`,
                }}
              />
              {composedUri && (
                <View style={[st.composedBadge, { backgroundColor: accentColor }]}>
                  <Text style={st.composedBadgeText}>✨ 합성 완료</Text>
                </View>
              )}
            </View>
          )}

          {/* Compose CTA (before composing) */}
          {!composedUri && !composing && videoTemplate && (
            <View style={st.composeCta}>
              <Text style={st.composeDesc}>
                {videoTemplate.name} 템플릿 + 내 영상을 합성하여{'\n'}
                TikTok / Instagram용 완성 영상을 만들어보세요!
              </Text>
              <TouchableOpacity
                style={[st.composeBtn, !rawVideoUri && st.composeBtnDis]}
                onPress={handleCompose}
                disabled={!rawVideoUri}
                activeOpacity={0.85}
              >
                <Text style={st.composeBtnText}>✨ 완성 영상 만들기</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress */}
          {composing && <ComposeProgress progress={progress} />}

          {/* Error */}
          {composeError && (
            <View style={st.errorBox}>
              <Text style={st.errorText}>⚠️ {composeError}</Text>
              <TouchableOpacity style={st.retryBtn} onPress={handleCompose}>
                <Text style={st.retryBtnText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          <View style={st.actionRow}>
            <TouchableOpacity
              style={st.downloadBtn}
              onPress={() => doDownload(composedUri ?? rawVideoUri, activeTemplate?.name ?? 'challenge', composedBlob?.type)}
              disabled={!composedUri && !rawVideoUri}
            >
              <Text style={st.downloadText}>📥 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.shareBtn, {
                backgroundColor: accentColor,
                // @ts-ignore web gradient
                backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, #ec4899 100%)`,
                boxShadow: `0 8px 22px ${accentColor}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
              } as any]}
              onPress={() => setShowShareModal(true)}
              activeOpacity={0.88}
            >
              <Text style={st.shareText}>📤 SNS 공유</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── SAVE SESSION ──────────────────────────────── */}
        <Animated.View style={[
          st.section,
          { opacity: sectionsAnim },
        ]}>
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
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.saveBtnText}>💾 내 기록 저장하기</Text>
              }
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── BOTTOM ACTIONS ───────────────────────────── */}
        <View style={st.bottomRow}>
          <TouchableOpacity style={st.retakeBtn} onPress={doRetake} activeOpacity={0.85}>
            <Text style={st.retakeText}>🔄 다시 도전</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.homeBtn, {
              backgroundColor: accentColor,
              // @ts-ignore web gradient
              backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, #7c3aed 100%)`,
              boxShadow: `0 8px 22px ${accentColor}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
            } as any]}
            onPress={goHome}
            activeOpacity={0.85}
          >
            <Text style={st.homeText}>🏠 홈으로</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Claude.paper,
    // @ts-ignore web gradient
    backgroundImage:
      'radial-gradient(120% 80% at 50% -10%, #FBF7EE 0%, #F7F3EB 55%, #EEE6D5 100%)',
  },
  scroll:  { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 96, gap: 16 },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1, borderColor: Claude.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  backText:     { fontSize: 22, color: Claude.ink, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: Claude.ink, textAlign: 'center', letterSpacing: -0.3,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif },
  headerSub:    { fontSize: 11, color: Claude.inkFaint, letterSpacing: 1.2, fontWeight: '700' },

  // Score card
  scoreCard: {
    backgroundColor: Claude.paper,
    borderRadius: 22,
    overflow: 'hidden',
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: Claude.hairline,
    shadowColor: '#3F2A1F', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22, shadowRadius: 26, elevation: 8,
    // @ts-ignore web
    boxShadow: '0 20px 40px -18px rgba(63,42,31,0.4), inset 0 1px 0 rgba(255,255,255,0.7)',
  },
  scoreStripe: { height: 4, width: '100%' },
  scoreBody: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 12,
  },
  gradeChip: {
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  gradeText: { fontSize: 15, fontWeight: '800' },
  bigBarRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  bigBarLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600', width: 52 },
  bigBarPct:   { fontSize: 14, fontWeight: '800', width: 42, textAlign: 'right' },

  // Tag distribution
  tagRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  tagCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14,
    alignItems: 'center', paddingVertical: 16,
    borderTopWidth: 3,
    borderWidth: 1, borderColor: Claude.hairline,
  },
  tagCount: { fontSize: 30, fontWeight: '800', color: Claude.ink,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif },
  tagName:  { color: Claude.inkFaint, fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 1.2 },

  // Sections — paper cards
  section: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: Claude.hairline,
    shadowColor: '#3F2A1F', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 3,
    // @ts-ignore web
    boxShadow: '0 14px 30px -16px rgba(63,42,31,0.35)',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Claude.ink, letterSpacing: -0.2,
    // @ts-ignore web
    fontFamily: ClaudeFont.serif },

  // Mission results
  missionList: { gap: 8 },

  // Badges
  noBadge:  { color: Claude.inkMuted, fontSize: 13, textAlign: 'center', paddingVertical: 4, fontWeight: '600' },
  badgeHint: { color: Claude.amberDeep, fontSize: 13, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },

  // Video section
  videoWrap:    { position: 'relative' },
  composedBadge: {
    position: 'absolute', top: 12, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    // @ts-ignore web
    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
  },
  composedBadgeText: {
    color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5,
    // @ts-ignore web
    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },

  // Compose CTA
  composeCta:   { gap: 12 },
  composeDesc:  { color: Claude.inkMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
  composeBtn: {
    backgroundColor: Claude.ink,
    paddingVertical: 18, borderRadius: 999,
    alignItems: 'center', minHeight: 60, justifyContent: 'center',
    borderWidth: 1, borderColor: Claude.amber,
    shadowColor: '#3F2A1F', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
    // @ts-ignore web
    boxShadow: '0 12px 26px -10px rgba(204,120,92,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  composeBtnDis: {
    backgroundColor: 'rgba(161,98,68,0.15)',
    shadowOpacity: 0,
    borderColor: Claude.hairline,
    // @ts-ignore web
    boxShadow: 'none',
  },
  composeBtnText: {
    color: Claude.paper, fontSize: 15, fontWeight: '800', letterSpacing: 1.2,
  },

  // Error box
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14, padding: 16, gap: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', alignItems: 'center',
  },
  errorText:    { color: '#fca5a5', fontSize: 13, textAlign: 'center' },
  retryBtn:     { backgroundColor: '#7c3aed', paddingHorizontal: 22, paddingVertical: 8, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Action row
  actionRow: { flexDirection: 'row', gap: 10 },
  downloadBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1, borderColor: Claude.hairlineStrong,
    paddingVertical: 14, borderRadius: 999, alignItems: 'center',
    minHeight: 50, justifyContent: 'center',
  },
  downloadText: { color: Claude.ink, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  shareBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', minHeight: 50, justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  shareText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Save
  saveBtn: {
    backgroundColor: '#059669', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', minHeight: 54, justifyContent: 'center',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
    // @ts-ignore web
    backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    // @ts-ignore web
    boxShadow: '0 8px 22px rgba(5,150,105,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
  },
  saveBtnDis:  { backgroundColor: '#d1d5db', shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  savedRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  savedEmoji:  { fontSize: 24 },
  savedText:   { color: '#059669', fontSize: 15, fontWeight: '700' },

  // Bottom buttons
  bottomRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  retakeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    minHeight: 56, justifyContent: 'center',
    // @ts-ignore web
    backdropFilter: 'blur(10px)',
  },
  retakeText: { color: '#f1f5f9', fontSize: 15, fontWeight: '800' },
  homeBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  homeText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
