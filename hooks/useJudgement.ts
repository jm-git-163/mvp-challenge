/**
 * useJudgement.ts
 * 제스처/포즈 판정 시스템
 */
import { useCallback, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { detectGesture, computePoseSimilarity } from '../utils/poseUtils';
import type { NormalizedLandmark } from '../utils/poseUtils';
import type { JudgementTag } from '../types/session';
import type { Mission } from '../types/template';

const THRESHOLD_PERFECT = 0.82;
const THRESHOLD_GOOD    = 0.58;

export function scoreToTag(score: number): JudgementTag {
  if (score >= THRESHOLD_PERFECT) return 'perfect';
  if (score >= THRESHOLD_GOOD)    return 'good';
  return 'fail';
}

function getCurrentMission(missions: Mission[], elapsedMs: number): Mission | null {
  return missions.find(m => elapsedMs >= m.start_ms && elapsedMs < m.end_ms) ?? null;
}

function computeScore(mission: Mission, landmarks: NormalizedLandmark[]): number {
  if (!mission || landmarks.length === 0) return 0;

  switch (mission.type) {
    case 'gesture':
      if (!mission.gesture_id) return 0.5;
      return detectGesture(landmarks, mission.gesture_id);

    case 'timing':
    case 'expression':
      // 타이밍/표정 미션: 화면에 있으면 기본 pass
      return 0.72 + Math.random() * 0.2;

    case 'pose':
    default:
      if (!mission.target_joints) return 0.5;
      return computePoseSimilarity(landmarks, mission.target_joints);
  }
}

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
      const mission = activeTemplate
        ? getCurrentMission(activeTemplate.missions, elapsedMs)
        : null;

      let score = 0;
      if (mission && landmarks.length > 0) {
        score = computeScore(mission, landmarks);
      }

      const tag = scoreToTag(score);

      if (now - lastAppendRef.current >= 120) {
        appendFrameTag({ timestamp_ms: elapsedMs, score, tag, mission_seq: mission?.seq ?? 0 });
        lastAppendRef.current = now;
      }

      return { score, tag, currentMission: mission };
    },
    [activeTemplate, recordingStartedAt, appendFrameTag]
  );

  return { judge };
}
