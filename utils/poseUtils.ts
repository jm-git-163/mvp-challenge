/**
 * poseUtils.ts
 * MoveNet 17-keypoint 기준 유틸리티 + 제스처 감지
 */

export const JOINT_INDEX: Record<string, number> = {
  nose: 0, left_eye: 1, right_eye: 2, left_ear: 3, right_ear: 4,
  left_shoulder: 5, right_shoulder: 6,
  left_elbow: 7, right_elbow: 8,
  left_wrist: 9, right_wrist: 10,
  left_hip: 11, right_hip: 12,
  left_knee: 13, right_knee: 14,
  left_ankle: 15, right_ankle: 16,
};

export const POSE_CONNECTIONS: [number, number][] = [
  [0,1],[0,2],[1,3],[2,4],[5,6],
  [5,7],[7,9],[6,8],[8,10],
  [5,11],[6,12],[11,12],
  [11,13],[13,15],[12,14],[14,16],
];

export interface NormalizedLandmark {
  name?: string;
  x: number;
  y: number;
  z?: number;
  score?: number;
  visibility?: number;
}

export function normalizeLandmarks(
  keypoints: Array<{ x: number; y: number; z?: number; score?: number; name?: string }>,
  imageWidth: number, imageHeight: number,
): NormalizedLandmark[] {
  const names = Object.keys(JOINT_INDEX);
  return keypoints.map((kp, i) => ({
    name: kp.name ?? names[i] ?? `joint_${i}`,
    x: kp.x / imageWidth, y: kp.y / imageHeight,
    z: kp.z,
    score: kp.score ?? 1,
  }));
}

// ──────────────────────────────────────────────
// 제스처 감지 (0~1 신뢰도 반환)
// 데스크 앞 사용자 기준: 어깨~머리 영역만 가정
// ──────────────────────────────────────────────
import type { GestureId } from '../types/template';

