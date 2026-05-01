/**
 * app/debug/invite.tsx
 *
 * **User-visible invite-link diagnostic page.** Open /debug/invite to:
 *   1) Build a sample invite URL with current `mySenderName` / a sample slug
 *   2) Inspect that URL via parseInviteUrl (round-trip check)
 *   3) Detect Kakao in-app webview (UA-based)
 *   4) "Open in new tab" button to simulate the recipient flow without copy/paste
 *   5) Copy URL / copy diagnostic JSON for the user to paste back to support
 *
 * 100% client-side. No upload (CLAUDE.md §12).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import {
  buildInviteUrl,
  parseInviteUrl,
  buildInviteShareCaption,
} from '../../utils/inviteLinks';
import { isKakaoInAppBrowser, isInAppBrowserWithBrokenShare } from '../../utils/inviteShareCard';
import { useInviteStore } from '../../store/inviteStore';

const DEFAULT_SLUG = 'squat-master';
const SAMPLE_SLUGS = [
  'squat-master', 'news-anchor', 'kpop-dance', 'english-speaking',
  'food-review', 'travel-checkin', 'storybook-reading', 'unboxing-promo',
  'motivation-speech', 'social-viral', 'daily-vlog',
];

function copy(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
    return (navigator as any).clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export default function DebugInvitePage() {
  const mySenderName = useInviteStore(s => s.mySenderName);
  const [slug, setSlug] = useState(DEFAULT_SLUG);
  const [fromName, setFromName] = useState(mySenderName || '테스트유저');
  const [score, setScore] = useState<string>('87');
  const [copied, setCopied] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const url = useMemo(() => {
    try {
      const n = score.trim() ? Number(score) : undefined;
      return buildInviteUrl(slug, fromName, {
        score: typeof n === 'number' && isFinite(n) ? n : undefined,
      });
    } catch (e: any) {
      return `[ERROR] ${e?.message || e}`;
    }
  }, [slug, fromName, score]);

  const parsed = useMemo(() => {
    if (url.startsWith('[ERROR]')) return null;
    try { return parseInviteUrl(url); } catch { return null; }
  }, [url]);

  const caption = useMemo(() => {
    if (url.startsWith('[ERROR]')) return '';
    return buildInviteShareCaption({
      templateName: slug,
      fromName,
      score: score ? Number(score) : undefined,
      inviteUrl: url,
    });
  }, [url, slug, fromName, score]);

  const env = useMemo(() => {
    if (typeof navigator === 'undefined') return null;
    return {
      ua: navigator.userAgent || '',
      isKakaoInApp: isKakaoInAppBrowser(),
      isBrokenShareInApp: isInAppBrowserWithBrokenShare(),
      hasShare: typeof (navigator as any).share === 'function',
      hasCanShare: typeof (navigator as any).canShare === 'function',
      hasClipboard: !!(navigator as any).clipboard?.writeText,
    };
  }, []);

  const openInNewTab = useCallback(() => {
    if (typeof window === 'undefined' || url.startsWith('[ERROR]')) return;
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      setOpened(w ? 'opened' : 'blocked');
    } catch {
      setOpened('threw');
    }
  }, [url]);

  if (Platform.OS !== 'web') {
    return (
      <View style={st.center}>
        <Text style={st.body}>이 페이지는 웹 전용이에요. /debug/invite 를 브라우저에서 열어주세요.</Text>
      </View>
    );
  }

  const fullJson = JSON.stringify({
    inputs: { slug, fromName, score },
    url,
    parsed,
    caption,
    env,
  }, null, 2);

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <Text style={st.h1}>도전장(invite) 진단</Text>
      <Text style={st.helpText}>
        invite URL 을 만들어 라운드트립(생성→파싱) 검증, 카카오톡 webview 감지, 새 탭 열기까지 시뮬레이션합니다.
        문제 발생 시 "전체 JSON 복사" 로 채팅창에 붙여넣어 주세요.
      </Text>

      {/* ─── Inputs ─────────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.h2}>입력</Text>
        <Text style={st.label}>slug</Text>
        <View style={st.chipRow}>
          {SAMPLE_SLUGS.map(s => (
            <Pressable key={s} onPress={() => setSlug(s)} style={[st.chip, slug === s && st.chipOn]}>
              <Text style={[st.chipText, slug === s && st.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={st.input}
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
          placeholder="slug (e.g. squat-master)"
          placeholderTextColor="#52525b"
        />
        <Text style={st.label}>fromName</Text>
        <TextInput
          style={st.input}
          value={fromName}
          onChangeText={setFromName}
          placeholder="보낸 사람"
          placeholderTextColor="#52525b"
        />
        <Text style={st.label}>score (선택)</Text>
        <TextInput
          style={st.input}
          value={score}
          onChangeText={setScore}
          placeholder="0–100"
          placeholderTextColor="#52525b"
          keyboardType="numeric"
        />
      </View>

      {/* ─── URL + Round-trip ───────────────────────────── */}
      <View style={st.section}>
        <Text style={st.h2}>생성된 URL</Text>
        <Text style={st.code} selectable>{url}</Text>
        <View style={st.row}>
          <Pressable
            style={st.copyBtn}
            onPress={async () => { const ok = await copy(url); setCopied(ok ? 'url' : null); }}
          >
            <Text style={st.copyBtnText}>{copied === 'url' ? '✓ 복사됨' : 'URL 복사'}</Text>
          </Pressable>
          <Pressable style={st.openBtn} onPress={openInNewTab}>
            <Text style={st.openBtnText}>새 탭에서 열기 (수신자 시뮬레이션)</Text>
          </Pressable>
        </View>
        {opened ? (
          <Text style={st.summary}>
            결과: {opened === 'opened' ? '✓ 새 탭 열림' : opened === 'blocked' ? '✗ 팝업 차단됨 — 사용자 제스처 잃음' : '✗ throw'}
          </Text>
        ) : null}

        <Text style={st.subhead}>parseInviteUrl 라운드트립</Text>
        {parsed ? (
          <Text style={st.code} selectable>{JSON.stringify(parsed, null, 2)}</Text>
        ) : (
          <Text style={st.warning}>⚠ 파싱 실패 — slug 가 잘못됐거나 URL 인코딩이 깨졌어요.</Text>
        )}
      </View>

      {/* ─── Caption ─────────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.h2}>공유 캡션</Text>
        <Text style={st.code} selectable>{caption}</Text>
      </View>

      {/* ─── Environment ─────────────────────────────────── */}
      <View style={st.section}>
        <Text style={st.h2}>현재 브라우저 환경</Text>
        {env ? (
          <>
            {env.isKakaoInApp ? (
              <Text style={st.warning}>⚠ 카카오톡 인앱 브라우저로 보여요. 챌린지에서 카메라 권한이 막힐 수 있어요.</Text>
            ) : null}
            <Text style={st.code} selectable>{JSON.stringify(env, null, 2)}</Text>
          </>
        ) : (
          <Text style={st.body}>SSR 환경 — navigator 없음</Text>
        )}
      </View>

      {/* ─── Copy-all ────────────────────────────────────── */}
      <Pressable
        style={[st.copyBtn, { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12 }]}
        onPress={async () => { const ok = await copy(fullJson); setCopied(ok ? 'all' : null); }}
      >
        <Text style={st.copyBtnText}>{copied === 'all' ? '✓ 전체 진단 복사됨' : '전체 진단 JSON 복사'}</Text>
      </Pressable>

      <Text style={st.footer}>
        해석: parsed.slug 가 입력 slug 와 다르면 인코딩/디코딩 비대칭 — 카카오톡이 base64 c 파라미터를 잘랐을 가능성. opened="blocked" 이면 사용자 제스처 누수 — 코드 내 await 가 share 직전에 끼어든 것.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  h2: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  subhead: { color: '#fbbf24', fontSize: 12, fontWeight: '700', marginTop: 6 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: '700', marginTop: 4 },
  body: { color: '#fafafa', fontSize: 14 },
  warning: { color: '#fca5a5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  helpText: { color: '#a1a1aa', fontSize: 12, lineHeight: 17 },
  summary: { color: '#fbbf24', fontSize: 12 },
  section: {
    backgroundColor: '#18181B',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  input: {
    backgroundColor: '#09090B',
    borderColor: '#3F3F46',
    borderWidth: 1,
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#27272A',
  },
  chipOn: { backgroundColor: '#ec4899' },
  chipText: { color: '#a1a1aa', fontSize: 11, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  copyBtn: { backgroundColor: '#fafafa', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  copyBtnText: { color: '#0A0A0A', fontSize: 13, fontWeight: '700' },
  openBtn: { backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  openBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  code: {
    color: '#e4e4e7', fontSize: 11,
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Courier' }) as string,
    lineHeight: 15,
    backgroundColor: '#09090B',
    padding: 8, borderRadius: 6,
  },
  footer: { color: '#71717A', fontSize: 11, lineHeight: 16, marginTop: 4 },
});
