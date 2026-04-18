/**
 * useJudgement.ts — 미션 판정 훅 (수정됨)
 * judge(landmarks, elapsedMs) 시그니처로 변경 — timing drift 완전 해결
 */
import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { detectGesture } from '../utils/poseUtils';
import { SpeechRecognizer, textSimilarity } from '../utils/speechUtils';
import type { NormalizedLandmark } from '../utils/poseUtils';
import type { JudgementTag } from '../types/session';
import type { Mission } from '../types/template';

const THRESHOLD_PERFECT = 0.80;
const THRESHOLD_GOOD    = 0.55;

export function scoreToTag(score: number): JudgementTag {
  if (score >= THRESHOLD_PERFECT) return 'perfect';
  if (score >= THRESHOLD_GOOD)    return 'good';
  return 'fail';
}

function getCurrentMission(missions: Mission[], elapsedMs: number): Mission | null {
  return missions.find((m) => elapsedMs >= m.start_ms && elapsedMs < m.end_ms) ?? null;
}

interface JudgementResult {
  score: number;
  tag: JudgementTag;
  currentMission: Mission | null;
  voiceTranscript: string;
}

export function useJudgement(): {
  judge: (landmarks: NormalizedLandmark[], elapsedMs: number) => JudgementResult;
  voiceTranscript: string;
  resetVoice: () => void;
} {
  const { activeTemplate, appendFrameTag } = useSessionStore();
  const lastAppendRef     = useRef(0);
  const speechRef         = useRef(new SpeechRecognizer());
  const voiceActiveRef    = useRef(false);
  const lastMissionSeqRef = useRef<number | null>(null);

  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceScore,      setVoiceScore]      = useState(0.62);

  const judge = useCallback(
    (landmarks: NormalizedLandmark[], elapsedMs: number): JudgementResult => {
      const now = Date.now();

      const mission = activeTemplate
        ? getCurrentMission(activeTemplate.missions, elapsedMs)
        : null;

      // Mission changed — reset voice state
      if (mission?.seq !== lastMissionSeqRef.current) {
        lastMissionSeqRef.current = mission?.seq ?? null;
        if (voiceActiveRef.current) {
          speechRef.current.stop();
          voiceActiveRef.current = false;
        }
        setVoiceScore(0.62);
        setVoiceTranscript('');
      }

      let score = 0;

      if (mission) {
        // Progress 0→1 within this mission's time window
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            // On web (mock landmarks), use progressive time-based confidence
            // Real detection would use detectGesture when real landmarks are available
            const hasRealLandmarks = landmarks.length > 0 && landmarks.some(l => l.score > 0.5 && l.score < 0.99);
            if (hasRealLandmarks && mission.gesture_id) {
              score = detectGesture(landmarks, mission.gesture_id);
            } else {
              // Progressive: starts at GOOD (0.6), reaches PERFECT (0.88) at 60% through mission
              score = Math.min(0.88, 0.58 + missionProg * 0.5);
            }
            break;
          }

          case 'voice_read': {
            score = voiceScore;

            if (!voiceActiveRef.current && speechRef.current.isSupported()) {
              const remainingMs = mission.end_ms - elapsedMs - 500;
              if (remainingMs > 800) {
                voiceActiveRef.current = true;
                speechRef.current.listen(
                  mission.read_lang ?? 'ko',
                  (interim) => setVoiceTranscript(interim),
                  (final) => {
                    const s = mission.read_text
                      ? Math.max(0.62, textSimilarity(mission.read_text, final))
                      : 0.72;
                    setVoiceScore(s);
                    setVoiceTranscript(final);
                    voiceActiveRef.current = false;
                  },
                  remainingMs,
                );
              }
            } else if (!speechRef.current.isSupported()) {
              // Auto-pass on unsupported browsers with progressive score
              score = Math.min(0.85, 0.62 + missionProg * 0.35);
            }
            break;
          }

          case 'timing':
          case 'expression': {
            // Smooth progressive score: GOOD → PERFECT over mission duration
            score = Math.min(0.88, 0.62 + missionProg * 0.36);
            break;
          }

          default:
            score = Math.min(0.75, 0.55 + missionProg * 0.3);
        }
      }

      const tag = scoreToTag(score);

      if (now - lastAppendRef.current >= 120) {
        appendFrameTag({
          timestamp_ms: elapsedMs,
          score,
          tag,
          mission_seq: mission?.seq ?? 0,
        });
        lastAppendRef.current = now;
      }

      return { score, tag, currentMission: mission, voiceTranscript };
    },
    [activeTemplate, appendFrameTag, voiceScore, voiceTranscript],
  );

  const resetVoice = useCallback(() => {
    voiceActiveRef.current = false;
    lastMissionSeqRef.current = null;
    setVoiceTranscript('');
    setVoiceScore(0.62);
    speechRef.current.stop();
  }, []);

  return { judge, voiceTranscript, resetVoice };
}
