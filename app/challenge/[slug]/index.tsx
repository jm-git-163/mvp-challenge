/**
 * app/challenge/[slug]/index.tsx
 *
 * 챌린지 초대 진입 라우트. 친구가 공유한 딥링크로 들어오면:
 *   1) 쿼리스트링 파싱 → inviteStore.setInviteContext
 *   2) 템플릿 로드 (slug → Template)
 *   3) "도전장을 받았어요" 배너 + 미리보기 + "수락하고 촬영 시작"
 *   4) 수락 시 sessionStore.startSession(t) + router.replace('/record')
 *
 * 서버 호출·업로드 없음. 모든 상태는 쿼리스트링과 Zustand 에만 존재.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTemplates } from '../../../hooks/useTemplates';
import { MOCK_TEMPLATES } from '../../../services/mockData';
import { useSessionStore } from '../../../store/sessionStore';
import { useInviteStore } from '../../../store/inviteStore';
import { parseInviteUrl, buildInviteBannerText, type InviteContext } from '../../../utils/inviteLinks';
import { pickOfficialSlug } from '../../../utils/officialSlug';
import { SUPABASE_TEMPLATE_THUMBNAILS } from '../../../services/supabaseThumbnails';
import { TEMPLATE_THUMBNAILS } from '../../../services/templateThumbnails';
import { getThumbnailUrl } from '../../../utils/thumbnails';
// FIX-INVITE-KAKAO-LOOP (2026-04-24): 정적 import — accept() 의 dynamic import() 는
//   user-gesture 스택을 이탈시켜 Kakao in-app / Chrome 에서 getUserMedia 가 조용히
//   재프롬프트되는 원인. 모듈을 번들에 동봉해 await 없이 바로 호출 가능하게 한다.
import { ensureMediaSession } from '../../../engine/session/mediaSession';
import { isKakaoInAppBrowser } from '../../../utils/inviteShareCard';
import type { Template } from '../../../types/template';

export default function ChallengeInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string; from?: string; msg?: string; score?: string; c?: string }>();
  const startSession = useSessionStore(s => s.startSession);
  const setInviteContext = useInviteStore(s => s.setInviteContext);

  // FIX-INVITE-2026-04-23: v2 `?c=<base64url>` + v1 `?from=&msg=&score=` 양쪽 지원.
  //   expo-router 의 useLocalSearchParams 는 모든 key 를 파싱하므로 여기서 다시 조립.
  //   Web 환경에선 window.location.href 를 1순위로 사용 (expo-router 가 일부 파라미터를
  //   놓치는 엣지케이스 방어).
  const { ctx, fullUrl } = useMemo(() => {
    // FIX-INVITE-E2E (2026-04-23): 수신측은 무조건 **window.location.href 를 1순위**
    //   로 파싱. expo-router 의 useLocalSearchParams 는 web 에서 초기 렌더 시 빈
    //   객체이거나 일부 쿼리(`c=<base64>`)를 누락하는 사례가 있어 신뢰할 수 없다.
    //   URL 전체를 parseInviteUrl 에 넘기면 `/share/challenge/`, `/challenge/`, `/c/`
    //   세 경로 + v1/v2 쿼리 포맷을 모두 처리한다.
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      const live = window.location.href;
      const parsed = parseInviteUrl(live);
      if (parsed) return { ctx: parsed, fullUrl: live };
    }
    // SSR / no-window 폴백: expo-router params 로 URL 재조립.
    const slug = (params.slug ?? '').toString();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://motiq.app';
    const qs = new URLSearchParams();
    if (params.c)     qs.set('c',     String(params.c));
    if (params.from)  qs.set('from',  String(params.from));
    if (params.msg)   qs.set('msg',   String(params.msg));
    if (params.score) qs.set('score', String(params.score));
    const url = `${origin}/challenge/${slug}?${qs.toString()}`;
    return { ctx: parseInviteUrl(url) as InviteContext | null, fullUrl: url };
  }, [params.slug, params.from, params.msg, params.score, params.c]);

  const { templates, loading } = useTemplates();
  const template: Template | null = useMemo(() => {
    if (!ctx) return null;
    // FIX-INVITE-E2E-V2 (2026-04-23) · FIX-INVITE-KAKAO-LOOP (2026-04-24):
    //   **DB 템플릿(missions/genre/duration_sec 보유) 만 허용**. Layered 스키마는
    //   record/useRecording 이 가정하는 production 필드(duration_sec, missions[])
    //   가 없어 countdown 에서 `NaN * 1000` / `.missions.some is not a function` 로
    //   터진다. 매칭 실패 시 layered fallback 대신 첫 DB 템플릿 또는 null.
    const slugLc = (ctx.slug || '').toLowerCase();

    // 슬러그 → DB id 변환 후보 (UUID 매핑 + legacy 접두 매핑).
    const SLUG_TO_DB_PREFIX: Record<string, string> = {
      'daily-vlog':         'daily-vlog',
      'news-anchor':        'news-anchor',
      'english-speaking':   'english-lesson',
      'storybook-reading':  'fairy-tale',
      'travel-checkin':     'travel-cert',
      'unboxing-promo':     'product-unbox',
      'kpop-dance':         'kpop-idol',
      'food-review':        'food-',
      'motivation-speech':  'motivation-',
      'social-viral':       'social-',
      'squat-master':       'fitness-squat',
    };
    const dbPrefix = SLUG_TO_DB_PREFIX[slugLc] ?? slugLc;

    const isValidDb = (t: any): boolean =>
      t
      && typeof t.duration_sec === 'number'
      && Array.isArray(t.missions);

    // FIX-INVITE-SLUG-ROUTING (2026-04-24): 프로덕션 Supabase 템플릿은 id 가 UUID
    //   ('e2d9cc60-...') 라서 기존 `id.startsWith('fitness-squat')` 등 레거시 접두
    //   매칭이 **단 한 건도** 성립하지 않는다. 결과적으로 `dbHit === undefined` 가
    //   되어 아래 `firstValid` 폴백 (Supabase 가 created_at DESC 로 내려주는 첫
    //   row = 보통 daily-vlog) 이 리턴 → 사용자가 squat 도전장을 보냈는데 수신자는
    //   브이로그를 받는 버그. pickOfficialSlug(t) 는 UUID/레거시 id 양쪽 다 공식
    //   slug 로 정규화하므로, 송신측(pickOfficialSlug 로 slug 결정)과 **동일한 함수**
    //   로 수신측에서도 매칭해 왕복 라운드트립을 보장한다.
    // FIX-INVITE-RESOLVER (2026-04-24): 강건한 다단 매처. 이전 버전은 DB 템플릿만
    //   검사해 (a) 라이브 Supabase 에 없는 slug (예: squat-master — Supabase 는
    //   10개만 있고 fitness 카테고리 미포함), (b) UUID 맵에 누락된 신규 UUID,
    //   (c) Supabase 가 내려주지 않은 필드(missions/duration_sec) 로 인한
    //   isValidDb 탈락 — 이 세 경우에 `null` 이 반환돼 수신자가 항상 "챌린지를
    //   찾을 수 없어요" 화면을 보는 버그.
    //
    //   이제: DB → MOCK_TEMPLATES 순으로 동일 매칭 로직을 돌리고, 그래도 없으면
    //   MOCK_TEMPLATES 에서 genre/pickOfficialSlug 로 fuzzy 매칭. 절대 "첫 번째
    //   템플릿" 같은 임의 폴백은 하지 않음 — 매칭 의도가 명확한 경로만 사용.
    const matchTemplate = (t: any): boolean => {
      if (!t) return false;
      const id = String(t.id ?? '').toLowerCase();
      const slug = String(t.slug ?? '').toLowerCase();
      const themeId = String(t.theme_id ?? '').toLowerCase();
      const genre = String(t.genre ?? '').toLowerCase();
      // 1) 송수신 대칭 — pickOfficialSlug 라운드트립
      try {
        if (pickOfficialSlug(t).toLowerCase() === slugLc) return true;
      } catch { /* ignore */ }
      // 2) 직접·레거시 접두·genre 매칭
      if (id === slugLc || slug === slugLc || themeId === slugLc || genre === slugLc) return true;
      if (dbPrefix && id.startsWith(dbPrefix)) return true;
      return false;
    };

    // Tier 1: 라이브 DB 에서 유효한 템플릿 (duration_sec + missions 보유) 매칭
    const dbHit = templates.find(t => isValidDb(t) && matchTemplate(t));
    if (dbHit) return dbHit;

    // Tier 2: MOCK_TEMPLATES 폴백 — Supabase 가 slug 를 커버하지 못하는 경우
    //   (예: squat-master, plank 등 fitness 장르). MOCK 은 항상 유효한 missions/
    //   duration_sec 를 가지므로 record 페이지가 바로 실행 가능.
    const mockHit = MOCK_TEMPLATES.find(t => isValidDb(t) && matchTemplate(t));
    if (mockHit) return mockHit;

    // Tier 3: 최후 — slug 를 genre 로 변환해 MOCK 에서 같은 장르의 첫 템플릿.
    //   "잘못된 slug 를 첫 템플릿으로 둔갑" 과는 다름. 여기 도달하려면 slug 가
    //   OFFICIAL_CHALLENGE_SLUGS 중 하나였고, 매칭에서 누락된 엣지케이스.
    const SLUG_TO_GENRE: Record<string, string> = {
      'squat-master': 'fitness',
      'kpop-dance': 'kpop',
      'news-anchor': 'news',
      'english-speaking': 'english',
      'storybook-reading': 'kids',
      'travel-checkin': 'travel',
      'unboxing-promo': 'promotion',
      'food-review': 'daily',
      'motivation-speech': 'fitness',
      'social-viral': 'hiphop',
      'daily-vlog': 'daily',
    };
    const targetGenre = SLUG_TO_GENRE[slugLc];
    if (targetGenre) {
      const genreHit = MOCK_TEMPLATES.find(t => isValidDb(t) && String((t as any).genre ?? '').toLowerCase() === targetGenre);
      if (genreHit) return genreHit;
    }

    return null;
  }, [templates, ctx]);

  const [accepting, setAccepting] = useState(false);
  // FIX-KAKAO-INAPP-BANNER (2026-05-01): 카카오톡 webview 진입 감지.
  //   iOS 카카오 webview 는 getUserMedia 차단 → 챌린지 진행 불가. 사용자가 외부
  //   브라우저로 열어야 한다는 명시적 안내. UA 기반 1회 평가 — 이후 클릭으로 닫힘.
  const [showKakaoBanner, setShowKakaoBanner] = useState<boolean>(() => isKakaoInAppBrowser());

  // 수신 시 스토어 세팅
  useEffect(() => {
    if (ctx) setInviteContext(ctx);
  }, [ctx, setInviteContext]);

  // FIX-INVITE-KAKAO-PNG (2026-04-23): OG/Twitter 메타를 런타임에 초대자 컨텍스트로
  //   덮어씀. 카톡/라인이 URL 만 포워드한 경우, 링크 미리보기 페처가 이 메타를
  //   읽어가 "누가·어느 챌린지" 카드를 렌더. 정적 +html.tsx 의 전역 메타보다 우선.
  //   expo-router SPA 환경이라 SSR 은 없지만, 일부 메신저(카톡 데스크톱·in-app)는
  //   JS 실행 후 메타를 수집한다. 실패해도 전역 OG 가 폴백.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!ctx) return;
    const templateName = (template as any)?.name ?? (template as any)?.title ?? ctx.slug;
    const tId = String((template as any)?.id ?? ctx.slug ?? '');
    const tGenre = String((template as any)?.genre ?? 'daily');
    const title = `${ctx.fromName}이(가) ${templateName} 도전장을 보냈어요!`;
    const desc = ctx.message
      ? `"${ctx.message}" — 탭해서 함께 도전하세요`
      : (typeof ctx.score === 'number'
          ? `${ctx.fromName}님의 점수 ${ctx.score}점. 탭해서 함께 도전하세요`
          : '탭해서 함께 도전하세요');
    const img =
      SUPABASE_TEMPLATE_THUMBNAILS[tId]?.largeURL
      || SUPABASE_TEMPLATE_THUMBNAILS[tId]?.url
      || TEMPLATE_THUMBNAILS[tId]?.largeURL
      || TEMPLATE_THUMBNAILS[tId]?.url
      || (tId ? getThumbnailUrl(tGenre, tId, 1280) : '');

    const setMeta = (selector: string, attr: 'content', value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const m = /^meta\[(property|name)="([^"]+)"\]$/.exec(selector);
        if (m) el.setAttribute(m[1], m[2]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    try {
      document.title = title;
      setMeta('meta[property="og:title"]',       'content', title);
      setMeta('meta[property="og:description"]', 'content', desc);
      setMeta('meta[property="og:url"]',         'content', fullUrl);
      if (img) setMeta('meta[property="og:image"]',     'content', img);
      if (img) setMeta('meta[property="og:image:alt"]', 'content', templateName);
      setMeta('meta[name="twitter:title"]',       'content', title);
      setMeta('meta[name="twitter:description"]', 'content', desc);
      if (img) setMeta('meta[name="twitter:image"]', 'content', img);
      setMeta('meta[name="description"]', 'content', desc);
    } catch { /* 메타 조작 실패해도 전역 OG 가 폴백 */ }
  }, [ctx, template, fullUrl]);

  if (!ctx) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorBox}>
          <Text style={s.errTitle}>잘못된 도전장 링크</Text>
          <Text style={s.errBody}>링크가 손상되었거나 만료되었어요.</Text>
          <Pressable style={s.primaryBtn} onPress={() => router.replace('/(main)/home' as any)}>
            <Text style={s.primaryBtnText}>홈으로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator size="large" color="#ec4899" />
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorBox}>
          <Text style={s.errTitle}>챌린지를 찾을 수 없어요</Text>
          <Text style={s.errBody}>이 챌린지는 더 이상 제공되지 않거나 다른 이름으로 변경됐어요.</Text>
          <Pressable style={s.primaryBtn} onPress={() => router.replace('/(main)/home' as any)}>
            <Text style={s.primaryBtnText}>홈으로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // FIX-INVITE-E2E-V2 (2026-04-23): layered template 은 `title` 만 있고 `name`/`genre`/`id`
  //   가 다를 수 있어 모든 접근에 폴백 가드. getThumbnailUrl 은 내부적으로 id.length 를
  //   계산하므로 빈 문자열 폴백 필수 — 이전엔 undefined 가 들어가 "reading length" 발생.
  const tplName = (template as any).name || (template as any).title || ctx.slug;
  const tplId = String((template as any).id ?? ctx.slug ?? 'challenge');
  const tplGenre = String((template as any).genre ?? 'daily');
  const banner = buildInviteBannerText(ctx, tplName);
  const thumbUri =
    SUPABASE_TEMPLATE_THUMBNAILS[tplId]?.url
    || TEMPLATE_THUMBNAILS[tplId]?.url
    || (template as any).thumbnail_url
    || getThumbnailUrl(tplGenre, tplId, 960);

  const accept = async () => {
    if (accepting) return;
    if (!template) return;
    setAccepting(true);
    // FIX-INVITE-KAKAO-LOOP (2026-04-24) · FIX-INVITE-KEEP-ALIVE (2026-04-24):
    //   **정적 import + await** — 홈 경로(handleSelect)와 완전히 동일한 패턴.
    //   dynamic import() 의 네트워크/파싱 지연이 user-gesture 스택을 이탈시켜
    //   Kakao in-app / Chrome 에서 getUserMedia 가 조용히 재프롬프트되는 루프를
    //   유발했다. 모듈은 정적으로 번들되어 즉시 실행 가능.
    //
    //   이전엔 .then/.finally 체인으로 네비게이션했지만, 스트림이 resolve 되기
    //   전에 __permissionStream 이 세팅되지 않은 채 /record 가 마운트될 수 있어
    //   RecordingCamera 의 acquireStream 이 mediaSession 싱글톤을 재확인하면서
    //   드물게 재프롬프트가 발생. await 로 단일 흐름 보장.
    //
    //   ensureMediaSession() 이 살아있는 스트림을 발견하면 팝업 없이 캐시 반환.
    //   최초 1회만 브라우저 권한 다이얼로그 (이 click 핸들러 안에서 동기 호출).
    if (typeof window !== 'undefined') {
      try {
        const stream = await ensureMediaSession();
        (window as any).__permissionGranted = true;
        (window as any).__permissionStream = stream;
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[invite-accept] permission failed:', e);
      }
    }
    startSession(template);
    router.replace('/record' as any);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {showKakaoBanner ? (
          <View style={s.kakaoBanner}>
            <Text style={s.kakaoBannerTitle}>⚠ 카카오톡 인앱 브라우저</Text>
            <Text style={s.kakaoBannerBody}>
              카메라·마이크 권한이 차단돼 챌린지가 진행되지 않을 수 있어요.{'\n'}
              우상단 ⋯ 메뉴 → "다른 브라우저로 열기" 를 선택해주세요.
            </Text>
            <Pressable style={s.kakaoBannerClose} onPress={() => setShowKakaoBanner(false)}>
              <Text style={s.kakaoBannerCloseText}>그래도 진행</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={s.badge}>
          <Text style={s.badgeText}>🥊 도전장 도착</Text>
        </View>

        <Text style={s.headline}>{banner}</Text>

        <View style={s.previewCard}>
          <Image source={{ uri: thumbUri }} style={s.thumb} />
          <View style={s.previewBody}>
            <Text style={s.previewTitle}>{tplName}</Text>
            {(template as any).description ? (
              <Text style={s.previewDesc} numberOfLines={3}>{(template as any).description}</Text>
            ) : null}
          </View>
        </View>

        <Pressable style={[s.primaryBtn, accepting && { opacity: 0.6 }]} onPress={accept} disabled={accepting}>
          <Text style={s.primaryBtnText}>
            {accepting ? '촬영 준비 중…' : '수락하고 촬영 시작'}
          </Text>
        </Pressable>

        <Pressable style={s.ghostBtn} onPress={() => router.replace('/(main)/home' as any)}>
          <Text style={s.ghostBtnText}>나중에 하기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050509',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    gap: 16,
    maxWidth: 520,
    width: '100%',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: '#ec4899',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: { color: '#ec4899', fontWeight: '800', fontSize: 13 },
  headline: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  previewCard: {
    backgroundColor: '#12101A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1B1130' },
  previewBody: { padding: 14, gap: 6 },
  previewTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  previewDesc: { color: '#A0A0B0', fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    // @ts-ignore web
    backgroundImage: 'linear-gradient(135deg,#ec4899 0%,#7c3aed 100%)',
    // @ts-ignore web
    boxShadow: '0 8px 22px rgba(236,72,153,0.4)',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: '#A0A0B0', fontSize: 14 },
  errorBox: { padding: 24, alignItems: 'center', gap: 12 },
  errTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  errBody: { color: '#A0A0B0', fontSize: 14, textAlign: 'center' },
  kakaoBanner: {
    backgroundColor: 'rgba(254,229,0,0.12)',
    borderColor: '#FEE500',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  kakaoBannerTitle: { color: '#FEE500', fontSize: 14, fontWeight: '800' },
  kakaoBannerBody: { color: '#FFF', fontSize: 13, lineHeight: 19 },
  kakaoBannerClose: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  kakaoBannerCloseText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
