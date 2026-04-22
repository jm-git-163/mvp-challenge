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
  /** 매칭률 ≥ 80% 가 1.5 s 유지되면 호출. headShoulder 모드에서는 d0 인자 포함. */
  onCalibrated: (info?: { d0?: number }) => void;
  /**
   * "건너뛰기" 버튼으로 사용자가 수동 진행.
   *
   * Team RECOG (2026-04-22): 사용자가 건너뛰기를 눌러도 스쿼트 카운트가
   *   즉시 작동하도록 기본 d0(≈0.15, 정면 서있는 성인 평균값)을 주입한다.
   *   headShoulder 모드에서 호출 시 info.d0=0.15 default. useJudgement 의
   *   injectSquatBaseline(d0) 이 HeadShoulderSquatDetector 를 즉시 calibrated
   *   상태로 전환 → 첫 프레임부터 rep 카운트 가능.
   */
  onSkip: (info?: { d0?: number }) => void;
  /**
   * Team SQUAT (2026-04-22): research §4.2 "정면으로 서주세요" 3초 캘리브레이션.
   *   - 'fullBody' (기본, 기존 스틱맨 매칭)
   *   - 'headShoulder' (3초간 shoulder.y − nose.y 평균·표준편차 측정 → d0 계산)
   * 스쿼트 템플릿(neon-arena 등)에서 'headShoulder' 로 호출.
   */
  mode?: 'fullBody' | 'headShoulder';
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
// FIX-Z25 (2026-04-22): 3s → 0 (처음부터 노출). 실기기 피드백: 캘리브레이션 자체가 장벽.
const SKIP_VISIBLE_AFTER_MS = 0;
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

// Team SQUAT (2026-04-22): headShoulder 캘리브레이션 상수 (research §4.2)
const HS_CALIB_MS = 3000;
const HS_MIN_SAMPLES = 20;
const HS_SIGMA_LIMIT = 0.08;
const HS_NOSE_VIS = 0.30;
const HS_SHOULDER_VIS = 0.30;

export function PoseCalibration({ landmarks, onCalibrated, onSkip, mode = 'fullBody' }: Props) {
  if (mode === 'headShoulder') {
    return (
      <HeadShoulderCalibration
        landmarks={landmarks}
        onCalibrated={onCalibrated}
        onSkip={onSkip}
      />
    );
  }
  return <FullBodyCalibration landmarks={landmarks} onCalibrated={onCalibrated} onSkip={onSkip} />;
}

function FullBodyCalibration({ landmarks, onCalibrated, onSkip }: Props) {
  const [matchPct, setMatchPct] = useState(0);
  const [visible, setVisible] = useState(0);
  // FIX-Z25: 건너뛰기 버튼 처음부터 크게 노출.
  const [showSkip, setShowSkip] = useState(true);
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
    // FIX-AA (2026-04-22): 같은 값이면 setState 호출 자체를 억제해
    //   React 리렌더 연쇄 차단 (landmarks 는 100ms 주기로 들어옴).
    setMatchPct((prev) => (prev === pct ? prev : pct));
    setVisible((prev) => (prev === v ? prev : v));

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
        <Pressable
          style={styles.skipBtn}
          onPress={() => onSkip({ d0: 0.15 })}
          hitSlop={12}
        >
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
  // FIX-Z25: 건너뛰기 버튼을 처음부터 크게·눈에 띄게.
  skipBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#fde68a',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  skipText: { color: '#1f2937', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
});

/**
 * Team SQUAT (2026-04-22) — research §4.2 헤드-숄더 캘리브레이션.
 *
 * 3초간 landmarks 의 d = mean(shoulder.y) − nose.y 를 수집.
 * mean(d) → d0, σ(d) 확인. σ/d0 ≤ 0.08 이면 onCalibrated({ d0 }).
 * 흔들리면 "움직이지 마세요" 로 재시도 유도.
 *
 * 촬영 중 팝업 금지 규정 준수: 이 컴포넌트는 **카운트다운 이전** 단계.
 * 녹화는 시작되지 않음.
 */
