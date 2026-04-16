/**
 * poseUtils.ts
 * MoveNet 17-keypoint 기준 유틸리티
 * TF.js @tensorflow-models/pose-detection 와 동일한 인덱스 사용
 */

// ──────────────────────────────────────────────
// 1. 관절 이름 → 인덱스 매핑 (MoveNet 17개)
// ──────────────────────────────────────────────
export const JOINT_INDEX: Record<string, number> = {
  nose:           0,
  left_eye:       1,
  right_eye:      2,
  left_ear:       3,
  right_ear:      4,
  left_shoulder:  5,
  right_shoulder: 6,
  left_elbow:     7,
  right_elbow:    8,
  left_wrist:     9,
  right_wrist:   10,
  left_hip:      11,
  right_hip:     12,
  left_knee:     13,
  right_knee:    14,
  left_ankle:    15,
  right_ankle:   16,
};

// ──────────────────────────────────────────────
// 2. 스틱 피겨 연결선 정의
// ──────────────────────────────────────────────
export const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2],          // 코 → 눈
  [1, 3], [2, 4],          // 눈 → 귀
  [5, 6],                  // 어깨
  [5, 7],  [7,  9],        // 왼팔
  [6, 8],  [8, 10],        // 오른팔
  [5, 11], [6, 12],        // 어깨 → 엉덩이
  [11, 12],                // 엉덩이
  [11, 13], [13, 15],      // 왼다리
  [12, 14], [14, 16],      // 오른다리
];

// ──────────────────────────────────────────────
// 3. 정규화된 랜드마크 타입
// ──────────────────────────────────────────────
export interface NormalizedLandmark {
  name: string;
  x: number;     // 0~1 (가로 비율)
  y: number;     // 0~1 (세로 비율)
  score: number; // 신뢰도 0~1
}

// ──────────────────────────────────────────────
// 4. TF.js Keypoint → NormalizedLandmark 변환
// ──────────────────────────────────────────────
export function normalizeLandmarks(
  keypoints: Array<{ x: number; y: number; score?: number; name?: string }>,
  imageWidth: number,
  imageHeight: number,
): NormalizedLandmark[] {
  const names = Object.keys(JOINT_INDEX);
  return keypoints.map((kp, i) => ({
    name: kp.name ?? names[i] ?? `joint_${i}`,
    x:    kp.x / imageWidth,
    y:    kp.y / imageHeight,
    score: kp.score ?? 1,
  }));
}

// ──────────────────────────────────────────────
// 5. 코사인 유사도 계산
//    target_joints: 템플릿의 목표 좌표 (일부 관절만 지정)
//    current:       감지된 전체 17개 랜드마크
// ──────────────────────────────────────────────
export function computePoseSimilarity(
  current: NormalizedLandmark[],
  targetJoints: Partial<Record<string, [number, number]>>,
  minConfidence = 0.3,
): number {
  const jointNames = Object.keys(targetJoints);
  if (jointNames.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  let validCount = 0;

  for (const name of jointNames) {
    const idx = JOINT_INDEX[name];
    if (idx === undefined) continue;

    const lm = current[idx];
    if (!lm || lm.score < minConfidence) continue;

    const [tx, ty] = targetJoints[name]!;

    // 벡터 성분 (원점 중심 기준으로 차이 최소화)
    dotProduct += lm.x * tx + lm.y * ty;
    normA      += lm.x ** 2 + lm.y ** 2;
    normB      += tx ** 2   + ty ** 2;
    validCount++;
  }

  if (validCount === 0 || normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // -1~1 → 0~1로 정규화
  return Math.max(0, Math.min(1, (similarity + 1) / 2));
}

// ──────────────────────────────────────────────
// 6. 개발용 목 포즈 생성 (TF.js 없이 UI 테스트용)
// ──────────────────────────────────────────────
export function generateMockPose(t: number): NormalizedLandmark[] {
  const sway = Math.sin(t * 0.003) * 0.015;
  const breathe = Math.sin(t * 0.002) * 0.005;

  // T-포즈 기준 좌표
  const base: [number, number][] = [
    [0.50,  0.08 + breathe],  // 0: nose
    [0.47,  0.06],            // 1: left_eye
    [0.53,  0.06],            // 2: right_eye
    [0.44,  0.07],            // 3: left_ear
    [0.56,  0.07],            // 4: right_ear
    [0.38,  0.22 + breathe],  // 5: left_shoulder
    [0.62,  0.22 + breathe],  // 6: right_shoulder
    [0.22,  0.38],            // 7: left_elbow
    [0.78,  0.38],            // 8: right_elbow
    [0.10 + sway, 0.50],     // 9: left_wrist
    [0.90 - sway, 0.50],     // 10: right_wrist
    [0.42,  0.52],            // 11: left_hip
    [0.58,  0.52],            // 12: right_hip
    [0.42,  0.70],            // 13: left_knee
    [0.58,  0.70],            // 14: right_knee
    [0.42,  0.88],            // 15: left_ankle
    [0.58,  0.88],            // 16: right_ankle
  ];

  const names = Object.keys(JOINT_INDEX);
  return base.map(([x, y], i) => ({
    name: names[i],
    x,
    y,
    score: 0.9,
  }));
}
