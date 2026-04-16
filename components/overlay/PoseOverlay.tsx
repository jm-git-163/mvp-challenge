/**
 * PoseOverlay.tsx
 *
 * @shopify/react-native-skia 기반 포즈 오버레이
 *  - 파란색: 사용자 현재 포즈
 *  - 반투명 흰색: 목표 포즈 실루엣
 *  - 관절 연결선 + 원 렌더링
 */

import React, { useMemo } from 'react';
import { Dimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Line,
  Group,
  Paint,
  vec,
} from '@shopify/react-native-skia';
import type { NormalizedLandmark } from '../../utils/poseUtils';
import { POSE_CONNECTIONS, JOINT_INDEX } from '../../utils/poseUtils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── 설정 상수 ─────────────────────────────────
const JOINT_RADIUS   = 6;
const LINE_WIDTH     = 3;
const TARGET_OPACITY = 0.35;
const MIN_CONFIDENCE = 0.3;

// ── 색상 ──────────────────────────────────────
const COLOR_USER   = '#4fc3f7';  // 파란색: 사용자
const COLOR_TARGET = '#ffffff';  // 흰색: 목표
const COLOR_JOINT  = '#e94560';  // 빨간 원: 관절

interface Props {
  userPose:    NormalizedLandmark[];                              // 현재 감지 포즈
  targetJoints?: Partial<Record<string, [number, number]>>;       // 템플릿 목표 좌표
  width?:  number;
  height?: number;
}

// ──────────────────────────────────────────────
// 정규화 → 화면 픽셀 변환
// ──────────────────────────────────────────────
function toScreen(x: number, y: number, w: number, h: number) {
  return { sx: x * w, sy: y * h };
}

// ──────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────
export default function PoseOverlay({
  userPose,
  targetJoints,
  width  = SCREEN_W,
  height = SCREEN_H,
}: Props) {

  // ── 사용자 포즈 렌더 데이터 계산
  const userConnections = useMemo(() => {
    if (!userPose.length) return [];
    return POSE_CONNECTIONS.map(([ai, bi]) => {
      const a = userPose[ai];
      const b = userPose[bi];
      if (!a || !b || a.score < MIN_CONFIDENCE || b.score < MIN_CONFIDENCE) return null;
      return {
        x1: a.x * width,  y1: a.y * height,
        x2: b.x * width,  y2: b.y * height,
      };
    }).filter(Boolean);
  }, [userPose, width, height]);

  const userJoints = useMemo(() => {
    return userPose
      .filter(lm => lm.score >= MIN_CONFIDENCE)
      .map(lm => ({ cx: lm.x * width, cy: lm.y * height }));
  }, [userPose, width, height]);

  // ── 목표 포즈 렌더 데이터 계산
  const targetPoints = useMemo(() => {
    if (!targetJoints) return [];
    return Object.entries(targetJoints).map(([name, coords]) => {
      const [x, y] = coords as [number, number];
      return {
        cx: x * width,
        cy: y * height,
        idx: JOINT_INDEX[name] ?? -1,
      };
    }).filter(p => p.idx >= 0);
  }, [targetJoints, width, height]);

  // 목표 관절들 사이 연결선 (지정된 관절끼리만)
  const targetConnections = useMemo(() => {
    if (!targetJoints) return [];
    const pointMap: Record<number, { x: number; y: number }> = {};
    Object.entries(targetJoints).forEach(([name, coords]) => {
      const [x, y] = coords as [number, number];
      const idx = JOINT_INDEX[name];
      if (idx !== undefined) pointMap[idx] = { x: x * width, y: y * height };
    });

    return POSE_CONNECTIONS
      .filter(([ai, bi]) => pointMap[ai] && pointMap[bi])
      .map(([ai, bi]) => ({
        x1: pointMap[ai].x, y1: pointMap[ai].y,
        x2: pointMap[bi].x, y2: pointMap[bi].y,
      }));
  }, [targetJoints, width, height]);

  return (
    <Canvas style={{ position: 'absolute', width, height, top: 0, left: 0 }} pointerEvents="none">

      {/* ─── 목표 포즈 (흰색 반투명) ─── */}
      <Group opacity={TARGET_OPACITY}>
        {targetConnections.map((conn, i) => (
          <Line
            key={`tc-${i}`}
            p1={vec(conn.x1, conn.y1)}
            p2={vec(conn.x2, conn.y2)}
            color={COLOR_TARGET}
            style="stroke"
            strokeWidth={LINE_WIDTH + 1}
          />
        ))}
        {targetPoints.map((pt, i) => (
          <Circle
            key={`tj-${i}`}
            cx={pt.cx}
            cy={pt.cy}
            r={JOINT_RADIUS + 2}
            color={COLOR_TARGET}
          />
        ))}
      </Group>

      {/* ─── 사용자 포즈 (파란색) ─── */}
      {userConnections.map((conn, i) =>
        conn ? (
          <Line
            key={`uc-${i}`}
            p1={vec(conn.x1, conn.y1)}
            p2={vec(conn.x2, conn.y2)}
            color={COLOR_USER}
            style="stroke"
            strokeWidth={LINE_WIDTH}
          />
        ) : null
      )}
      {userJoints.map((joint, i) => (
        <Circle
          key={`uj-${i}`}
          cx={joint.cx}
          cy={joint.cy}
          r={JOINT_RADIUS}
          color={COLOR_JOINT}
        />
      ))}
    </Canvas>
  );
}
