/**
 * components/record/PoseCalibration.tsx
 *
 * 스쿼트 챌린지 시작 전 "이상적 촬영 자세" 맞추기 단계.
 *
 * 목적:
 *  - 사용자가 스마트폰을 책상/바닥 1.5m 전방에 두고 전신이 프레임에 들어오도록
 *    서는 위치를 실시간으로 유도한다.
 *  - 타깃 스틱맨(머리·어깨·골반·무릎·발) 실루엣을 오버레이하고,
 *    현재 pose landmarks 와의 유클리드 거리로 매칭률 0~100% 산출.
 *  - 매칭률 ≥ 80% 상태가 1.5초 연속 유지되면 onCalibrated() 호출.
 *  - 3초 후엔 "건너뛰기" 버튼 노출 (실패해도 진행 가능, onSkip()).
 *
 * 설계:
 *  - DOM 오버레이 (녹화 전 단계이므로 캔버스 합성 불필요).
 *  - SVG 기반 스틱맨 — 매칭 중 녹색 글로우, 아니면 빨간 외곽선.
 *  - 100% 클라이언트. 네트워크 요청 없음.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NormalizedLandmark } from '../../utils/poseUtils';
import { JOINT_INDEX } from '../../utils/poseUtils';

interface Props {
  /** MediaPipe PoseLandmarker 출력 (정규화 좌표 0~1) */
  landmarks: NormalizedLandmark[];
  /** 매칭률 ≥ 80% 가 1.5 s 유지되면 호출 */
  onCalibrated: () => void;
  /** "건너뛰기" 버튼으로 사용자가 수동 진행 */
  onSkip: () => void;
}

// 정면 전신 타깃 자세 — 머리 0.15, 어깨 0.28, 힙 0.55, 무릎 0.75, 발 0.90
const TARGET: Record<string, { x: number; y: number }> = {
  nose:           { x: 0.50, y: 0.15 },
  left_shoulder:  { x: 0.40, y: 0.28 },
  right_shoulder: { x: 0.60, y: 0.28 },
  left_hip:       { x: 0.43, y: 0.55 },
  right_hip:      { x: 0.57, y: 0.55 },
  left_knee:      { x: 0.43, y: 0.75 },
  right_knee:     { x: 0.57, y: 0.75 },
  left_ankle:     { x: 0.43, y: 0.90 },
  right_ankle:    { x: 0.57, y: 0.90 },
};

const TARGET_KEYS = Object.keys(TARGET);
const MATCH_THRESHOLD = 80;   // %
const HOLD_MS = 1500;
const SKIP_VISIBLE_AFTER_MS = 3000;
// 한 관절의 편차 거리(정규화 단위) → 해당 관절 점수 0 이 되는 최대 거리.
//   0.20 = 프레임 대각선의 20% — 관대한 매칭 (모바일 작은 화면 대응).
const MAX_JOINT_DIST = 0.20;

/** 타깃과 현재 landmark 사이 매칭률을 0~100% 로 환산 */
function computeMatch(lms: NormalizedLandmark[]): { pct: number; visible: number } {
  if (!lms || lms.length === 0) return { pct: 0, visible: 0 };
  let sum = 0;
  let counted = 0;
  for (const name of TARGET_KEYS) {
    const idx = JOINT_INDEX[name];
    const lm = lms[idx];
    if (!lm) continue;
    const conf = lm.visibility ?? lm.score ?? 1;
    if (conf < 0.3) continue;
    const tx = TARGET[name].x;
    const ty = TARGET[name].y;
    const dx = lm.x - tx;
    const dy = lm.y - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const jointPct = Math.max(0, 1 - dist / MAX_JOINT_DIST); // 0~1
    sum += jointPct;
    counted += 1;
  }
  if (counted === 0) return { pct: 0, visible: 0 };
  // 가시 관절 수에도 가중치 — 전신(9개)의 최소 6개는 보여야 제값 매칭.
  const visibleRatio = Math.min(1, counted / 6);
  const pct = Math.round((sum / counted) * 100 * visibleRatio);
  return { pct, visible: counted };
}

