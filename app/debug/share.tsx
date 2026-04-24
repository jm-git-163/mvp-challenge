/**
 * app/debug/share.tsx
 *
 * **User-visible share diagnostic page.** Open /debug/share on your phone,
 * screenshot or tap "에러 복사" to paste the JSON back. 100% client-side.
 *
 * Why this exists: the share pipeline has been "fixed" in commits fb5372d,
 * 6ac3a42, 9cf1aad and the user still reports "전송이 안 된다". Without a
 * stack trace from their device we cannot progress. This page reports:
 *   - navigator.share / canShare support
 *   - canShare({ files: [testFile] }) for mp4 and webm
 *   - In-app browser detection (Kakao / IG / FB / Line / Naver)
 *   - UA + secure context + clipboard capability
 *
 * Everything is derived via utils/share.debug.ts — keep display logic dumb.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diagnoseShare, summarizeDiagnostic, type ShareDiagnostic } from '../../utils/share.debug';

function makeTestFile(mime: string, name: string): File | null {
  try {
    // 64KB dummy — big enough to pass the 10KB "too small" guard.
    const buf = new Uint8Array(64 * 1024);
    return new File([buf], name, { type: mime });
  } catch {
    return null;
  }
}

function copy(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
    return (navigator as any).clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export default function DebugSharePage() {
  const [copied, setCopied] = useState<'mp4' | 'webm' | 'none' | null>(null);

  const mp4Diag = useMemo<ShareDiagnostic | null>(() => {
    if (Platform.OS !== 'web') return null;
    return diagnoseShare(makeTestFile('video/mp4', 'test.mp4'));
  }, []);
  const webmDiag = useMemo<ShareDiagnostic | null>(() => {
    if (Platform.OS !== 'web') return null;
    return diagnoseShare(makeTestFile('video/webm', 'test.webm'));
  }, []);
  const noFileDiag = useMemo<ShareDiagnostic | null>(() => {
    if (Platform.OS !== 'web') return null;
    return diagnoseShare(null);
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={st.center}>
        <Text style={st.body}>이 페이지는 웹 전용이에요. 기기의 브라우저로 /debug/share 를 열어주세요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={st.root} contentContainerStyle={st.content}>
      <Text style={st.h1}>공유 진단 (Share Diagnostic)</Text>
      <Text style={st.helpText}>
        버튼을 눌러 JSON 을 복사한 뒤 채팅창에 붙여넣어 주세요. 문제의 원인을 정확히 찾는 데 쓰입니다.
      </Text>

      <Section title="1. MP4 64KB 테스트 파일" diag={mp4Diag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'mp4' : 'none');
      }} copied={copied === 'mp4'} />

      <Section title="2. WebM 64KB 테스트 파일" diag={webmDiag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'webm' : 'none');
      }} copied={copied === 'webm'} />

      <Section title="3. 파일 없음 (순수 환경)" diag={noFileDiag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'none' : null);
      }} copied={copied === 'none'} />

      <Text style={st.footer}>
        해석: 'canShareFiles' 가 false 이면 해당 MIME 을 이 기기 브라우저가 막는 것. inApp.detected 가 true
        이면 카카오/인스타 등 인앱 브라우저 — 외부 브라우저(크롬/사파리)로 열어야 해요.
      </Text>
    </ScrollView>
  );
}

function Section(props: {
  title: string;
  diag: ShareDiagnostic | null;
  onCopy: (json: string) => void;
  copied: boolean;
}) {
  if (!props.diag) return null;
  const json = JSON.stringify(props.diag, null, 2);
  const summary = summarizeDiagnostic(props.diag);
  return (
    <View style={st.section}>
      <Text style={st.h2}>{props.title}</Text>
      <Text style={st.summary}>{summary}</Text>
      <View style={st.row}>
        <Pressable style={st.copyBtn} onPress={() => props.onCopy(json)}>
          <Text style={st.copyBtnText}>{props.copied ? '✓ 복사됨' : 'JSON 복사'}</Text>
        </Pressable>
      </View>
      <Text style={st.code} selectable>{json}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  h2: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  body: { color: '#fafafa', fontSize: 14 },
  helpText: { color: '#a1a1aa', fontSize: 12, lineHeight: 17 },
  section: {
    backgroundColor: '#18181B',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  summary: { color: '#fbbf24', fontSize: 12, fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Courier' }) as string },
  row: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    backgroundColor: '#fafafa', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  copyBtnText: { color: '#0A0A0A', fontSize: 13, fontWeight: '700' },
  code: {
    color: '#e4e4e7', fontSize: 11,
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Courier' }) as string,
    lineHeight: 15,
    backgroundColor: '#09090B',
    padding: 8, borderRadius: 6,
  },
  footer: { color: '#71717A', fontSize: 11, lineHeight: 16, marginTop: 4 },
});
