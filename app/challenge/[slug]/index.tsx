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
    const slug = (params.slug ?? '').toString();
    if (typeof window !== 'undefined' && window.location && window.location.pathname.includes(`/challenge/${slug}`)) {
      const live = window.location.href;
      const parsed = parseInviteUrl(live);
      if (parsed) return { ctx: parsed, fullUrl: live };
    }
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
