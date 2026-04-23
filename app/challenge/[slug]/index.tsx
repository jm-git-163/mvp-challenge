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
import { useSessionStore } from '../../../store/sessionStore';
import { useInviteStore } from '../../../store/inviteStore';
import { parseInviteUrl, buildInviteBannerText, type InviteContext } from '../../../utils/inviteLinks';
import { resolveLayeredTemplate } from '../../../services/challengeTemplateMap';
import { SUPABASE_TEMPLATE_THUMBNAILS } from '../../../services/supabaseThumbnails';
import { TEMPLATE_THUMBNAILS } from '../../../services/templateThumbnails';
import { getThumbnailUrl } from '../../../utils/thumbnails';
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
    // 1) layered 템플릿(공식 slug) 우선 — 항상 매칭 보장, resolveLayeredTemplate 가
    //    genre alias 도 포함하므로 'kpop' 같은 축약도 처리된다.
    const layered = resolveLayeredTemplate(ctx.slug);
    if (layered) return (layered as any);
    // 2) DB 템플릿에서 id/slug/theme_id/genre 매칭
    const exact = templates.find(t =>
      t.id === ctx.slug
      || (t as any).slug === ctx.slug
      || (t as any).theme_id === ctx.slug
      || (t as any).genre === ctx.slug
    );
    if (exact) return exact;
    // 3) 마지막 폴백: 첫 번째 DB 템플릿이라도 보여줌 (에러 화면보다 낫다)
    return templates[0] ?? null;
  }, [templates, ctx]);

  const [accepting, setAccepting] = useState(false);

  // 수신 시 스토어 세팅
  useEffect(() => {
    if (ctx) setInviteContext(ctx, fullUrl);
  }, [ctx, fullUrl, setInviteContext]);

  // FIX-INVITE-KAKAO-PNG (2026-04-23): OG/Twitter 메타를 런타임에 초대자 컨텍스트로
  //   덮어씀. 카톡/라인이 URL 만 포워드한 경우, 링크 미리보기 페처가 이 메타를
  //   읽어가 "누가·어느 챌린지" 카드를 렌더. 정적 +html.tsx 의 전역 메타보다 우선.
  //   expo-router SPA 환경이라 SSR 은 없지만, 일부 메신저(카톡 데스크톱·in-app)는
  //   JS 실행 후 메타를 수집한다. 실패해도 전역 OG 가 폴백.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!ctx) return;
    const templateName = template?.name ?? ctx.slug;
    const title = `${ctx.fromName}이(가) ${templateName} 도전장을 보냈어요!`;
    const desc = ctx.message
      ? `"${ctx.message}" — 탭해서 함께 도전하세요`
      : (typeof ctx.score === 'number'
          ? `${ctx.fromName}님의 점수 ${ctx.score}점. 탭해서 함께 도전하세요`
          : '탭해서 함께 도전하세요');
    const img =
      SUPABASE_TEMPLATE_THUMBNAILS[template?.id ?? '']?.largeURL
      || SUPABASE_TEMPLATE_THUMBNAILS[template?.id ?? '']?.url
      || TEMPLATE_THUMBNAILS[template?.id ?? '']?.largeURL
      || TEMPLATE_THUMBNAILS[template?.id ?? '']?.url
      || (template ? getThumbnailUrl((template as any).genre, template.id, 1280) : '');

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

  const banner = buildInviteBannerText(ctx, template.name);
  const thumbUri =
    SUPABASE_TEMPLATE_THUMBNAILS[template.id]?.url
    || TEMPLATE_THUMBNAILS[template.id]?.url
    || (template as any).thumbnail_url
    || getThumbnailUrl(template.genre, template.id, 960);

  const accept = async () => {
    if (accepting) return;
    setAccepting(true);
    // 권한 선행 확보 (홈과 동일 패턴)
    try {
      if (typeof window !== 'undefined' && !(window as any).__permissionGranted) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        (window as any).__permissionGranted = true;
        (window as any).__permissionStream = stream;
      }
    } catch {}
    startSession(template);
    router.replace('/record' as any);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.badge}>
          <Text style={s.badgeText}>🥊 도전장 도착</Text>
        </View>

        <Text style={s.headline}>{banner}</Text>

        <View style={s.previewCard}>
          <Image source={{ uri: thumbUri }} style={s.thumb} />
          <View style={s.previewBody}>
            <Text style={s.previewTitle}>{template.name}</Text>
            {template.description ? (
              <Text style={s.previewDesc} numberOfLines={3}>{template.description}</Text>
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
});
