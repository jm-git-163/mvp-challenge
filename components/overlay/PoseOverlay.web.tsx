/**
 * PoseOverlay.web.tsx — 웹 전용 (Skia 없음)
 * 인라인 SVG로 포즈 스틱 피겨를 렌더링합니다.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import type { NormalizedLandmark } from '../../utils/poseUtils';
import { POSE_CONNECTIONS, JOINT_INDEX } from '../../utils/poseUtils';

const { width: SW, height: SH } = Dimensions.get('window');
const MIN_CONF = 0.3;

interface Props {
  userPose:      NormalizedLandmark[];
  targetJoints?: Partial<Record<string, [number, number]>>;
  width?:  number;
  height?: number;
}

export default function PoseOverlay({
  userPose,
  targetJoints,
  width  = SW,
  height = SH,
}: Props) {

  const userLines = useMemo(() =>
    POSE_CONNECTIONS.map(([ai, bi]) => {
      const a = userPose[ai], b = userPose[bi];
      if (!a || !b || (a.score ?? a.visibility ?? 1) < MIN_CONF || (b.score ?? b.visibility ?? 1) < MIN_CONF) return null;
      return { x1: a.x * width, y1: a.y * height, x2: b.x * width, y2: b.y * height };
    }).filter(Boolean), [userPose, width, height]);

  const userDots = useMemo(() =>
    userPose.filter(lm => (lm.score ?? lm.visibility ?? 1) >= MIN_CONF)
      .map(lm => ({ cx: lm.x * width, cy: lm.y * height })),
    [userPose, width, height]);

  const targetLines = useMemo(() => {
    if (!targetJoints) return [];
    const pm: Record<number, { x: number; y: number }> = {};
    Object.entries(targetJoints).forEach(([name, coords]) => {
      const [x, y] = coords as [number, number];
      const idx = JOINT_INDEX[name];
      if (idx !== undefined) pm[idx] = { x: x * width, y: y * height };
    });
    return POSE_CONNECTIONS
      .filter(([ai, bi]) => pm[ai] && pm[bi])
      .map(([ai, bi]) => ({ x1: pm[ai].x, y1: pm[ai].y, x2: pm[bi].x, y2: pm[bi].y }));
  }, [targetJoints, width, height]);

  const targetDots = useMemo(() => {
    if (!targetJoints) return [];
    return Object.entries(targetJoints).map(([, coords]) => {
      const [x, y] = coords as [number, number];
      return { cx: x * width, cy: y * height };
    });
  }, [targetJoints, width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {/* @ts-ignore — web SVG */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* 목표 포즈 (흰색 반투명) */}
        <g opacity="0.35">
          {targetLines.map((l, i) => (
            <line key={`tl-${i}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="white" strokeWidth="4" strokeLinecap="round"
            />
          ))}
          {targetDots.map((d, i) => (
            <circle key={`td-${i}`} cx={d.cx} cy={d.cy} r="8" fill="white" />
          ))}
        </g>

        {/* 사용자 포즈 (파란색) */}
        {userLines.map((l, i) => l && (
          <line key={`ul-${i}`}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="#4fc3f7" strokeWidth="3" strokeLinecap="round"
          />
        ))}
        {userDots.map((d, i) => (
          <circle key={`ud-${i}`} cx={d.cx} cy={d.cy} r="6" fill="#e94560" />
        ))}
      </svg>
    </View>
  );
}