export function detectGesture(
  lms: NormalizedLandmark[],
  gestureId: GestureId,
  minConf = 0.25,
): number {
  const g = (name: string) => {
    const idx = JOINT_INDEX[name];
    if (idx === undefined) return null;
    const lm = lms[idx];
    return lm && (lm.score ?? lm.visibility ?? 1) >= minConf ? lm : null;
  };

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  // TEAM-HONESTY (2026-04-23): 가짜 점수 척결.
  //   기존엔 랜드마크가 부족하면 0.3 / 0.15 / 0.5 같은 "기본 점수" 를 반환했다.
  //   → 사용자가 가만히 있어도 GOOD/PERFECT 토스트가 떴다.
  //   이제 랜드마크가 없으면 항상 0 을 반환. 또 활성 신호 검출식의 +0.3, +0.5 등
  //   "공짜 가산" 을 제거해 진짜 자세에서만 점수가 오르도록 한다.
  switch (gestureId) {
    case 'hands_up': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const ls = g('left_shoulder'), rs = g('right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      // wrist.y < shoulder.y 일 때만 점수. 어깨 위로 진짜 든 거리만큼만.
      const lUp = clamp((ls.y - lw.y) * 5);
      const rUp = clamp((rs.y - rw.y) * 5);
      return (lUp + rUp) / 2;
    }
    case 'v_sign': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const nose = g('nose');
      if (!lw || !rw || !nose) return 0;
      const refY = nose.y;
      // 손이 코보다 위에 있을 때만 점수
      const lNear = clamp((refY - lw.y + 0.05) * 6);
      const rNear = clamp((refY - rw.y + 0.05) * 6);
      return Math.max(lNear, rNear);
    }
    case 'heart': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const ls = g('left_shoulder'), rs = g('right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      // 양손 가까이 + 가슴 높이
      const dist = Math.abs(lw.x - rw.x) + Math.abs(lw.y - rw.y);
      const closeness = clamp(1 - dist * 3);
      const avgY = (lw.y + rw.y) / 2;
      const shoulderY = (ls.y + rs.y) / 2;
      const heightOk = clamp(1 - Math.abs(avgY - (shoulderY - 0.1)) * 5);
      return closeness * 0.7 + heightOk * 0.3;
    }
    case 'arms_spread': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const ls = g('left_shoulder'), rs = g('right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      const spread = rw.x - lw.x; // 미러 카메라: right_wrist가 화면 왼쪽에 나타남
      const shoulderSpread = Math.abs(rs.x - ls.x);
      // 어깨 폭의 1.6배 이상 벌렸을 때만 점수 시작
      return clamp((spread - shoulderSpread * 1.6) * 4);
    }
    case 'thumbs_up': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const le = g('left_elbow'), re = g('right_elbow');
      const ls = g('left_shoulder'), rs = g('right_shoulder');
      if (!lw && !rw) return 0;
      // 엄지척: 손목이 팔꿈치보다 확실히 위. 공짜 가산 제거.
      const lUp = (lw && le) ? clamp((le.y - lw.y) * 10) : 0;
      const rUp = (rw && re) ? clamp((re.y - rw.y) * 10) : 0;
      const lHigh = (lw && ls) ? clamp((ls.y - lw.y) * 6) : 0;
      const rHigh = (rw && rs) ? clamp((rs.y - rw.y) * 6) : 0;
      return Math.max(lUp, rUp, lHigh, rHigh);
    }
    case 'wave': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const nose = g('nose');
      if ((!lw && !rw) || !nose) return 0;
      const refY = nose.y;
      const lWave = lw ? clamp((refY + 0.05 - lw.y) * 6) : 0;
      const rWave = rw ? clamp((refY + 0.05 - rw.y) * 6) : 0;
      return Math.max(lWave, rWave);
    }
    case 'point_cam': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      const ls = g('left_shoulder'), rs = g('right_shoulder');
      if (!lw || !rw || !ls || !rs) return 0;
      const center = 0.5;
      const lCenter = clamp(1 - Math.abs(lw.x - center) * 4) * clamp((ls.y - lw.y) * 5);
      const rCenter = clamp(1 - Math.abs(rw.x - center) * 4) * clamp((rs.y - rw.y) * 5);
      return Math.max(lCenter, rCenter);
    }
    case 'arms_cross': {
      const lw = g('left_wrist'), rw = g('right_wrist');
      if (!lw || !rw) return 0;
      const crossed = lw.x - rw.x; // positive = crossed
      return clamp(crossed * 4);
    }
    case 'lean_left': {
      const nose = g('nose');
      if (!nose) return 0;
      // 0.5 에서 시작하면 가만히 있어도 0.3 점수 → 제거. 정중앙은 0 점.
      return clamp((0.5 - nose.x) * 5);
    }
    case 'lean_right': {
      const nose = g('nose');
      if (!nose) return 0;
      return clamp((nose.x - 0.5) * 5);
    }
    default:
      // 알 수 없는 제스처 — 가짜 0.5 PERFECT 트리거 금지.
      return 0;
  }
}

// ──────────────────────────────────────────────
// 스쿼트 감지 (knee angle 기반)
// ──────────────────────────────────────────────

/**
 * 세 관절(a→b→c)이 이루는 각도를 0~180° 범위로 반환
 * b = vertex (무릎), a = 위(힙), c = 아래(발목)
 */
export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) -
    Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return angle;
}

export interface SquatState {
  phase: 'up' | 'down' | 'unknown';
  kneeAngle: number; // degrees — average of both knees
  score: number;     // 0~1 quality of squat
}

/**
 * 랜드마크에서 스쿼트 자세 감지
 *  - phase 'down' : 무릎 각도 < 110° (스쿼트 완료)
 *  - phase 'up'   : 무릎 각도 > 155° (서 있는 상태)
 *  - score        : 1.0(90°), 0.85(~120°), 0.65(~150°), 0.4(서있음)
 */