export function PoseCalibration({ landmarks, onCalibrated, onSkip }: Props) {
  const [matchPct, setMatchPct] = useState(0);
  const [visible, setVisible] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const holdStartRef = useRef<number | null>(null);
  const calibratedRef = useRef(false);
  const mountedAtRef = useRef(performance.now());

  // 3초 후 건너뛰기 버튼 노출
  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), SKIP_VISIBLE_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // 매 landmarks 업데이트마다 매칭률 재계산 + hold 추적
  useEffect(() => {
    if (calibratedRef.current) return;
    const { pct, visible: v } = computeMatch(landmarks);
    setMatchPct(pct);
    setVisible(v);

    const now = performance.now();
    if (pct >= MATCH_THRESHOLD) {
      if (holdStartRef.current === null) {
        holdStartRef.current = now;
      } else if (now - holdStartRef.current >= HOLD_MS) {
        calibratedRef.current = true;
        onCalibrated();
      }
    } else {
      holdStartRef.current = null;
    }
  }, [landmarks, onCalibrated]);

  const matched = matchPct >= MATCH_THRESHOLD;
  const holdProgress = useMemo(() => {
    if (!matched || holdStartRef.current === null) return 0;
    return Math.min(1, (performance.now() - holdStartRef.current) / HOLD_MS);
  }, [matchPct, matched]);

  // SVG 타깃 스틱맨 — viewBox 100x100 정규화
  //   연결: 코→어깨중간, 어깨, 어깨→힙, 힙, 힙→무릎, 무릎→발
  const tintStroke = matched ? '#10b981' : '#ef4444';
  const glowOpacity = matched ? 0.55 : 0.18;

  const toVb = (p: { x: number; y: number }) => ({ x: p.x * 100, y: p.y * 100 });
  const nose = toVb(TARGET.nose);
  const lSh = toVb(TARGET.left_shoulder);
  const rSh = toVb(TARGET.right_shoulder);
  const shMid = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
  const lHip = toVb(TARGET.left_hip);
  const rHip = toVb(TARGET.right_hip);
  const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  const lKn = toVb(TARGET.left_knee);
  const rKn = toVb(TARGET.right_knee);
  const lAn = toVb(TARGET.left_ankle);
  const rAn = toVb(TARGET.right_ankle);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* 상단 안내 텍스트 */}
      <View style={styles.topBanner} pointerEvents="none">
        <Text style={styles.bannerTitle}>
          📱 폰을 책상에 놓고 뒤로 물러나 전신이 보이게 서주세요
        </Text>
        <Text style={styles.bannerSub}>
          실루엣에 몸을 맞추면 자동으로 카운트다운이 시작됩니다
        </Text>
      </View>

      {/* 타깃 스틱맨 SVG */}
      <View style={styles.svgWrap} pointerEvents="none">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Glow 배경 */}
          <defs>
            <filter id="pc-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#pc-glow)" opacity={glowOpacity}>
            <circle cx={nose.x} cy={nose.y} r={3.2} fill={tintStroke} />
            <line x1={nose.x} y1={nose.y} x2={shMid.x} y2={shMid.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={lSh.x} y1={lSh.y} x2={rSh.x} y2={rSh.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={shMid.x} y1={shMid.y} x2={hipMid.x} y2={hipMid.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={lHip.x} y1={lHip.y} x2={rHip.x} y2={rHip.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={lHip.x} y1={lHip.y} x2={lKn.x} y2={lKn.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={rHip.x} y1={rHip.y} x2={rKn.x} y2={rKn.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={lKn.x} y1={lKn.y} x2={lAn.x} y2={lAn.y} stroke={tintStroke} strokeWidth={1.8} />
            <line x1={rKn.x} y1={rKn.y} x2={rAn.x} y2={rAn.y} stroke={tintStroke} strokeWidth={1.8} />
          </g>
          {/* 메인 스틱맨 */}
          <g stroke={tintStroke} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.85}>
            <circle cx={nose.x} cy={nose.y} r={3.0} fill="none" />
            <line x1={nose.x} y1={nose.y + 3} x2={shMid.x} y2={shMid.y} />
            <line x1={lSh.x} y1={lSh.y} x2={rSh.x} y2={rSh.y} />
            <line x1={shMid.x} y1={shMid.y} x2={hipMid.x} y2={hipMid.y} />
            <line x1={lHip.x} y1={lHip.y} x2={rHip.x} y2={rHip.y} />
            <line x1={lHip.x} y1={lHip.y} x2={lKn.x} y2={lKn.y} />
            <line x1={rHip.x} y1={rHip.y} x2={rKn.x} y2={rKn.y} />
            <line x1={lKn.x} y1={lKn.y} x2={lAn.x} y2={lAn.y} />
            <line x1={rKn.x} y1={rKn.y} x2={rAn.x} y2={rAn.y} />
            {/* 포인트 점 */}
            {[shMid, lSh, rSh, lHip, rHip, lKn, rKn, lAn, rAn].map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={tintStroke} />
            ))}
          </g>
        </svg>
      </View>

      {/* 매칭률 바 */}
      <View style={styles.meterWrap} pointerEvents="none">
        <View style={styles.meterLabelRow}>
          <Text style={[styles.meterLabel, { color: matched ? '#10b981' : '#f1f5f9' }]}>
            {matched ? '✅ 자세 매칭 중' : '🎯 실루엣에 맞춰주세요'}
          </Text>
          <Text style={[styles.meterPct, { color: matched ? '#10b981' : '#f1f5f9' }]}>
            {matchPct}%
          </Text>
        </View>
        <View style={styles.meterBar}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.min(100, matchPct)}%`,
                backgroundColor: matched ? '#10b981' : '#f59e0b',
              },
            ]}
          />
        </View>
        {matched && (
          <View style={styles.holdBar}>
            <View style={[styles.holdFill, { width: `${holdProgress * 100}%` }]} />
            <Text style={styles.holdText}>
              {holdProgress >= 1 ? '완료!' : '자세 유지 중…'}
            </Text>
          </View>
        )}
        <Text style={styles.hint}>
          {visible < 5
            ? '💡 전신이 프레임에 들어오지 않았어요 — 폰을 멀리 두세요'
            : matched
            ? '그대로 1.5초만 유지해주세요'
            : '머리·어깨·골반·무릎·발을 실루엣에 겹치세요'}
        </Text>
      </View>

      {/* 건너뛰기 버튼 (3초 후 노출) */}
      {showSkip && (
        <Pressable style={styles.skipBtn} onPress={onSkip} hitSlop={12}>
          <Text style={styles.skipText}>건너뛰기 →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  topBanner: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,18,30,0.88)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  bannerTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  bannerSub:   { color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'center' },
  svgWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  meterWrap: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15,18,30,0.92)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  meterLabel:    { fontSize: 13, fontWeight: '700' },
  meterPct:      { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meterBar:      { height: 8, borderRadius: 4, backgroundColor: 'rgba(71,85,105,0.5)', overflow: 'hidden' },
  meterFill:     { height: '100%', borderRadius: 4 },
  holdBar: {
    marginTop: 8,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16,185,129,0.18)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  holdFill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(16,185,129,0.55)',
  },
  holdText: { fontSize: 11, fontWeight: '700', color: '#ecfdf5' },
  hint:     { fontSize: 11, color: '#cbd5e1', marginTop: 6, textAlign: 'center' },
  skipBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: 'rgba(15,18,30,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
  },
  skipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
});
