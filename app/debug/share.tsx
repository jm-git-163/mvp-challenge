/**
 * app/debug/share.tsx
 *
 * **User-visible share diagnostic page.** Open /debug/share on your phone,
 * screenshot or tap "에러 복사" to paste the JSON back. 100% client-side.
 *
 * FIX-KAKAO-HANG (2026-04-24): adds a "실제 합성된 영상" section that picks
 *   up the last blob produced by utils/videoCompositor (stashed on
 *   window.__lastComposedVideo) and runs:
 *     - diagnoseShare(realFile)        — canShare matrix with real MIME
 *     - probeBlobMetadata(realBlob)    — duration / dimensions / broken?
 *     - kakaoSizeWarning(size)         — 50MB / 300MB thresholds
 *     - "실제 영상 카톡 공유 시도" button → sharePlatform('kakao', realFile)
 *       so user can capture the exact failure point.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  diagnoseShare, summarizeDiagnostic, probeBlobMetadata, kakaoSizeWarning,
  type ShareDiagnostic, type BlobMetadata,
} from '../../utils/share.debug';
import { sharePlatform, type ShareResult } from '../../utils/share';
import { blobToShareFile } from '../../utils/shareVideo';

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

function pickLastComposed(): { blob: Blob; mime: string; at: number } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const blob = w.__lastComposedVideo as Blob | undefined;
  if (!blob || typeof (blob as any).size !== 'number') return null;
  return { blob, mime: (w.__lastComposedMime as string) || blob.type || 'unknown', at: (w.__lastComposedAt as number) || 0 };
}

export default function DebugSharePage() {
  const [copied, setCopied] = useState<string | null>(null);

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

  // ─── Real composed-video section ────────────────────────────────────────
  const [realDiag, setRealDiag] = useState<ShareDiagnostic | null>(null);
  const [realMeta, setRealMeta] = useState<BlobMetadata | null>(null);
  const [realFile, setRealFile] = useState<File | null>(null);
  const [realWarning, setRealWarning] = useState<string | null>(null);
  const [realShareResult, setRealShareResult] = useState<ShareResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [realAt, setRealAt] = useState<number>(0);

  const loadReal = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    const src = pickLastComposed();
    if (!src) {
      setRealDiag(null); setRealMeta(null); setRealFile(null); setRealWarning('합성된 영상이 없어요. 먼저 /record 에서 챌린지를 완료해 /result 화면까지 가야 해요.');
      return;
    }
    const file = blobToShareFile(src.blob, 'motiq-real-test');
    setRealFile(file);
    setRealDiag(diagnoseShare(file));
    setRealAt(src.at);
    setRealWarning(kakaoSizeWarning(file.size));
    setProbing(true);
    try {
      const meta = await probeBlobMetadata(src.blob);
      setRealMeta(meta);
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => { loadReal(); }, [loadReal]);

  const attemptKakao = useCallback(async () => {
    if (!realFile) return;
    setRealShareResult(null);
    try {
      const res = await sharePlatform({
        file: realFile,
        caption: 'MotiQ /debug/share 실제 파일 테스트',
        platform: 'kakao',
      });
      setRealShareResult(res);
    } catch (e: any) {
      setRealShareResult({ kind: 'error', message: `throw: ${e?.message || e}` } as ShareResult);
    }
  }, [realFile]);

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

      {/* ─── Real composed video section ─────────────────────────────── */}
      <View style={[st.section, st.realSection]}>
        <Text style={st.h2}>0. 실제 합성된 영상 (가장 중요)</Text>
        <Text style={st.helpText}>
          /record → /result 완료 직후 여기 오면 실제로 방금 만든 mp4 파일로 진단합니다.
          "실제 영상 카톡 공유 시도" 버튼은 현실 파일로 sharePlatform('kakao') 을 실행해요.
        </Text>
        <Pressable style={st.refreshBtn} onPress={loadReal}>
          <Text style={st.refreshBtnText}>다시 읽어오기</Text>
        </Pressable>

        {realFile ? (
          <>
            <Text style={st.summary}>
              MIME: {realFile.type || '(empty)'} · {(realFile.size / (1024 * 1024)).toFixed(2)} MB
              · 생성: {realAt ? new Date(realAt).toLocaleTimeString() : '-'}
            </Text>
            {realWarning ? <Text style={st.warning}>⚠ {realWarning}</Text> : null}

            {realDiag ? <Text style={st.summary}>{summarizeDiagnostic(realDiag)}</Text> : null}

            <Text style={st.subhead}>비디오 메타데이터 (재생 가능성)</Text>
            {probing ? <Text style={st.body}>probing…</Text> : null}
            {realMeta ? (
              <Text style={st.code} selectable>
                {JSON.stringify(realMeta, null, 2)}
              </Text>
            ) : null}
            {realMeta?.durationBroken ? (
              <Text style={st.warning}>
                ⚠ duration={realMeta.durationRaw} — Kakao 같은 앱이 업로드 중 "멈춤" 으로 보일 수 있어요.
                (MediaRecorder 컨테이너에 moov/duration 박스가 꼬였을 때 발생)
              </Text>
            ) : null}

            <Pressable style={st.dangerBtn} onPress={attemptKakao}>
              <Text style={st.dangerBtnText}>실제 영상 카톡 공유 시도</Text>
            </Pressable>

            {realShareResult ? (
              <Text style={st.code} selectable>
                {JSON.stringify(realShareResult, null, 2)}
              </Text>
            ) : null}

            <Pressable
              style={st.copyBtn}
              onPress={async () => {
                const json = JSON.stringify({
                  file: { name: realFile.name, size: realFile.size, type: realFile.type, createdAt: realAt },
                  diagnostic: realDiag,
                  metadata: realMeta,
                  warning: realWarning,
                  shareResult: realShareResult,
                }, null, 2);
                const ok = await copy(json);
                setCopied(ok ? 'real' : null);
              }}
            >
              <Text style={st.copyBtnText}>{copied === 'real' ? '✓ 복사됨' : '모든 정보 JSON 복사'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={st.body}>{realWarning ?? '합성된 영상을 아직 찾지 못했어요.'}</Text>
        )}
      </View>

      <Section title="1. MP4 64KB 테스트 파일" diag={mp4Diag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'mp4' : null);
      }} copied={copied === 'mp4'} />

      <Section title="2. WebM 64KB 테스트 파일" diag={webmDiag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'webm' : null);
      }} copied={copied === 'webm'} />

      <Section title="3. 파일 없음 (순수 환경)" diag={noFileDiag} onCopy={async (json) => {
        const ok = await copy(json); setCopied(ok ? 'none' : null);
      }} copied={copied === 'none'} />

      <Text style={st.footer}>
        해석: 'canShareFiles' 가 false 이면 해당 MIME 을 이 기기 브라우저가 막는 것. inApp.detected 가 true
        이면 카카오/인스타 등 인앱 브라우저 — 외부 브라우저(크롬/사파리)로 열어야 해요.
        durationBroken=true 이면 카카오가 업로드 중 멈출 가능성이 큼 (moov 박스 꼬임).
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
  subhead: { color: '#fbbf24', fontSize: 12, fontWeight: '700', marginTop: 6 },
  body: { color: '#fafafa', fontSize: 14 },
  warning: { color: '#fca5a5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  helpText: { color: '#a1a1aa', fontSize: 12, lineHeight: 17 },
  section: {
    backgroundColor: '#18181B',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  realSection: {
    borderColor: '#FBBF24',
    backgroundColor: '#1C1917',
  },
  summary: { color: '#fbbf24', fontSize: 12, fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Courier' }) as string },
  row: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    backgroundColor: '#fafafa', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  copyBtnText: { color: '#0A0A0A', fontSize: 13, fontWeight: '700' },
  refreshBtn: {
    backgroundColor: '#3F3F46', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  refreshBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dangerBtn: {
    backgroundColor: '#FEE500', borderRadius: 8,
    paddingVertical: 11, paddingHorizontal: 14, alignSelf: 'stretch', alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnText: { color: '#191919', fontSize: 14, fontWeight: '800' },
  code: {
    color: '#e4e4e7', fontSize: 11,
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Courier' }) as string,
    lineHeight: 15,
    backgroundColor: '#09090B',
    padding: 8, borderRadius: 6,
  },
  footer: { color: '#71717A', fontSize: 11, lineHeight: 16, marginTop: 4 },
});