export function detectSquat(lms: NormalizedLandmark[], minConf = 0.25): SquatState {
  const MIN = minConf;
  const safe = (name: string) => {
    const idx = JOINT_INDEX[name];
    if (idx === undefined) return null;
    const lm = lms[idx];
    return lm && (lm.score ?? lm.visibility ?? 1) >= MIN ? lm : null;
  };

  const lhip = safe('left_hip');   const rhip = safe('right_hip');
  const lknee = safe('left_knee'); const rknee = safe('right_knee');
  const lank = safe('left_ankle'); const rank = safe('right_ankle');
  const lsho = safe('left_shoulder'); const rsho = safe('right_shoulder');

  const angles: number[] = [];
  if (lhip && lknee && lank) angles.push(calculateAngle(lhip, lknee, lank));
  if (rhip && rknee && rank) angles.push(calculateAngle(rhip, rknee, rank));

  // Primary path — we have proper knee angles
  if (angles.length > 0) {
    const avg = angles.reduce((s, v) => s + v, 0) / angles.length;
    const phase: SquatState['phase'] =
      avg < 115 ? 'down' :
      avg > 150 ? 'up'   : 'unknown';

    const score =
      avg < 95  ? 1.00 :
      avg < 120 ? 0.85 :
      avg < 150 ? 0.65 : 0.40;

    return { phase, kneeAngle: avg, score };
  }

  // ── Fallback: ankles often out of frame on phone selfie.
  //    Use shoulder→hip vs hip→knee ratio as a depth proxy.
  const hip  = lhip ?? rhip;
  const knee = lknee ?? rknee;
  const sho  = lsho ?? rsho;
  if (hip && knee && sho) {
    // Standing: hip roughly mid-torso; squatting: hip descends towards knee line
    const torso = Math.max(0.01, Math.abs(hip.y - sho.y));
    const thigh = Math.max(0.01, Math.abs(knee.y - hip.y));
    const ratio = thigh / torso;           // standing ≈ 0.8+, deep squat ≈ 0.15~0.35

    // Map ratio back to a pseudo-angle for downstream UX
    const pseudoAngle =
      ratio > 0.75 ? 170 :
      ratio > 0.55 ? 150 :
      ratio > 0.40 ? 125 :
      ratio > 0.25 ? 100 : 85;

    const phase: SquatState['phase'] =
      ratio < 0.40 ? 'down' :
      ratio > 0.70 ? 'up'   : 'unknown';

    const score =
      ratio < 0.30 ? 1.00 :
      ratio < 0.45 ? 0.80 :
      ratio < 0.60 ? 0.55 : 0.35;

    return { phase, kneeAngle: pseudoAngle, score };
  }

  return { phase: 'unknown', kneeAngle: 180, score: 0 };
}

// ──────────────────────────────────────────────
// 코사인 유사도 (pose 타입 미션용 — 레거시)
// ──────────────────────────────────────────────
export function computePoseSimilarity(
  current: NormalizedLandmark[],
  targetJoints: Partial<Record<string, [number, number]>>,
  minConfidence = 0.3,
): number {
  const jointNames = Object.keys(targetJoints);
  if (jointNames.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0, valid = 0;
  for (const name of jointNames) {
    const idx = JOINT_INDEX[name]; if (idx === undefined) continue;
    const lm = current[idx]; if (!lm || (lm.score ?? lm.visibility ?? 1) < minConfidence) continue;
    const [tx, ty] = targetJoints[name]!;
    dot += lm.x * tx + lm.y * ty;
    normA += lm.x ** 2 + lm.y ** 2;
    normB += tx ** 2 + ty ** 2;
    valid++;
  }
  if (valid === 0 || normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, (dot / (Math.sqrt(normA) * Math.sqrt(normB)) + 1) / 2));
}

