/**
 * useJudgement.ts — 미션 판정 훅
 *
 * 핵심 수정:
 *  - voiceScore/voiceTranscript를 ref로 관리해서 useCallback 의존성 사이클 제거
 *  - SpeechRecognizer continuous mode 활용 (speechUtils.ts 업데이트 반영)
 *  - 미션 전환 시 깔끔한 인식 재시작
 *  - onProgress 콜백으로 실시간 정확도 업데이트 (자모 기반)
 *  - 중간 transcript도 목표 텍스트와 실시간 비교
 */
import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { detectGesture, detectSquat }   from '../utils/poseUtils';
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
    voiceAccuracy: number;
    squatCount: number;
    squatPhase: 'up' | 'down' | 'unknown';
    kneeAngle: number;
  };
  voiceTranscript: string;
  voiceAccuracy: number;
  squatCount: number;
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

  // Squat counter refs (persist across renders, no dep-cycle)
  const squatPhaseRef   = useRef<'up' | 'down' | 'unknown'>('unknown');
  const squatCountRef   = useRef(0);
  const squatCountState = useRef(0); // mirrors squatCountRef for setState trigger
  const lastKneeAngle   = useRef(180);

  // Real-time voice accuracy (0~1) for accuracy bar
  const voiceAccuracyRef = useRef(0);

  // State for UI updates
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAccuracy,   setVoiceAccuracy]   = useState(0);
  const [squatCount, setSquatCount]           = useState(0);

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

        // 이전 recognition 완전 중단
        if (stopVoiceRef.current) { stopVoiceRef.current(); stopVoiceRef.current = null; }
        speechRef.current.stop();
        voiceActiveRef.current = false;

        // SpeechRecognizer 인스턴스 교체 — _listening stuck 완전 방지
        speechRef.current = new SpeechRecognizer();

        // Reset voice score — 음성 지원 시 0에서 시작 (실제로 말해야 점수 올라감)
        voiceScoreRef.current      = 0.10;
        voiceAccuracyRef.current   = 0;
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        setVoiceAccuracy(0);
      }

      // ── 스쿼트 카운터 (fitness 장르 전용 — 전 미션에 걸쳐 지속) ─────────
      let squatPhaseOut: 'up' | 'down' | 'unknown' = squatPhaseRef.current;
      let kneeAngleOut = lastKneeAngle.current;

      if (template && template.genre === 'fitness' && landmarks.length > 0) {
        const sq = detectSquat(landmarks);
        kneeAngleOut = sq.kneeAngle;
        lastKneeAngle.current = sq.kneeAngle;

        // State machine: up → down → up = 1 rep
        if (squatPhaseRef.current !== 'down' && sq.phase === 'down') {
          // Entered squat position
          squatPhaseRef.current = 'down';
          squatPhaseOut = 'down';
        } else if (squatPhaseRef.current === 'down' && sq.phase === 'up') {
          // Completed one full squat rep
          squatCountRef.current += 1;
          squatPhaseRef.current = 'up';
          squatPhaseOut = 'up';
          if (squatCountRef.current !== squatCountState.current) {
            squatCountState.current = squatCountRef.current;
            setSquatCount(squatCountRef.current);
          }
        } else if (sq.phase !== 'unknown') {
          squatPhaseRef.current = sq.phase;
          squatPhaseOut = sq.phase;
        }
      }

      let score = 0;

      if (mission) {
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            // score > 0.3 으로 관대하게 — 상한 제거 (0.99 제거), MediaPipe score는 0~1 정규화
            const hasRealLandmarks = landmarks.length > 0 &&
              landmarks.some(l => (l.score ?? l.visibility ?? 1) > 0.3);
            if (hasRealLandmarks && mission.gesture_id) {
              score = detectGesture(landmarks, mission.gesture_id);
            } else {
              // 카메라/포즈 감지 없을 때 낮은 점수 유지 (모션 유도)
              score = Math.min(0.55, 0.3 + missionProg * 0.25);
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
                  // onInterim: 실시간 중간 결과 + 목표 텍스트와 실시간 비교
                  (interim) => {
                    voiceTranscriptRef.current = interim;
                    setVoiceTranscript(interim);
                    // 중간 결과도 실시간 점수에 반영 (낙관적 업데이트)
                    if (mission.read_text && interim) {
                      const interimSim = textSimilarity(mission.read_text, interim);
                      // 중간 결과는 0.8 가중치로 반영 (확정 아니므로)
                      const newScore = Math.max(voiceScoreRef.current, interimSim * 0.8 + 0.62 * 0.2);
                      voiceScoreRef.current    = Math.min(1, newScore);
                      voiceAccuracyRef.current = interimSim;
                      setVoiceAccuracy(interimSim);
                    }
                  },
                  // onFinal: 최종 결과 확정
                  (final) => {
                    voiceActiveRef.current = false;
                    const sim = mission.read_text
                      ? textSimilarity(mission.read_text, final)
                      : 0.72;
                    // 최종 점수: 유사도를 0.62~1.0 범위로 매핑
                    const s = mission.read_text
                      ? Math.max(0.62, sim)
                      : 0.72;
                    voiceScoreRef.current      = s;
                    voiceAccuracyRef.current   = sim;
                    voiceTranscriptRef.current = final;
                    setVoiceTranscript(final);
                    setVoiceAccuracy(sim);
                  },
                  Math.min(remainingMs, 15000),
                  // targetText와 onProgress 전달로 실시간 정확도 바 업데이트
                  mission.read_text,
                  (similarity) => {
                    voiceAccuracyRef.current = similarity;
                    setVoiceAccuracy(similarity);
                  },
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
            // Fitness 장르: 실제 스쿼트 감지 시에만 고점수 (kneeAngle < 130 = 진짜 스쿼트)
            if (template && template.genre === 'fitness' && kneeAngleOut < 130) {
              const sqScore =
                kneeAngleOut < 90  ? 1.00 :
                kneeAngleOut < 110 ? 0.88 :
                kneeAngleOut < 130 ? 0.72 : 0.50;
              score = sqScore;
            } else {
              // 스쿼트 없으면 낮은 점수 — 동작 유도
              score = Math.min(0.55, 0.3 + missionProg * 0.20);
            }
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

      return {
        score, tag, currentMission: mission,
        voiceTranscript: voiceTranscriptRef.current,
        voiceAccuracy:   voiceAccuracyRef.current,
        squatCount: squatCountRef.current,
        squatPhase: squatPhaseOut,
        kneeAngle: kneeAngleOut,
      };
    },
    // Intentionally minimal deps — values read via refs inside callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendFrameTag],
  );

  const resetVoice = useCallback(() => {
    if (stopVoiceRef.current) { stopVoiceRef.current(); stopVoiceRef.current = null; }
    speechRef.current.stop();
    // 새 인스턴스로 교체 — 챌린지 전환 시 _listening 상태 완전 초기화
    speechRef.current           = new SpeechRecognizer();
    voiceActiveRef.current      = false;
    lastMissionSeqRef.current   = null;
    voiceScoreRef.current       = 0.62;
    voiceAccuracyRef.current    = 0;
    voiceTranscriptRef.current  = '';
    setVoiceTranscript('');
    setVoiceAccuracy(0);
    // 스쿼트 카운터 리셋
    squatCountRef.current       = 0;
    squatCountState.current     = 0;
    squatPhaseRef.current       = 'unknown';
    lastKneeAngle.current       = 180;
    setSquatCount(0);
  }, []);

  return { judge, voiceTranscript, voiceAccuracy, squatCount, resetVoice };
}
