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
import { useInviteStore }  from '../../store/inviteStore';
import { pickOfficialSlug } from '../../utils/officialSlug';
import { shareInvite } from '../../utils/share';
import ShareSheet from '../../components/share/ShareSheet';
import { SUPABASE_TEMPLATE_THUMBNAILS } from '../../services/supabaseThumbnails';
import { TEMPLATE_THUMBNAILS } from '../../services/templateThumbnails';
import { getThumbnailUrl } from '../../utils/thumbnails';
import {
  createSession, upsertUserProfile, fetchUserProfile,
} from '../../services/supabase';
import { requestAutoEdit }  from '../../services/api';
import { composeVideo, type CompositorProgress } from '../../utils/videoCompositor';
import { composeHighlight, type HighlightProgress } from '../../utils/highlightCompositor';
import { selectHighlights, totalDurationOf } from '../../engine/curation/highlightSelector';
import { getScoreTimeline } from '../../hooks/useJudgement';
import { stashHighlightVideo, stashScoreTimeline } from '../../utils/composedVideoStash';
import { getVideoTemplate, VIDEO_TEMPLATES }     from '../../utils/videoTemplates';
import { resolveLayeredTemplate }                 from '../../services/challengeTemplateMap';
import type { JudgementTag, FrameTag } from '../../types/session';
import type { MissionType } from '../../types/template';
import { Claude, ClaudeFont } from '../../constants/claudeTheme';
// 공유/다운로드 순수 헬퍼 — 다운로드 파일명 계산만 내부에서 사용.
import { buildDownloadFilename } from '../../utils/shareHelpers';

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

/**
 * TEAM-DOWNLOAD (2026-04-23): Android 파일 잘림 + 토스트 거짓 보고 수정.
 *  기존엔
 *    1) blob: URL 을 a.href 에 그대로 꽂아 즉시 click() — Android Chrome 은
 *       blob 스트리밍 도중 외부 트리거가 끝나면 다운로드를 truncate 하는 사례 보고.
 *    2) 호출자(handleDownload)가 await 없이 fire-and-forget → "저장 중" 토스트가
 *       실제 blob 도착 전에 떴다 사라져 사용자는 성공 여부를 알 수 없음.
 *  이제는
 *    a) 항상 fetch 로 blob 을 메모리에 끌어온 뒤 createObjectURL(fresh) 로 새 URL 생성.
 *    b) click() 후 60초 grace period 가 지난 뒤 revokeObjectURL — 일부 기기가
 *       다운로드를 백그라운드에서 천천히 처리해도 안전.
 *    c) Promise<boolean> 로 성공 여부 반환 → 호출자는 await 후 정직한 토스트.
 */
async function doDownload(uri: string, name: string, mimeType?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !uri) return false;

  let blob: Blob | null = null;
  try {
    const resp = await fetch(uri);
    blob = await resp.blob();
  } catch {
    return false;
  }
  if (!blob || blob.size === 0) return false;

  const resolvedMime = mimeType || blob.type || '';
  const probeBlob = { type: resolvedMime } as Blob;
  const filename = buildDownloadFilename(name || 'challenge', probeBlob);

  // 새 blob URL 생성 — 원본 uri 가 다른 곳에서 revoke 되어도 영향 없음
  const freshUrl = URL.createObjectURL(
    resolvedMime ? new Blob([blob], { type: resolvedMime }) : blob,
  );

  const a = document.createElement('a');
  a.href = freshUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 60초 grace period — 일부 기기가 백그라운드 저장 중일 때 즉시 revoke 하면 truncate.
  setTimeout(() => {
    try { URL.revokeObjectURL(freshUrl); } catch { /* ignore */ }
  }, 60_000);

  return true;
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

