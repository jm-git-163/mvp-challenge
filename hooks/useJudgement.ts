/**
 * useJudgement.ts
 *
 * 포즈 유사도 → Perfect/Good/Fail 판정
 *  - 현재 미션 구간 계산
 *  - FrameTag 배열 sessionStore에 append
 *  - 반환: { tag, score, currentMission }
 */

import { useCallback, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { computePoseSimilarity } from '../utils/poseUtils';
import type { NormalizedLandmark } from '../utils/poseUtils';
import type { JudgementTag } from '../types/session';
import type { Mission } from '../types/template';

// ── 판정 기준 (project_mvp_conventions.md 기준) ──
const THRESHOLD_PERFECT = 0.85;
const THRESHOLD_GOOD    = 0.65;

export function scoreToTag(score: number): JudgementTag {
  if (score >= THRESHOLD_PERFECT) return 'perfect';
  if (score >= THRESHOLD_GOOD)    return 'good';
  return 'fail';
}

// ──────────────────────────────────────────────
// 현재 미션 찾기
// ──────────────────────────────────────────────
function getCurrentMission(
  missions: Mission[],
  elapsedMs: number,
): Mission | null {
  return (
    missions.find(
      (m) => elapsedMs >= m.start_ms && elapsedMs < m.end_ms
    ) ?? null
  );
}

// ──────────────────────────────────────────────
// 훅
// ──────────────────────────────────────────────
interface JudgementResult {
  score: number;
  tag: JudgementTag;
  currentMission: Mission | null;
}

export function useJudgement(): {
  judge: (landmarks: NormalizedLandmark[]) => JudgementResult;
} {
  const { activeTemplate, recordingStartedAt, appendFrameTag } = useSessionStore();
  const lastAppendRef = useRef(0);

  const judge = useCallback(
    (landmarks: NormalizedLandmark[]): JudgementResult => {
      const now = Date.now();
      const elapsedMs = recordingStartedAt ? now - recordingStartedAt : 0;

      // 현재 미션 찾기
      const mission = activeTemplate
        ? getCurrentMission(activeTemplate.missions, elapsedMs)
        : null;

      // 유사도 계산
      let score = 0;
      if (mission && landmarks.length > 0) {
        score = computePoseSimilarity(landmarks, mission.target_joints);
      }

      const tag = scoreToTag(score);

      // 100ms 이상 경과 시에만 태그 저장 (중복 방지)
      if (now - lastAppendRef.current >= 100) {
        appendFrameTag({
          timestamp_ms: elapsedMs,
          score,
          tag,
          mission_seq: mission?.seq ?? 0,
        });
        lastAppendRef.current = now;
      }

      return { score, tag, currentMission: mission };
    },
    [activeTemplate, recordingStartedAt, appendFrameTag]
  );

  return { judge };
}