function HeadShoulderCalibration({ landmarks, onCalibrated, onSkip }: Props) {
  const startedAtRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const calibratedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'ready' | 'collecting' | 'unstable' | 'done'>('ready');
  const [d0Display, setD0Display] = useState<number>(0);

  useEffect(() => {
    if (calibratedRef.current) return;
    if (!landmarks || landmarks.length === 0) return;

    const nose = landmarks[JOINT_INDEX.nose];
    const lSh  = landmarks[JOINT_INDEX.left_shoulder];
    const rSh  = landmarks[JOINT_INDEX.right_shoulder];
    const noseVis = nose?.visibility ?? nose?.score ?? 0;
    const lVis    = lSh?.visibility  ?? lSh?.score  ?? 0;
    const rVis    = rSh?.visibility  ?? rSh?.score  ?? 0;

    if (noseVis < HS_NOSE_VIS) return; // 얼굴 미검출

    const useL = lVis >= HS_SHOULDER_VIS;
    const useR = rVis >= HS_SHOULDER_VIS;
    if (!useL && !useR) return; // 어깨도 없음 → nose_fallback 은 검출기 내부가 처리. 캘리브레이션은 대기.

    const shY =
      useL && useR ? (lSh.y + rSh.y) / 2 :
      useL ? lSh.y : rSh.y;
    const d = shY - nose.y;
    if (!Number.isFinite(d) || d <= 0) return;

    const now = performance.now();
    if (startedAtRef.current === null) {
      startedAtRef.current = now;
      samplesRef.current = [];
      setStatus('collecting');
    }
    samplesRef.current.push(d);
    const elapsed = now - startedAtRef.current;
    setProgress(Math.min(1, elapsed / HS_CALIB_MS));

    if (elapsed >= HS_CALIB_MS && samplesRef.current.length >= HS_MIN_SAMPLES) {
      const xs = samplesRef.current;
      let s = 0; for (const x of xs) s += x;
      const mean = s / xs.length;
      let sq = 0; for (const x of xs) sq += (x - mean) * (x - mean);
      const sigma = Math.sqrt(sq / xs.length);
      const ratio = mean > 0 ? sigma / mean : Infinity;
      if (ratio <= HS_SIGMA_LIMIT && mean > 0) {
        calibratedRef.current = true;
        setStatus('done');
        setD0Display(mean);
        onCalibrated({ d0: mean });
      } else {
        // 재시작
        startedAtRef.current = null;
        samplesRef.current = [];
        setStatus('unstable');
        setProgress(0);
      }
    }
  }, [landmarks, onCalibrated]);

  const pct = Math.round(progress * 100);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.topBanner} pointerEvents="none">
        <Text style={styles.bannerTitle}>
          🧍 정면을 보고 똑바로 서주세요
        </Text>
        <Text style={styles.bannerSub}>
          {status === 'unstable'
            ? '움직이지 말고 가만히 있어주세요 — 다시 측정합니다'
            : '3초간 가만히 있으면 자동으로 시작됩니다'}
        </Text>
      </View>

      <View style={styles.meterWrap} pointerEvents="none">
        <View style={styles.meterLabelRow}>
          <Text style={[styles.meterLabel, { color: status === 'done' ? '#10b981' : '#f1f5f9' }]}>
            {status === 'done' ? '✅ 측정 완료' :
             status === 'unstable' ? '⚠️ 흔들림 감지 — 재시작' :
             '📏 기준 자세 측정 중'}
          </Text>
          <Text style={[styles.meterPct, { color: status === 'done' ? '#10b981' : '#f1f5f9' }]}>
            {pct}%
          </Text>
        </View>
        <View style={styles.meterBar}>
          <View
            style={[
              styles.meterFill,
              { width: `${pct}%`, backgroundColor: status === 'done' ? '#10b981' : '#3b82f6' },
            ]}
          />
        </View>
        <Text style={styles.hint}>
          {status === 'done'
            ? `기준 d0 = ${d0Display.toFixed(3)} · 촬영을 시작합니다`
            : '폰은 가슴~얼굴 높이에 두고 전신이 다 안 보여도 괜찮습니다'}
        </Text>
      </View>

      <Pressable
        style={styles.skipBtn}
        onPress={() => onSkip({ d0: 0.15 })}
        hitSlop={12}
      >
        <Text style={styles.skipText}>건너뛰기 →</Text>
      </Pressable>
    </View>
  );
}
