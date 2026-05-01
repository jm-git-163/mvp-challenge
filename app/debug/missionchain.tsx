/**
 * app/debug/missionchain.tsx
 *
 * Phase 5 wave2 (2026-05-01) — 미션 체이닝 시퀀서 시연 페이지.
 *
 *   - squatMasterChain.missionSequence 로 MissionSequencer 부팅.
 *   - "성공" / "실패" 버튼으로 현재 미션 결과 강제 입력 → 1초 트랜지션 → 다음 미션.
 *   - 누적 점수, 별점, 콤보 보너스 실시간 표시.
 *   - 카메라/녹화 없는 순수 점수 검증용 (실 녹화 통합은 별도).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { squatMasterChain } from '../../data/templates/squat-master-chain';
import { MissionSequencer, type MissionSequence, type SequencerState } from '../../engine/missions/missionSequencer';

function buildSequence(): MissionSequence {
  const cfg = squatMasterChain.missionSequence!;
  return {
    missions: cfg.steps.map((s) => ({ id: s.id, label: s.label, ...(s.spec as any) })),
    transitions: cfg.transitions ?? [{ durationMs: 1000, kind: 'glow_fade' }],
    comboBonusPct: cfg.comboBonusPct,
    comboBonusMaxPct: cfg.comboBonusMaxPct,
    passingScore: cfg.passingScore,
  };
}

export default function MissionChainDebug() {
  const seqRef = useRef<MissionSequencer | null>(null);
  const [state, setState] = useState<SequencerState | null>(null);
  const [tick, setTick] = useState(0);

  const seqDef = useMemo(buildSequence, []);

  useEffect(() => {
    const s = new MissionSequencer(seqDef);
    seqRef.current = s;
    const unsub = s.subscribe((st) => setState({ ...st, results: [...st.results] }));
    s.start(performance.now());

    let raf = 0;
    const loop = () => {
      s.tick(performance.now());
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      s.dispose();
    };
  }, [seqDef]);

  const onComplete = (success: boolean) => {
    const s = seqRef.current;
    if (!s) return;
    const score = success ? 80 : 40;
    s.completeCurrent(performance.now(), { score, success });
  };

  const onRestart = () => {
    const s = seqRef.current;
    if (!s) return;
    s.dispose();
    const next = new MissionSequencer(seqDef);
    seqRef.current = next;
    next.subscribe((st) => setState({ ...st, results: [...st.results] }));
    next.start(performance.now());
  };

  const agg = seqRef.current?.aggregate();
  const transProg = seqRef.current?.transitionProgress(performance.now()) ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>미션 체인 시연 · squat-master-chain</Text>
      <Text style={styles.sub}>스쿼트 5회 → 응원 자막 → 양손 V (연속 성공 +10%, 최대 +50%)</Text>

      <View style={styles.card}>
        <Text style={styles.label}>현재 단계</Text>
        <Text style={styles.value}>
          {state?.phase === 'transitioning'
            ? `트랜지션 ${(transProg * 100).toFixed(0)}%`
            : state?.currentMission?.id ?? state?.phase ?? '-'}
        </Text>
        <Text style={styles.sub}>인덱스: {state?.index ?? -1} / {seqDef.missions.length} · 콤보 {state?.comboCount ?? 0}</Text>
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnOk]}
          disabled={state?.phase !== 'running'}
          onPress={() => onComplete(true)}
        >
          <Text style={styles.btnText}>성공 (80)</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnNo]}
          disabled={state?.phase !== 'running'}
          onPress={() => onComplete(false)}
        >
          <Text style={styles.btnText}>실패 (40)</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>누적 결과</Text>
        {(state?.results ?? []).map((r) => (
          <Text key={r.id} style={styles.value}>
            {r.id}: {r.score}점 (base {(r.detail as any)?.baseScore} +{(r.detail as any)?.bonusPct ?? 0}%)
          </Text>
        ))}
        {(!state?.results || state.results.length === 0) && <Text style={styles.sub}>아직 없음</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>총점</Text>
        <Text style={styles.total}>{agg?.total ?? 0}점 · {'★'.repeat(agg?.stars ?? 1)}{'☆'.repeat(5 - (agg?.stars ?? 1))}</Text>
        <Text style={styles.sub}>{agg?.passed ? '통과' : '미통과'}</Text>
      </View>

      <Pressable style={styles.restart} onPress={onRestart}>
        <Text style={styles.btnText}>처음부터</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F', padding: 16 },
  title: { color: '#FFD23F', fontSize: 18, fontWeight: '700' },
  sub: { color: '#c7d2fe', fontSize: 12, marginTop: 4 },
  card: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#1B2A4E' },
  label: { color: '#FFD23F', fontSize: 12, fontWeight: '600' },
  value: { color: '#fff', fontSize: 16, marginTop: 4 },
  total: { color: '#FFD23F', fontSize: 28, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnOk: { backgroundColor: '#10B981' },
  btnNo: { backgroundColor: '#FF3B3B' },
  btnText: { color: '#fff', fontWeight: '700' },
  restart: { marginTop: 20, padding: 12, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
});
