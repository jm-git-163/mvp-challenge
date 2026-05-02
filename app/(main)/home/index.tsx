/**
 * home/index.tsx — Pro rebuild
 * Linear/Notion-grade design. Monochrome, typography-first, thumbnail-centric.
 * No emoji chrome, no gradients, no bouncing animations.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { useInviteStore } from '../../../store/inviteStore';
import { shareInvite } from '../../../utils/share';
import { pickOfficialSlug } from '../../../utils/officialSlug';
import type { Template } from '../../../types/template';
import { getThumbnailUrl } from '../../../utils/thumbnails';
import { TEMPLATE_THUMBNAILS } from '../../../services/templateThumbnails';
import { SUPABASE_TEMPLATE_THUMBNAILS } from '../../../services/supabaseThumbnails';
import PermissionWelcomeModal from '../../../components/permissions/PermissionWelcomeModal';
import ResourceDebugOverlay from '../../../components/permissions/ResourceDebugOverlay';
import A11ySettingsPanel from '../../../components/ui/A11ySettingsPanel';
import { GZ, GZGradient, GZFont, GZRadius, GZShadow } from '../../../constants/genzPalette';

// ─── Design tokens (Gen-Z 리브랜드 2026-04-23) ───────────────────────────────
// 토큰은 constants/genzPalette.ts 가 단일 소스. 이 모듈은 alias 만 둔다.
const T = {
  bg:           'transparent',         // 배경은 +html.tsx 의 mesh gradient
  surface:      GZ.surface,
  surfaceStrong:GZ.surfaceStrong,
  ink:          GZ.ink,
  inkSub:       GZ.inkSub,
  inkMuted:     GZ.inkMuted,
  inkFaint:     GZ.inkFaint,
  border:       GZ.border,
  borderStrong: GZ.borderStrong,
  accent:       GZ.pink,
  fontSans:     GZFont.sans,
  fontMono:     GZFont.mono,
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
  onInvite: (t: Template) => void;
}

function ChallengeCard({ item: t, width, onPress, onInvite }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const genreLabel = GENRE_LABEL_MAP[t.genre] ?? t.genre;
  const diffLabel  = DIFF_LABELS[t.difficulty] ?? '';
  const missionSummary = useMemo(() => {
    // FIX-INVITE-E2E-V2 (2026-04-23): layered 템플릿 등 missions 누락 케이스 방어.
    const ms = Array.isArray((t as any).missions) ? (t as any).missions : [];
    const types = [...new Set(ms.map((m: any) => m?.type).filter(Boolean))];
    return types.map(ty => MISSION_LABEL[ty as string] ?? ty).join(' · ');
  }, [t]);
  const durSec = Number((t as any).duration_sec ?? (t as any).duration ?? 0) || 0;
  const mins = Math.floor(durSec / 60);
  const secs = durSec % 60;
  const timeLabel = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <Pressable
      onPress={() => onPress(t)}
      onLongPress={() => onInvite(t)}
      delayLongPress={420}
      // @ts-ignore web
      onHoverIn={() => setHovered(true)}
      // @ts-ignore web
      onHoverOut={() => setHovered(false)}
      style={[
        card.wrap,
        { width },
        hovered && card.wrapHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t.name} 챌린지 시작, ${genreLabel} 장르, ${timeLabel} 길이`}
      accessibilityHint="탭하면 챌린지를 시작합니다. 길게 누르면 친구에게 도전장을 보낼 수 있습니다"
    >
      {/* 16:9 thumbnail — real Unsplash image.
          FIX-THUMBS v12 (2026-04-23): key=uri 로 URL 이 바뀌면 RN Image 인스턴스가
          교체되어 강제 재요청. BUILD_ID 쿼리가 들어가 있으므로 배포마다 새 URL → 새 이미지. */}
      {(() => {
        const uri = SUPABASE_TEMPLATE_THUMBNAILS[t.id]?.url || TEMPLATE_THUMBNAILS[t.id]?.url || t.thumbnail_url || getThumbnailUrl(t.genre, t.id, 640);
        return (
      <View style={card.thumb}>
        <Image
          key={uri}
          source={{ uri }}
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
        );
      })()}

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
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onInvite(t); }}
          style={card.inviteChip}
          accessibilityRole="button"
          accessibilityLabel={`${t.name} 도전장 보내기`}
          accessibilityHint="친구에게 공유 링크를 보냅니다"
        >
          <Text style={card.inviteChipText}>🥊 친구에게 도전장 보내기</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: GZ.surfaceCard,
    borderRadius: GZRadius.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    // @ts-ignore web
    transition: 'border-color 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease',
    // @ts-ignore web
    cursor: 'pointer',
    // @ts-ignore web
    backdropFilter: 'blur(14px) saturate(140%)',
    // @ts-ignore web
    boxShadow: GZShadow.card,
  },
  wrapHover: {
    borderColor: GZ.borderHot,
    // @ts-ignore web
    transform: 'translateY(-3px) scale(1.012)',
    // @ts-ignore web
    boxShadow: GZShadow.glowPink,
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1B1130',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    // @ts-ignore web — vivid bottom shade for legibility
    background: 'linear-gradient(180deg, rgba(15,10,31,0) 45%, rgba(15,10,31,0.78) 100%)',
  },
  playBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore web — gradient pink→cyan glow
    background: GZGradient.primary,
    // @ts-ignore web
    boxShadow: GZShadow.cta,
  },
  playTri: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderTopColor: 'transparent',
    borderBottomWidth: 7,
    borderBottomColor: 'transparent',
    borderLeftWidth: 11,
    borderLeftColor: '#FFFFFF',
  },
  diffTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: GZ.highlight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  diffTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: GZ.inkOnLight,
    letterSpacing: 0.3,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.4,
    lineHeight: 22,
    fontFamily: T.fontSans,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 12,
    color: T.inkSub,
    fontWeight: '600',
    fontFamily: T.fontSans,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: GZ.pink,
  },
  inviteChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.45)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  inviteChipText: {
    color: GZ.pink,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
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
              style={[gf.item, active && gf.itemActive]}
              accessibilityRole="tab"
              accessibilityLabel={`${g.label} 장르 필터`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[gf.label, active ? gf.labelActive : gf.labelInactive]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const gf = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GZ.border,
    backgroundColor: GZ.surface,
    // @ts-ignore web
    transition: 'transform 140ms ease, background 200ms ease, border-color 200ms ease',
    // @ts-ignore web
    backdropFilter: 'blur(10px)',
  },
  itemActive: {
    borderColor: 'transparent',
    // @ts-ignore web — gradient pill
    background: GZGradient.primary,
    // @ts-ignore web
    boxShadow: GZShadow.glowPink,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
    fontFamily: T.fontSans,
  },
  labelActive:   { color: '#FFFFFF' },
  labelInactive: { color: T.inkSub },
  underline: { height: 0, width: 0 },
  underlineActive: { height: 0 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // TEAM-UX (2026-04-23 v3): 사용자 최종 결정 — "화이트 모드 없어도 된다.
  //   그냥 바탕을 어둡게." 다크 고정. 토글 버튼 제거, localStorage 의존성 제거.
  //   html.motiq-dark 클래스를 마운트 시 영구 부착.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('motiq-dark');
  }, []);

  const startSession = useSessionStore(s => s.startSession);
  const mySenderName = useInviteStore(s => s.mySenderName);
  const inviteContext = useInviteStore(s => s.inviteContext);
  const clearInvite = useInviteStore(s => s.clearInvite);
  const [inviteToast, setInviteToast] = useState('');

  const { templates: rawTemplates, loading, error, refetch } = useTemplates(
    selectedGenre !== 'all' ? { genre: selectedGenre as Template['genre'] } : undefined,
  );

  // FIX-WHITELIST (2026-05-02): 사용자가 명시한 13개 의도 챌린지만 노출.
  //   mockData.ts 에는 22개가 있지만, 9개는 사용자가 시킨 적 없는 구버전·중복·세션 더미.
  //   mockData 자체는 invite/test 등 다른 경로에서도 import 되므로 건드리지 않고,
  //   home 진입 시점의 렌더 직전에 화이트리스트로 필터.
  //   /templates 라우트는 현재 존재하지 않음 (홈 = 단일 노출 지점).
  const ALLOWED_TEMPLATE_IDS = useMemo(() => new Set([
    'daily-vlog-001','news-anchor-002','english-lesson-003','fairy-tale-004',
    'travel-cert-005','product-unbox-006','kpop-idol-007','fitness-squat-master-008',
    'english-speak-009','kids-story-010','travel-vlog-011','hiphop-cypher-012','dance-hiphop-001',
  ]), []);
  const templates = useMemo(
    () => rawTemplates.filter(t => ALLOWED_TEMPLATE_IDS.has(t.id)),
    [rawTemplates, ALLOWED_TEMPLATE_IDS],
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
    async (t: Template) => {
      // FIX-G (2026-04-21): 카메라·마이크 권한 요청을 "사용자 제스처 스택 안"에서 수행.
      //   _layout 의 useEffect 경로는 Chrome·Android 에서 user-gesture 미만으로 판정되어
      //   팝업 자체가 뜨지 않음. 템플릿 카드 클릭은 확실한 gesture → 여기서 한 번 잡으면
      //   오리진에 permission 캐시 → 이후 /record 진입 시 팝업 0.
      // FIX-H2 (2026-04-21): 권한만 획득, 트랙은 즉시 종료.
      //   스트림을 살려두면 안드로이드 Chrome 에서 SpeechRecognition 이 같은 마이크에
      //   동시 접근 시 audio 를 못받아 results 가 안올라감. 권한은 origin 단위로
      //   브라우저에 캐싱되므로 RecordingCamera 에서 재호출해도 팝업 없음.
      // FIX-PERM-SINGLE (2026-04-23): 홈 preflight 에서 스트림을 stop 하지 말고
      //   __permissionStream 에 살려두기. RecordingCamera 가 이를 재사용해 추가 팝업 방지.
      //   이전 버전은 stop 후 origin 캐시에 의존했지만 iOS Safari/일부 Android 에서
      //   재요청 시 팝업이 다시 뜨는 회귀 발생.
      // FIX-MIC-SINGLETON (2026-04-23): 직접 getUserMedia 호출 제거.
      //   ensureMediaSession() 이 이미 살아있는 스트림을 반환하면 재호출 0.
      //   홈 PermissionWelcomeModal 에서 이미 잡아둔 세션을 그대로 재사용.
      if (typeof window !== 'undefined') {
        try {
          const { ensureMediaSession } = await import('../../../engine/session/mediaSession');
          const stream = await ensureMediaSession();
          (window as any).__permissionGranted = true;
          (window as any).__permissionStream = stream;
        } catch (e) {
          if (typeof console !== 'undefined') console.warn('[permission] denied or failed:', e);
        }
      }
      startSession(t);
      router.push('/record');
    },
    [startSession, router],
  );

  const handleInvite = useCallback(async (t: Template) => {
    // 단일 진입점: utils/share.ts 의 shareInvite 가 전체 플로우 (URL 생성 →
    // 클립보드 → PNG 카드 → Web Share → 폴백) 를 책임진다. 여기서는 결과를
    // 토스트로 표면화하기만 한다. 문서: docs/SHARE_ARCHITECTURE.md.
    setInviteToast('🥊 도전장 준비 중...');
    const slug = pickOfficialSlug(t);
    const thumb =
      SUPABASE_TEMPLATE_THUMBNAILS[t.id]?.largeURL
      || SUPABASE_TEMPLATE_THUMBNAILS[t.id]?.url
      || TEMPLATE_THUMBNAILS[t.id]?.largeURL
      || TEMPLATE_THUMBNAILS[t.id]?.url
      || (t as any).thumbnail_url
      || getThumbnailUrl(t.genre, t.id, 1280);
    try {
      const res = await shareInvite({
        slug,
        fromName: mySenderName,
        templateName: t.name,
        thumbnailUrl: thumb,
      });
      setInviteToast(res.message);
      setTimeout(() => setInviteToast(''), 3200);
    } catch (e: any) {
      setInviteToast(`도전장 생성 실패: ${e?.message || e?.name || 'Unknown'}`);
      setTimeout(() => setInviteToast(''), 4500);
    }
  }, [mySenderName]);

  const renderCard = useCallback(
    ({ item }: { item: Template }) => (
      <ChallengeCard item={item} width={cardW} onPress={handleSelect} onInvite={handleInvite} />
    ),
    [cardW, handleSelect, handleInvite],
  );

  const keyExtractor = useCallback((t: Template) => t.id, []);

  return (
    <View style={[s.root, { backgroundColor: '#050509' }]}>
      {/* Team RELIABILITY (2026-04-22): 홈 최초 진입 시 1회 권한 안내 모달.
          허용 시 origin 에 권한이 캐시되어 카드 클릭/ /record 에서 팝업 없음. */}
      <PermissionWelcomeModal />
      <ResourceDebugOverlay />
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
              accessibilityRole="link"
              accessibilityLabel="프로필 페이지 열기"
              accessibilityHint="기록과 설정 화면으로 이동합니다"
            >
              <Text style={s.iconBtnText}>프로필</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* TEAM-UX (2026-04-23): 자가진단 배너는 상단에서 제거 — 메인 시선 방해.
          프로필 화면에서 접근 가능 (또는 직접 /selftest URL).
          사용자 피드백: "자가진단 열기 저거는 없애거나 하단으로". */}

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
            {/* INVITE-BANNER (2026-04-23): inviteContext 가 살아있으면 홈에도 리본 노출.
                미완료 도전장 컨텍스트를 시각적으로 환기 — 사용자가 도전장 존재를 잊지 않게. */}
            {inviteContext ? (
              <Pressable
                style={s.inviteBanner}
                onPress={() => router.push(`/challenge/${inviteContext.slug}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`${inviteContext.fromName}님의 도전장 수락 페이지로 이동`}
                accessibilityHint="탭하여 챌린지 상세로 이동합니다"
              >
                <Text style={s.inviteBannerText} numberOfLines={2}>
                  🥊 {inviteContext.fromName}님의 도전장이 대기 중
                </Text>
                <Text style={s.inviteBannerSub} numberOfLines={1}>
                  탭하면 챌린지로 이동 · 길게 눌러 닫기
                </Text>
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); clearInvite(); }}
                  style={s.inviteBannerClose}
                  accessibilityRole="button"
                  accessibilityLabel="도전장 닫기"
                  accessibilityHint="대기 중인 도전장을 무시하고 배너를 제거합니다"
                >
                  <Text style={s.inviteBannerCloseText}>✕</Text>
                </Pressable>
              </Pressable>
            ) : null}
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
              <Pressable
                onPress={refetch}
                style={s.retryBtn}
                accessibilityRole="button"
                accessibilityLabel="챌린지 목록 다시 불러오기"
              >
                <Text style={s.retryBtnText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.emptyText}>선택한 장르에 챌린지가 없습니다</Text>
            </View>
          )
        }
        ListFooterComponent={
          // TEAM-UX (2026-04-23 v3): 자가진단은 하단 작은 링크로 이동.
          <Pressable
            onPress={() => router.push('/selftest')}
            style={s.footerLink}
            accessibilityRole="link"
            accessibilityLabel="자가진단 열기"
            accessibilityHint="카메라·마이크·네트워크 상태를 점검합니다"
          >
            <Text style={s.footerLinkText}>🩺 자가진단 열기</Text>
          </Pressable>
        }
      />
      {inviteToast ? (
        <View
          style={s.inviteToast}
          pointerEvents="none"
          // @ts-ignore web — 스크린리더가 토스트 내용을 즉시 알림
          accessibilityLiveRegion="polite"
          role="status"
        >
          <Text style={s.inviteToastText}>{inviteToast}</Text>
        </View>
      ) : null}

      {/* A11Y (2026-04-24): 접근성 설정 FAB — 고대비/자막/햅틱/글자크기. */}
      <A11ySettingsPanel />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  inviteToast: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'center',
    maxWidth: 520,
    // @ts-ignore web
    boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
  },
  inviteToastText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerLink: {
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  footerLinkText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  safeTop: {
    backgroundColor: 'transparent',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: Platform.select({
    web: {
      width: 22,
      height: 22,
      borderRadius: 8,
      // @ts-ignore web
      background: GZGradient.primary,
      // @ts-ignore web
      boxShadow: GZShadow.glowPink,
    } as any,
    default: { width: 22, height: 22, borderRadius: 8, backgroundColor: GZ.pink },
  }) as any,
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: T.ink,
    fontFamily: T.fontSans,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selftestBanner: Platform.select({
    web: {
      marginTop: 10,
      marginBottom: 6,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: GZRadius.panel,
      // @ts-ignore web
      background: GZGradient.hot,
      // @ts-ignore web
      boxShadow: GZShadow.glowPink,
      // @ts-ignore web
      cursor: 'pointer',
    } as any,
    default: {
      marginTop: 10, marginBottom: 6, paddingVertical: 14, paddingHorizontal: 16,
      borderRadius: 16, backgroundColor: GZ.pink,
    },
  }) as any,
  selftestBannerList: Platform.select({
    web: {
      marginBottom: 16,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: GZRadius.panel,
      // @ts-ignore web
      background: GZGradient.hot,
      // @ts-ignore web
      boxShadow: GZShadow.glowPink,
      // @ts-ignore web
      cursor: 'pointer',
    } as any,
    default: {
      marginBottom: 16, paddingVertical: 16, paddingHorizontal: 18,
      borderRadius: 16, backgroundColor: GZ.pink,
    },
  }) as any,
  selftestBannerT: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontFamily: T.fontSans,
  },
  selftestBannerSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
    fontFamily: T.fontSans,
  },
  iconBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GZ.borderStrong,
    // TEAM-UX (2026-04-23): "메뉴 안 보인다" 피드백.
    //   이전 GZ.surface(8% 흰색) 은 밝은 네온 mesh 위에서 거의 안 보임.
    //   검정 반투명 (65%) 으로 바꿔 두 모드 모두에서 선명.
    backgroundColor: 'rgba(15,10,31,0.65)',
    // @ts-ignore web
    cursor: 'pointer',
    // @ts-ignore web
    transition: 'border-color 140ms ease, background-color 140ms ease',
    // @ts-ignore web
    backdropFilter: 'blur(10px)',
  },
  iconBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.1,
    fontFamily: T.fontSans,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 120,
    alignSelf: 'center',
    width: '100%',
  },
  listHeader: {
    paddingBottom: 28,
    paddingTop: 8,
    gap: 6,
  },
  inviteBanner: {
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.55)',
    backgroundColor: 'rgba(236,72,153,0.12)',
    position: 'relative',
    // @ts-ignore web
    boxShadow: '0 6px 18px rgba(236,72,153,0.25)',
    gap: 4,
  },
  inviteBannerText: {
    color: '#ec4899',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  inviteBannerSub: {
    color: 'rgba(236,72,153,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  inviteBannerClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBannerCloseText: {
    color: '#ec4899',
    fontSize: 14,
    fontWeight: '800',
  },
  h1: Platform.select({
    web: {
      fontSize: 48,
      fontWeight: '900',
      letterSpacing: -1.6,
      lineHeight: 54,
      // @ts-ignore web — gradient text
      backgroundImage: GZGradient.text,
      // @ts-ignore web
      WebkitBackgroundClip: 'text',
      // @ts-ignore web
      backgroundClip: 'text',
      // @ts-ignore web
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      fontFamily: T.fontSans,
    } as any,
    default: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: T.ink, fontFamily: T.fontSans },
  }) as any,
  h1Sub: {
    fontSize: 14,
    color: T.inkSub,
    fontWeight: '600',
    letterSpacing: -0.2,
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
  retryBtn: Platform.select({
    web: {
      minHeight: 44,
      minWidth: 44,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      // @ts-ignore web
      background: GZGradient.primary,
      // @ts-ignore web
      boxShadow: GZShadow.cta,
      // @ts-ignore web
      cursor: 'pointer',
    } as any,
    default: {
      minHeight: 44, minWidth: 44, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
      alignItems: 'center', justifyContent: 'center', backgroundColor: GZ.pink,
    },
  }) as any,
  retryBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.1,
    fontFamily: T.fontSans,
  },
});