// Share 모달은 components/share/ShareSheet.tsx 가 단일 구현. 문서: docs/SHARE_ARCHITECTURE.md.

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
  const fullResetForRetake = useSessionStore(s => s.fullResetForRetake);
  const { userId }     = useUserStore();

  // 초대 시스템 상태 (클라이언트 전용, 서버 호출 없음)
  const inviteContext   = useInviteStore(s => s.inviteContext);
  const mySenderName    = useInviteStore(s => s.mySenderName);

  // Composed video state
  const [composedUri,  setComposedUri]  = useState<string | null>(null);
  const [composedBlob, setComposedBlob] = useState<Blob | null>(null);
  const [composing,    setComposing]    = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [progress,     setProgress]     = useState<CompositorProgress | null>(null);

  // ─── 자동 큐레이션 (하이라이트) — 캡컷·캔바 차별 핵심 ───────────────────────
  // 결정론적 점수 타임라인 → 성공/고득점 구간만 자동 추출 → 30초 짧은 mp4.
  type ViewMode = 'full' | 'highlight';
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [highlightUri, setHighlightUri]     = useState<string | null>(null);
  const [highlightBlob, setHighlightBlob]   = useState<Blob | null>(null);
  const [highlightBuilding, setHighlightBuilding] = useState(false);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlightProgress, setHighlightProgress] = useState<HighlightProgress | null>(null);
  const [highlightSegCount, setHighlightSegCount] = useState(0);
  const [highlightDurMs, setHighlightDurMs]       = useState(0);
  const highlightStartedRef = useRef(false);

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

  // TEAM-CHAOS (2026-04-23 v3): 스쿼트 결과는 점수가 아닌 **실제 카운트** 기준 한 줄.
  //   사용자 지시: 0-3 "다음엔 더 힘내봐요" / 4-7 "잘 했어요" / 8+ "완벽한 스쿼트!".
  //   단일 메시지 — 스팸 금지.
  const isSquat = activeTemplate?.genre === 'fitness';
  const scoreGrade = isSquat
    ? (squatCountParam >= 8 ? '💪 완벽한 스쿼트!' :
       squatCountParam >= 4 ? '🙌 잘 했어요' :
                              '🔄 다음엔 더 힘내봐요')
    : (stats.avgScore >= 0.9 ? '🏆 완벽해요!' :
       stats.avgScore >= 0.8 ? '🌟 훌륭해요!' :
       stats.avgScore >= 0.6 ? '💪 잘했어요!' :
       stats.avgScore >= 0.4 ? '🙌 노력했어요!' : '다음엔 더 잘할 수 있어요!');

  // Badges
  const unlockedBadges = useMemo(
    () => computeBadges(stats.avgScore, frameTags, squatCountParam),
    [stats.avgScore, frameTags, squatCountParam],
  );

  // Mission results grouped by seq
  const missionResults = useMemo(() => computeMissionResults(frameTags), [frameTags]);

  // Focused Commit A-6-b: 챌린지 주제별 layered Template 해석
  //   - 현재 compositor 파이프라인은 legacy VideoTemplate 만 소비하지만, challenge slug/genre 에서
  //     neon-arena / news-anchor / emoji-explosion 로의 매핑을 먼저 확정해둔다.
  //   - 후속 A-1 커밋(composeVideo 오버로드)에서 이 레이어드 Template 이 실제 렌더 경로에 꽂힌다.
  const layeredTemplate = useMemo(() => {
    const key = activeTemplate?.genre ?? (activeTemplate as any)?.slug ?? videoTemplateId;
    return resolveLayeredTemplate(key ?? null);
  }, [activeTemplate, videoTemplateId]);

  // Resolve video template (legacy)
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
    const hashtags = (Array.isArray(activeTemplate.sns_template?.hashtags) ? activeTemplate.sns_template.hashtags : []).map(h => '#' + h).join(' ');

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

  // Focused Commit C-1: route unmount 종합 cleanup
  //   - composedUri blob URL 해제 (goHome/doRetake 경로 외 뒤로가기도 커버)
  //   - 잔존 window global (__poseVideoEl / __permissionStream / __compositorCanvas) 해제
  //   - 재진입 시 MediaPipe·MediaStream·AudioContext 유출 방지
  const composedUriRef = useRef<string | null>(null);
  useEffect(() => { composedUriRef.current = composedUri; }, [composedUri]);
  const highlightUriRef = useRef<string | null>(null);
  useEffect(() => { highlightUriRef.current = highlightUri; }, [highlightUri]);
  useEffect(() => () => {
    try {
      if (composedUriRef.current) URL.revokeObjectURL(composedUriRef.current);
      if (highlightUriRef.current) URL.revokeObjectURL(highlightUriRef.current);
    } catch (e) { console.warn('[result] unmount cleanup: revokeObjectURL', e); }
    if (typeof window !== 'undefined') {
      const w = window as any;
      // FIX-INVITE-KEEP-ALIVE (2026-04-24): /record unmount 와 동일하게, 싱글톤 스트림을
      //   **stop 하지 않는다**. 초대 경로→/record→/result→다시 챌린지 재도전
      //   시 스트림이 살아있어야 다음 ensureMediaSession() 이 팝업 없이 재사용.
      //   stream 수명주기는 mediaSession 싱글톤이 소유 (앱 종료 시 release).
      try { w.__poseVideoEl = undefined; } catch {}
      try { w.__compositorCanvas = undefined; } catch {}
      // __permissionStream 도 그대로 둔다 — 다음 세션 재사용.
    }
  }, []);

  // FIX-V (2026-04-22): 자동 합성 제거.
  //   기존엔 /result 진입 즉시 handleCompose() 실행 → videoCompositor 가
  //   source video 를 speaker 로 재생하며 "시킨적도 없는데 촬영 음성이 자동 재생"되는
  //   유저 보고 버그 발생.
  // FIX-AUTO-COMPOSE (2026-04-24): 사용자 요청 "완성 영상 만들기 안눌러도 자동으로
  //   완성 영상 진행했으면 좋겠어". 버튼 탭 대신 마운트 시 1회 자동 실행.
  //   videoCompositor 의 source 오디오는 이미 muted 로 처리되므로 §FIX-V 원인은 해소됐고,
  //   실패 시 "다시 시도" 버튼은 기존대로 노출되어 재생성 가능.
  const autoComposedRef = useRef(false);

  // Handlers
  const handleCompose = useCallback(async () => {
    const t = layeredTemplate || videoTemplate;
    if (!t || !rawVideoUri) return;
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
      const resultBlob = await composeVideo(t as any, clips, p => setProgress(p));
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

  // ─── 하이라이트 합성 (자동 큐레이션) ──────────────────────────────────────
  const buildHighlight = useCallback(async () => {
    if (highlightStartedRef.current || highlightUri) return;
    if (!rawVideoUri) {
      setHighlightError('원본 영상이 아직 준비되지 않았어요');
      return;
    }
    highlightStartedRef.current = true;
    setHighlightBuilding(true);
    setHighlightError(null);
    setHighlightProgress({ phase: '점수 분석', percent: 0.01 });
    try {
      const timeline = getScoreTimeline().build();
      try { await stashScoreTimeline(timeline); } catch {}

      // 원본 영상 길이 추정 — frameTags 마지막 timestamp 기준 (없으면 60초 폴백).
      const totalDurationMs = frameTags.length > 0
        ? frameTags[frameTags.length - 1].timestamp_ms + 1000
        : (activeTemplate?.duration_sec ?? 60) * 1000;

      const segments = selectHighlights(timeline, {
        totalDurationMs,
        targetTotalMs: 30_000,
        toleranceMs: 5_000,
      });
      if (segments.length === 0) {
        throw new Error('성공 구간을 찾지 못했어요. 더 도전해보세요!');
      }
      setHighlightSegCount(segments.length);
      setHighlightDurMs(totalDurationOf(segments));

      const resp = await fetch(rawVideoUri);
      const sourceBlob = await resp.blob();

      const result = await composeHighlight(sourceBlob, {
        segments,
        onProgress: (p) => setHighlightProgress(p),
      });
      const url = URL.createObjectURL(result.blob);
      setHighlightBlob(result.blob);
      setHighlightUri(url);
      try { await stashHighlightVideo(result.blob, result.mime); } catch {}
    } catch (e) {
      setHighlightError(e instanceof Error ? e.message : '하이라이트 생성 실패');
      highlightStartedRef.current = false;
    } finally {
      setHighlightBuilding(false);
    }
  }, [rawVideoUri, frameTags, activeTemplate, highlightUri]);

  // 모드를 highlight 로 토글하는 순간 1회 자동 빌드.
  useEffect(() => {
    if (viewMode === 'highlight' && !highlightUri && !highlightBuilding) {
      buildHighlight();
    }
  }, [viewMode, highlightUri, highlightBuilding, buildHighlight]);

  // FIX-AUTO-COMPOSE (2026-04-24): /result 진입 직후 합성을 자동 실행.
  //   - autoComposedRef 로 멱등 보장 (StrictMode 중복 실행·리렌더 재실행 차단).
  //   - 템플릿/원본 영상 준비가 안 된 시점엔 handleCompose 가 조용히 early-return.
  //   - 합성 실패 시 composeError UI + "다시 시도" 버튼이 기존대로 살아있어 사용자가 재시도 가능.
  useEffect(() => {
    if (autoComposedRef.current) return;
    const t = layeredTemplate || videoTemplate;
    if (!t || !rawVideoUri) return;
    if (composing || composedUri) return;
    autoComposedRef.current = true;
    handleCompose();
  }, [layeredTemplate, videoTemplate, rawVideoUri, composing, composedUri, handleCompose]);

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

  const [navigating, setNavigating] = useState(false);
  const goHome = useCallback(() => {
    // FIX-NAV v7 (2026-04-23): ErrorBoundary 깜빡임 완전 차단.
    //   1) window.__navigatingHome=true → ErrorBoundary 가 이 플래그를 보면 에러 UI
    //      대신 투명 View 를 반환 (언마운트 중 throw 를 삼킴).
    //   2) navigating=true → 현재 페이지 트리 즉시 스켈레톤.
    //   3) 같은 tick 에서 location.replace 로 바로 네비 — rAF 대기 없음.
    if (typeof window !== 'undefined') {
      (window as any).__navigatingHome = true;
    }
    setNavigating(true);
    try { if (composedUri) URL.revokeObjectURL(composedUri); } catch {}
    if (typeof window !== 'undefined' && window.location) {
      try { window.location.replace('/home?_b=' + Date.now()); return; }
      catch { window.location.href = '/home?_b=' + Date.now(); return; }
    }
    try { router.replace('/'); } catch {}
  }, [composedUri, router]);

  const doRetake = useCallback(() => {
    if (composedUri) URL.revokeObjectURL(composedUri);
    // Team RELIABILITY (2026-04-22): 완전 리셋 후 새 세션 시작 → record 화면이
    //   잔존 frameTags/timeline/isRecording 없이 clean slate 로 remount.
    try { fullResetForRetake(); } catch {}
    if (activeTemplate) startSession(activeTemplate);
    router.replace('/record');
  }, [activeTemplate, startSession, fullResetForRetake, composedUri, router]);

  // ── 초대 핸들러 ──────────────────────────────────────────────
  const [inviteToast, setInviteToast] = useState<string>('');

  const templateSlug = useMemo(() => {
    // FIX-INVITE-2026-04-23: 공식 슬러그로 정규화해 수신자측 매칭 실패 방지.
    return pickOfficialSlug(activeTemplate);
  }, [activeTemplate]);

  /** "친구에게 챌린지 도전장 보내기" — utils/share.ts 단일 진입점. */
  const handleSendInvite = useCallback(async () => {
    setInviteToast('🥊 도전장 준비 중...');
    if (!activeTemplate) {
      setInviteToast('오류: 템플릿 정보 없음 — 결과 페이지를 다시 열어주세요');
      setTimeout(() => setInviteToast(''), 3000);
      return;
    }
    const tid = activeTemplate.id;
    const thumb =
      SUPABASE_TEMPLATE_THUMBNAILS[tid]?.largeURL
      || SUPABASE_TEMPLATE_THUMBNAILS[tid]?.url
      || TEMPLATE_THUMBNAILS[tid]?.largeURL
      || TEMPLATE_THUMBNAILS[tid]?.url
      || (activeTemplate as any).thumbnail_url
      || getThumbnailUrl((activeTemplate as any).genre, tid, 1280);
    try {
      const res = await shareInvite({
        slug: templateSlug,
        fromName: mySenderName,
        templateName: activeTemplate.name,
        score: scoreNum,
        thumbnailUrl: thumb,
      });
      setInviteToast(res.message);
      setTimeout(() => setInviteToast(''), 3200);
    } catch (e: any) {
      setInviteToast(`도전장 생성 실패: ${e?.message || e?.name || 'Unknown'}`);
      setTimeout(() => setInviteToast(''), 4500);
    }
  }, [activeTemplate, templateSlug, mySenderName, scoreNum]);

  // handleReplyBack 제거됨 — 답장(reply) 기능은 back-channel 보장 불가로 삭제.
  // 상세는 utils/share.ts 의 NOTE 참조.

  const hPad = Math.min(20, (width - 360) / 2 + 16);

  // FIX-NAV v6: 홈으로 이동하는 순간 기존 트리를 떼어내 ErrorBoundary 깜빡임 방지
  if (navigating) {
    return (
      <SafeAreaView style={[st.root, { alignItems:'center', justifyContent:'center' }]} edges={['top','bottom']}>
        <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:14 }}>홈으로 이동 중…</Text>
      </SafeAreaView>
    );
  }

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

      <ShareSheet
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={{
          mode: 'video',
          source: (composedBlob ?? (composedUri ?? rawVideoUri)) as Blob | string,
          caption: shareText,
          templateName: activeTemplate?.name ?? '챌린지',
          scoreNum,
        }}
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
          <TouchableOpacity
            onPress={goHome}
            style={st.backBtn}
            accessibilityRole="button"
            accessibilityLabel="홈 화면으로 돌아가기"
          >
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
                const mission = Array.isArray(activeTemplate?.missions) ? activeTemplate!.missions.find(m => m.seq === mr.seq) : undefined;
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

          {/* ── 모드 토글: 전체 / 하이라이트 (자동 큐레이션) ─────── */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignSelf: 'center' }}>
            <TouchableOpacity
              onPress={() => setViewMode('full')}
              accessibilityRole="button"
              accessibilityLabel="전체 영상 보기"
              accessibilityState={{ selected: viewMode === 'full' }}
              style={{
                paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: viewMode === 'full' ? accentColor : 'rgba(0,0,0,0.06)',
                // @ts-ignore web
                boxShadow: viewMode === 'full' ? `0 4px 12px ${accentColor}44` : 'none',
              }}
            >
              <Text style={{
                color: viewMode === 'full' ? '#fff' : '#444',
                fontSize: 13, fontWeight: '700',
              }}>📼 전체 영상</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('highlight')}
              accessibilityRole="button"
              accessibilityLabel="하이라이트 영상 보기 (자동 큐레이션)"
              accessibilityState={{ selected: viewMode === 'highlight' }}
              style={{
                paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: viewMode === 'highlight' ? accentColor : 'rgba(0,0,0,0.06)',
                // @ts-ignore web
                boxShadow: viewMode === 'highlight' ? `0 4px 12px ${accentColor}44` : 'none',
              }}
            >
              <Text style={{
                color: viewMode === 'highlight' ? '#fff' : '#444',
                fontSize: 13, fontWeight: '700',
              }}>✨ 하이라이트</Text>
            </TouchableOpacity>
          </View>

          {/* 하이라이트 모드 진행/에러 표시 */}
          {viewMode === 'highlight' && highlightBuilding && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={accentColor} />
              <Text style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                {highlightProgress?.phase ?? '하이라이트 만드는 중...'}
                {' '}
                ({Math.round(((highlightProgress?.percent ?? 0) * 100))}%)
              </Text>
            </View>
          )}
          {viewMode === 'highlight' && highlightError && (
            <View style={st.errorBox}>
              <Text style={st.errorText}>⚠️ {highlightError}</Text>
              <TouchableOpacity
                style={st.retryBtn}
                onPress={() => { highlightStartedRef.current = false; buildHighlight(); }}
                accessibilityRole="button"
                accessibilityLabel="하이라이트 다시 시도"
              >
                <Text style={st.retryBtnText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}
          {viewMode === 'highlight' && highlightUri && !highlightBuilding && (
            <Text style={{ textAlign: 'center', fontSize: 12, color: '#555', marginBottom: 6 }}>
              {highlightSegCount}개 구간 · 총 {(highlightDurMs / 1000).toFixed(1)}초
            </Text>
          )}

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

          {/* Video player: highlight > composed > raw */}
          {(composedUri || rawVideoUri || highlightUri) && (
            <View style={st.videoWrap}>
              {/* @ts-ignore */}
              <video
                src={viewMode === 'highlight' && highlightUri
                  ? highlightUri
                  : (composedUri ?? rawVideoUri)}
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
                accessibilityRole="button"
                accessibilityLabel="완성 영상 합성 시작"
                accessibilityHint="녹화 영상과 템플릿을 합성해 SNS 용 완성본을 만듭니다"
                accessibilityState={{ disabled: !rawVideoUri }}
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
              <TouchableOpacity
                style={st.retryBtn}
                onPress={handleCompose}
                accessibilityRole="button"
                accessibilityLabel="영상 합성 다시 시도"
              >
                <Text style={st.retryBtnText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action buttons */}
          <View style={st.actionRow}>
            <TouchableOpacity
              style={st.downloadBtn}
              onPress={async () => {
                // TEAM-DOWNLOAD (2026-04-23): await 보장 — 저장 실패해도 사용자가 알 수 있도록.
                await doDownload(composedUri ?? rawVideoUri, activeTemplate?.name ?? 'challenge', composedBlob?.type).catch(() => false);
              }}
              disabled={!composedUri && !rawVideoUri}
              accessibilityRole="button"
              accessibilityLabel="영상 저장"
              accessibilityHint="완성 영상을 기기 갤러리에 다운로드합니다"
              accessibilityState={{ disabled: !composedUri && !rawVideoUri }}
            >
              <Text style={st.downloadText}>📥 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.shareBtn, {
                backgroundColor: accentColor,
                // @ts-ignore web gradient
                backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, #ec4899 100%)`,
                boxShadow: `0 8px 22px ${accentColor}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
                opacity: (composing || (!composedUri && !rawVideoUri)) ? 0.55 : 1,
              } as any]}
              onPress={() => setShowShareModal(true)}
              disabled={composing || (!composedUri && !rawVideoUri)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={composing ? '영상 준비 중' : 'SNS 공유 메뉴 열기'}
              accessibilityState={{ disabled: composing || (!composedUri && !rawVideoUri) }}
            >
              <Text style={st.shareText}>
                {composing ? '⏳ 영상 준비 중...' : '📤 SNS 공유'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── 친구 초대 ────────────────────────────────────────────
              답장(reply) 버튼은 제거됨 — 서버 없는 환경에서는 원 초대자에게
              되돌아갈 back-channel 이 보장되지 않는다. 대신 여기서는 항상
              "도전장 보내기" 로 현재 챌린지를 (또 다른) 친구에게 공유.
              핸들러는 멱등이므로 탭마다 새 공유 시트가 뜬다. */}
          <View style={st.inviteBlock}>
            {inviteContext ? (
              <Text style={st.inviteHint}>
                🥊 {inviteContext.fromName}님이 보낸 도전장을 완료했어요
              </Text>
            ) : null}
            <TouchableOpacity
              style={st.inviteBtn}
              onPress={handleSendInvite}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="친구에게 챌린지 도전장 보내기"
              accessibilityHint="공유 시트를 열어 친구에게 도전장을 전송합니다"
            >
              <Text style={st.inviteBtnText}>
                🥊 친구에게 챌린지 도전장 보내기
              </Text>
            </TouchableOpacity>
            {inviteToast ? (
              <View style={st.inviteToast}>
                <Text style={st.inviteToastText}>{inviteToast}</Text>
              </View>
            ) : null}
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
              accessibilityRole="button"
              accessibilityLabel={saving ? '내 기록 저장 진행 중' : '내 기록 저장하기'}
              accessibilityState={{ disabled: saving, busy: saving }}
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
          <TouchableOpacity
            style={st.retakeBtn}
            onPress={doRetake}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="다시 도전하기"
            accessibilityHint="같은 챌린지를 처음부터 다시 시작합니다"
          >
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
            accessibilityRole="button"
            accessibilityLabel="홈으로 돌아가기"
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
  bigBarLabel: { color: '#D1D5DB', fontSize: 12, fontWeight: '600', width: 52 },
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
  retryBtn:     { backgroundColor: '#7c3aed', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Invite block (친구 초대)
  inviteBlock: {
    marginTop: 12,
    gap: 8,
  },
  inviteHint: {
    color: '#ec4899',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  inviteBtn: {
    backgroundColor: 'rgba(236,72,153,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.55)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  inviteBtnText: {
    color: '#ec4899',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  inviteToast: {
    marginTop: 4,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  inviteToastText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },

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