// ──────────────────────────────────────────────
// 목 포즈 — 제스처 별 키프레임
// ──────────────────────────────────────────────
const NAMES = Object.keys(JOINT_INDEX);

function makePose(coords: [number,number][], score = 0.92): NormalizedLandmark[] {
  return coords.map(([x,y], i) => ({ name: NAMES[i], x, y, z: 0, score }));
}

// 기본 정면 앉은 자세 (상반신만 보임)
const BASE_POSE: [number,number][] = [
  [0.50, 0.18], // nose
  [0.47, 0.15], // left_eye
  [0.53, 0.15], // right_eye
  [0.44, 0.17], // left_ear
  [0.56, 0.17], // right_ear
  [0.38, 0.38], // left_shoulder
  [0.62, 0.38], // right_shoulder
  [0.28, 0.58], // left_elbow
  [0.72, 0.58], // right_elbow
  [0.22, 0.75], // left_wrist
  [0.78, 0.75], // right_wrist
  [0.42, 0.80], // left_hip
  [0.58, 0.80], // right_hip
  [0.42, 0.95], // left_knee
  [0.58, 0.95], // right_knee
  [0.42, 1.10], // left_ankle (frame 밖)
  [0.58, 1.10], // right_ankle (frame 밖)
];

const GESTURE_POSES: Record<string, [number,number][]> = {
  neutral: BASE_POSE,
  hands_up: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.28, 0.20],[0.72, 0.20], // 팔꿈치 올라감
    [0.22, 0.05],[0.78, 0.05], // 손목 머리 위
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  v_sign: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.52, 0.30],[0.72, 0.55],
    [0.55, 0.12],[0.78, 0.75], // 오른손 브이 (얼굴 옆)
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  heart: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.40, 0.50],[0.60, 0.50],
    [0.47, 0.35],[0.53, 0.35], // 손 가까이 (하트)
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  arms_spread: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.18, 0.50],[0.82, 0.50],
    [0.05, 0.55],[0.95, 0.55], // 양팔 완전히 펼침
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  thumbs_up: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.65, 0.40],[0.28, 0.60],
    [0.60, 0.22],[0.22, 0.75], // 오른손 엄지척
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  wave: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.65, 0.35],[0.28, 0.60],
    [0.70, 0.15],[0.22, 0.75], // 오른손 흔들기 (머리 옆)
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  point_cam: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.62, 0.30],[0.28, 0.60],
    [0.50, 0.20],[0.22, 0.75], // 오른손 카메라 가리키기
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  arms_cross: [
    [0.50, 0.18],[0.47, 0.15],[0.53, 0.15],[0.44, 0.17],[0.56, 0.17],
    [0.38, 0.38],[0.62, 0.38],
    [0.48, 0.55],[0.52, 0.55],
    [0.58, 0.55],[0.42, 0.55], // 팔짱
    [0.42, 0.80],[0.58, 0.80],[0.42, 0.95],[0.58, 0.95],[0.42, 1.10],[0.58, 1.10],
  ],
  lean_left: [
    [0.40, 0.20],[0.37, 0.17],[0.43, 0.17],[0.34, 0.19],[0.46, 0.19], // 머리 왼쪽
    [0.30, 0.40],[0.54, 0.40],
    [0.20, 0.60],[0.64, 0.60],
    [0.14, 0.77],[0.70, 0.77],
    [0.34, 0.82],[0.50, 0.82],[0.34, 0.97],[0.50, 0.97],[0.34, 1.10],[0.50, 1.10],
  ],
};

export function generateGesturePose(gestureId: string, t: number): NormalizedLandmark[] {
  const base = GESTURE_POSES[gestureId] ?? BASE_POSE;
  const sway = Math.sin(t * 0.003) * 0.008;
  return makePose(base.map(([x, y], i) => [
    x + (i <= 4 ? sway : 0),
    y + (i === 0 ? Math.sin(t * 0.002) * 0.003 : 0),
  ] as [number,number]));
}

