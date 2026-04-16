/**
 * useJudgement.ts — 제스처 + 음성 통합 판정
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
  judge: (landmarks: NormalizedLandmark[]) => JudgementResult;
  voiceTranscript: string;
  resetVoice: () => void;
} {
  const { activeTemplate, recordingStartedAt, appendFrameTag } = useSessionStore();
  const lastAppendRef   = useRef(0);
  const speechRef       = useRef(new SpeechRecognizer());
  const voiceActiveRef  = useRef(false);
  const lastMissionSeqRef = useRef<number | null>(null);

  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceScore,      setVoiceScore]      = useState(0.6);

  const judge = useCallback(
    (landmarks: NormalizedLandmark[]): JudgementResult => {
      const now = Date.now();
      const elapsedMs = recordingStartedAt ? now - recordingStartedAt : 0;
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
        setVoiceScore(0.6);
        setVoiceTranscript('');
      }

      let score = 0;

      if (mission) {
        switch (mission.type) {
          case 'gesture':
            if (mission.gesture_id && landmarks.length > 0) {
              score = detectGesture(landmarks, mission.gesture_id);
            } else {
              score = 0.6;
            }
            break;

          case 'voice_read':
            // Use accumulated voice score; start recognition if not active
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
                      ? textSimilarity(mission.read_text, final)
                      : 0.7;
                    setVoiceScore(Math.max(0.6, s));
                    setVoiceTranscript(final);
                    voiceActiveRef.current = false;
                  },
                  remainingMs,
                );
              }
            } else if (!speechRef.current.isSupported()) {
              // Auto-pass on unsupported browsers
              score = 0.7;
            }
            break;

          case 'timing':
            // Score increases over time within the mission
            score =
              0.65 +
              Math.min(
                0.25,
                ((elapsedMs - mission.start_ms) /
                  (mission.end_ms - mission.start_ms)) *
                  0.25,
              );
            break;

          case 'expression':
            // Gradually increases; peaks at end of mission
            score =
              0.65 +
              Math.min(
                0.25,
                ((elapsedMs - mission.start_ms) /
                  (mission.end_ms - mission.start_ms)) *
                  0.25,
              );
            break;

          default:
            score = 0.6;
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
    [activeTemplate, recordingStartedAt, appendFrameTag, voiceScore, voiceTranscript],
  );

  const resetVoice = useCallback(() => {
    voiceActiveRef.current = false;
    lastMissionSeqRef.current = null;
    setVoiceTranscript('');
    setVoiceScore(0.6);
    speechRef.current.stop();
  }, []);

  return { judge, voiceTranscript, resetVoice };
}
