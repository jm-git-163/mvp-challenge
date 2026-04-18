/**
 * useJudgement.ts — 미션 판정 훅
 *
 * 핵심 수정:
 *  - voiceScore/voiceTranscript를 ref로 관리해서 useCallback 의존성 사이클 제거
 *  - SpeechRecognizer continuous mode 활용 (speechUtils.ts 업데이트 반영)
 *  - 미션 전환 시 깔끔한 인식 재시작
 */
import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { detectGesture }   from '../utils/poseUtils';
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

export function useJudgement(): {
  judge: (landmarks: NormalizedLandmark[], elapsedMs: number) => {
    score: number;
    tag: JudgementTag;
    currentMission: Mission | null;
    voiceTranscript: string;
  };
  voiceTranscript: string;
  resetVoice: () => void;
} {
  const { activeTemplate, appendFrameTag } = useSessionStore();

  // Use refs for values that change inside callbacks to avoid dep-cycle
  const lastAppendRef      = useRef(0);
  const speechRef          = useRef(new SpeechRecognizer());
  const voiceActiveRef     = useRef(false);
  const lastMissionSeqRef  = useRef<number | null>(null);
  const voiceScoreRef      = useRef(0.62);
  const voiceTranscriptRef = useRef('');
  const stopVoiceRef       = useRef<(() => void) | null>(null);

  // State for UI updates
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const judge = useCallback(
    (landmarks: NormalizedLandmark[], elapsedMs: number) => {
      const now      = Date.now();
      const template = useSessionStore.getState().activeTemplate;
      const mission  = template
        ? getCurrentMission(template.missions, elapsedMs)
        : null;

      // ── Mission changed: restart voice recognition ──────────────────────────
      if (mission?.seq !== lastMissionSeqRef.current) {
        lastMissionSeqRef.current = mission?.seq ?? null;

        // Stop previous recognition session
        if (stopVoiceRef.current) { stopVoiceRef.current(); stopVoiceRef.current = null; }
        if (voiceActiveRef.current) { speechRef.current.stop(); voiceActiveRef.current = false; }

        // Reset voice score for new mission
        voiceScoreRef.current      = 0.62;
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
      }

      let score = 0;

      if (mission) {
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            const hasRealLandmarks = landmarks.length > 0 &&
              landmarks.some(l => l.score !== undefined && l.score > 0.5 && l.score < 0.99);
            if (hasRealLandmarks && mission.gesture_id) {
              score = detectGesture(landmarks, mission.gesture_id);
            } else {
              // Smooth progressive: 0.58 → 0.88 over mission duration
              score = Math.min(0.88, 0.58 + missionProg * 0.5);
            }
            break;
          }

          case 'voice_read': {
            score = voiceScoreRef.current;

            // Start recognition if not already active
            if (!voiceActiveRef.current && speechRef.current.isSupported()) {
              const remainingMs = mission.end_ms - elapsedMs - 300;
              if (remainingMs > 500) {
                voiceActiveRef.current = true;
                const stopFn = speechRef.current.listen(
                  (mission.read_lang ?? 'ko') as 'ko' | 'en',
                  (interim) => {
                    voiceTranscriptRef.current = interim;
                    setVoiceTranscript(interim);
                  },
                  (final) => {
                    voiceActiveRef.current = false;
                    const s = mission.read_text
                      ? Math.max(0.62, textSimilarity(mission.read_text, final))
                      : 0.72;
                    voiceScoreRef.current      = s;
                    voiceTranscriptRef.current = final;
                    setVoiceTranscript(final);
                  },
                  Math.min(remainingMs, 15000), // cap at 15 seconds
                );
                stopVoiceRef.current = stopFn;
              }
            } else if (!speechRef.current.isSupported()) {
              score = Math.min(0.85, 0.62 + missionProg * 0.35);
            }
            break;
          }

          case 'timing':
          case 'expression':
          default: {
            score = Math.min(0.88, 0.62 + missionProg * 0.36);
            break;
          }
        }
      }

      const tag = scoreToTag(score);

      // Throttle appendFrameTag to every 120ms
      if (now - lastAppendRef.current >= 120) {
        appendFrameTag({
          timestamp_ms: elapsedMs,
          score,
          tag,
          mission_seq: mission?.seq ?? 0,
        });
        lastAppendRef.current = now;
      }

      return { score, tag, currentMission: mission, voiceTranscript: voiceTranscriptRef.current };
    },
    // Intentionally minimal deps — values read via refs inside callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendFrameTag],
  );

  const resetVoice = useCallback(() => {
    if (stopVoiceRef.current) { stopVoiceRef.current(); stopVoiceRef.current = null; }
    speechRef.current.stop();
    voiceActiveRef.current      = false;
    lastMissionSeqRef.current   = null;
    voiceScoreRef.current       = 0.62;
    voiceTranscriptRef.current  = '';
    setVoiceTranscript('');
  }, []);

  return { judge, voiceTranscript, resetVoice };
}
