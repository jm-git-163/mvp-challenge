/**
 * /debug/highlight — 자동 큐레이션(하이라이트 추출) 시연 페이지
 *
 * 임의 mock score timeline + 임의 5초 mp4 로 알고리즘을 시각화한다.
 *  - 타임라인 + 빨간 highlight bar
 *  - 추출된 하이라이트 재생
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { selectHighlights, totalDurationOf, averageScoreInSegments } from '../../engine/curation/highlightSelector';
import type { ScoreTimelineEntry } from '../../engine/scoring/scoreTimeline';
import { composeHighlight, detectHighlightCapability } from '../../utils/highlightCompositor';

function buildMockTimeline(): ScoreTimelineEntry[] {
  const out: ScoreTimelineEntry[] = [];
  for (let t = 0; t < 90; t++) {
    let score: number;
    let event: ScoreTimelineEntry['event'] = 'idle';
    if (t < 30) score = 0.2 + (t % 3) * 0.03;
    else if (t < 45) { score = 0.3 + (t - 30) * 0.04; if (t % 3 === 0) event = 'count'; }
    else if (t < 60) { score = 0.85; if (t === 50) event = 'count'; }
    else if (t < 75) { score = 0.40; if (t === 70) event = 'fail'; }
    else { score = 0.55 + (t - 75) * 0.02; if (t === 80 || t === 85) event = 'match'; }
    out.push({ tMs: t * 1000, score, missionId: '1:gesture', event });
  }
  return out;
}

/**
 * 5초짜리 컬러바 mp4 를 canvas+MediaRecorder 로 즉석 생성.
 * 의존성·외부 자산 없이 동작 (CLAUDE.md §8.1 플레이스홀더 전략).
 */
async function generateMockVideo(durationSec = 5): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 854;
  const ctx = canvas.getContext('2d')!;
  const stream = (canvas as HTMLCanvasElement).captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { recorder.onstop = () => res(); });
  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const hue = (t * 60) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${t.toFixed(1)}s`, canvas.width / 2, canvas.height / 2);
      if (t >= durationSec) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: 'video/webm' });
}

export default function HighlightDebugScreen() {
  const timeline = useMemo(() => buildMockTimeline(), []);
  const totalMs = 90_000;
  const segments = useMemo(
    () => selectHighlights(timeline, { totalDurationMs: totalMs, targetTotalMs: 30_000, toleranceMs: 5_000 }),
    [timeline],
  );
  const baseline = useMemo(
    () => timeline.reduce((a, b) => a + b.score, 0) / timeline.length,
    [timeline],
  );
  const highlightAvg = useMemo(
    () => averageScoreInSegments(timeline, segments),
    [timeline, segments],
  );

  const cap = useMemo(() => detectHighlightCapability(), []);

  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [hUrl, setHUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBuilding(true); setError(null); setProgress(0); setPhase('mock 영상 생성');
    try {
      // 짧은 mock 5초 영상으로는 90초 timeline 의 구간(60s 등)이 OOR → 데모 목적상 0~5s
      // 안에서 동작하도록 segments 를 5초 영역으로 스케일.
      const scaled = segments.map((s) => ({
        ...s,
        startMs: Math.min(4500, Math.max(0, s.startMs / totalMs * 5000)),
        endMs:   Math.min(5000, Math.max(500, s.endMs   / totalMs * 5000)),
      }));
      const mock = await generateMockVideo(5);
      const result = await composeHighlight(mock, {
        segments: scaled,
        onProgress: (p) => { setProgress(p.percent); setPhase(p.phase); },
      });
      const url = URL.createObjectURL(result.blob);
      setHUrl(url);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBuilding(false);
    }
  };

  useEffect(() => () => { if (hUrl) URL.revokeObjectURL(hUrl); }, [hUrl]);

  return (
    <ScrollView style={st.root} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={st.title}>🎯 자동 큐레이션 데모</Text>
      <Text style={st.sub}>
        90초 mock score timeline → highlightSelector → {segments.length}개 구간 ·
        총 {(totalDurationOf(segments) / 1000).toFixed(1)}초
      </Text>
      <Text style={st.sub}>
        평균 점수: 베이스라인 {baseline.toFixed(2)} → 하이라이트 {highlightAvg.toFixed(2)}
        {'  '}(+{(((highlightAvg / baseline) - 1) * 100).toFixed(1)}%)
      </Text>

      <Text style={st.sub}>
        capability: WebCodecs {String(cap.webcodecs)} · canvas-recorder {String(cap.canvasRecorder)} · mime {cap.preferredMime}
      </Text>

      {/* 타임라인 시각화 */}
      <View style={st.tlWrap}>
        <View style={st.tlBg}>
          {timeline.map((e, i) => (
            <View key={i} style={{
              position: 'absolute',
              left: `${(e.tMs / totalMs) * 100}%`,
              bottom: 0,
              width: `${(1000 / totalMs) * 100}%`,
              height: `${e.score * 100}%`,
              backgroundColor: e.event === 'count' ? '#22c55e'
                : e.event === 'match' ? '#3b82f6'
                : e.event === 'fail' ? '#ef4444'
                : 'rgba(120,120,120,0.5)',
            } as any} />
          ))}
          {/* 빨간 highlight bar */}
          {segments.map((s, i) => (
            <View key={`seg-${i}`} style={{
              position: 'absolute',
              left: `${(s.startMs / totalMs) * 100}%`,
              top: 0,
              width: `${((s.endMs - s.startMs) / totalMs) * 100}%`,
              height: 6,
              backgroundColor: '#ef4444',
            } as any} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={st.tick}>0s</Text>
          <Text style={st.tick}>30s</Text>
          <Text style={st.tick}>60s</Text>
          <Text style={st.tick}>90s</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {segments.map((s, i) => (
          <View key={i} style={st.chip}>
            <Text style={st.chipText}>
              #{i + 1} {(s.startMs / 1000).toFixed(1)}–{(s.endMs / 1000).toFixed(1)}s · {s.reason}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={run} disabled={building} style={[st.btn, building && { opacity: 0.5 }]}>
        {building
          ? <ActivityIndicator color="#fff" />
          : <Text style={st.btnText}>▶ 5초 mock 영상 생성 + 하이라이트 추출</Text>}
      </TouchableOpacity>

      {building && (
        <Text style={st.sub}>
          {phase} — {Math.round(progress * 100)}%
        </Text>
      )}

      {error && <Text style={[st.sub, { color: '#ef4444' }]}>{error}</Text>}

      {hUrl && (
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          {/* @ts-ignore web */}
          <video src={hUrl} controls playsInline style={{ width: 240, aspectRatio: '9/16', background: '#000', borderRadius: 16 }} />
          <Text style={[st.sub, { marginTop: 8 }]}>추출된 하이라이트 재생 가능</Text>
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0d0e12' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tlWrap:{ paddingVertical: 8 },
  tlBg:  { position: 'relative', height: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' } as any,
  tick:  { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  chip:  { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: '#ef4444', borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  chipText: { color: '#fecaca', fontSize: 11, fontWeight: '700' },
  btn:   { backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});