// 시간 기반 제스처 사이클 (목 모드용)
const GESTURE_CYCLE: GestureId[] = [
  'wave', 'hands_up', 'v_sign', 'heart',
  'arms_spread', 'thumbs_up', 'point_cam', 'arms_cross',
];

// ── 스쿼트 목 포즈 (서있음 ↔ 앉음 사이클) ─────────────────────────────────────
// 스쿼트 동작을 시뮬레이션: 4초 주기로 standing → squatting → standing

// 서 있는 자세 (전신) — 무릎 각도 ≈ 170°
const SQUAT_STANDING: [number, number][] = [
  [0.50, 0.08], // nose
  [0.47, 0.06], // left_eye
  [0.53, 0.06], // right_eye
  [0.44, 0.07], // left_ear
  [0.56, 0.07], // right_ear
  [0.38, 0.22], // left_shoulder
  [0.62, 0.22], // right_shoulder
  [0.30, 0.42], // left_elbow
  [0.70, 0.42], // right_elbow
  [0.26, 0.60], // left_wrist
  [0.74, 0.60], // right_wrist
  [0.42, 0.55], // left_hip
  [0.58, 0.55], // right_hip
  [0.42, 0.78], // left_knee
  [0.58, 0.78], // right_knee
  [0.42, 0.96], // left_ankle
  [0.58, 0.96], // right_ankle
];

// 스쿼트 완료 자세 — 무릎 각도 ≈ 85°
const SQUAT_DOWN: [number, number][] = [
  [0.50, 0.20], // nose (몸이 내려가서 전체적으로 y가 증가)
  [0.47, 0.18], // left_eye
  [0.53, 0.18], // right_eye
  [0.44, 0.19], // left_ear
  [0.56, 0.19], // right_ear
  [0.38, 0.36], // left_shoulder
  [0.62, 0.36], // right_shoulder
  [0.28, 0.50], // left_elbow (팔은 앞으로)
  [0.72, 0.50], // right_elbow
  [0.30, 0.62], // left_wrist
  [0.70, 0.62], // right_wrist
  [0.40, 0.65], // left_hip (낮아짐)
  [0.60, 0.65], // right_hip
  [0.35, 0.85], // left_knee (앞으로 나옴)
  [0.65, 0.85], // right_knee
  [0.40, 0.95], // left_ankle
  [0.60, 0.95], // right_ankle
];

/**
 * 스쿼트 목 포즈 — t(ms) 기반으로 서있음↔앉음 보간
 * 4초 주기: 0~1s 내려가기, 1~2s 유지, 2~3s 올라오기, 3~4s 유지
 */
export function generateSquatMockPose(t: number): NormalizedLandmark[] {
  const cycleMs = 4000;
  const phase   = (t % cycleMs) / cycleMs; // 0~1

  // easeInOut 보간
  let blend: number;
  if (phase < 0.25) {
    // 내려가기 (0→1)
    const p = phase / 0.25;
    blend = p * p * (3 - 2 * p); // smoothstep
  } else if (phase < 0.5) {
    // 아래 유지
    blend = 1;
  } else if (phase < 0.75) {
    // 올라오기 (1→0)
    const p = (phase - 0.5) / 0.25;
    blend = 1 - p * p * (3 - 2 * p);
  } else {
    // 위 유지
    blend = 0;
  }

  const interp = (a: number, b: number) => a + (b - a) * blend;
  const coords = SQUAT_STANDING.map(([ax, ay], i) => [
    interp(ax, SQUAT_DOWN[i][0]),
    interp(ay, SQUAT_DOWN[i][1]),
  ] as [number, number]);

  return makePose(coords, 0.92);
}

export function generateMockPose(t: number): NormalizedLandmark[] {
  const cycleMs = 3000;
  const idx = Math.floor(t / cycleMs) % GESTURE_CYCLE.length;
  return generateGesturePose(GESTURE_CYCLE[idx], t);
}
