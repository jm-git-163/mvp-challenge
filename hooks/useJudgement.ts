/**
 * useJudgement.ts — 미션 판정 훅 v4
 *
 * 핵심 수정:
 *  ① 모듈 레벨 싱글톤: _voiceActive / _currentTargetText / _interimCb / _finalCb
 *     화면 remount 시 SpeechRecognition 재시작 없이 콜백만 교체 → 팝업 1회
 *  ② 세션 레벨 음성 인식: listen() 1회 → 미션 변경 시 목표 텍스트만 교체
 *  ③ Web Audio 볼륨 감지: SpeechRecognition 실패해도 볼륨으로 점수 상승
 *  ④ prewarmSpeech() export: 녹화 시작 전에 권한 팝업 1회 처리
 */
import { useCallback, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { detectGesture, detectSquat }   from '../utils/poseUtils';
import { getGlobalSpeechRecognizer, textSimilarity } from '../utils/speechUtils';
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

// ── 모듈 레벨: 화면 이동해도 유지 ────────────────────────────────────────────
// SpeechRecognition을 재시작하지 않고, 콜백 참조만 최신으로 교체
let _voiceActive      = false;
let _currentTarget    = '';
let _interimCb: ((t: string) => void) | null = null;
let _finalCb:   ((t: string) => void) | null = null;
let _progressCb: ((s: number) => void) | null = null;
let _voiceStopFn: (() => void) | null = null;

// Web Audio 볼륨 감지 (SpeechRecognition 실패 시 백업 스코어)
let _audioCtx: AudioContext | null = null;
let _analyser: AnalyserNode | null = null;

function setupAudioAnalyser(): void {
  if (_analyser || typeof window === 'undefined') return;
  try {
    const stream = (window as any).__cameraStream as MediaStream | undefined;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') return;
    _audioCtx = new AudioContext();
    const source = _audioCtx.createMediaStreamSource(stream);
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 256;
    source.connect(_analyser);
  } catch { /* 지원 안 해도 무시 */ }
}

function getVolume(): number {
  if (!_analyser) return 0;
  try {
    const data = new Uint8Array(_analyser.frequencyBinCount);
    _analyser.getByteFrequencyData(data);
    return data.reduce((a, b) => a + b, 0) / data.length / 255;
  } catch { return 0; }
}

/**
 * 음성인식 권한을 녹화 전에 미리 얻기 위한 함수.
 * record/index.tsx에서 화면 진입 시 또는 시작 버튼 누를 때 호출.
 */
export function prewarmSpeech(): void {
  const sr = getGlobalSpeechRecognizer();
  if (!sr.isSupported() || sr.isListening() || _voiceActive) return;
  // 아주 짧게 시작해서 권한 다이얼로그를 녹화 전에 처리
  const stop = sr.listen('ko', () => {}, () => {}, 1500);
  setTimeout(stop, 1200);
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Stable refs ────────────────────────────────────────────────────────────
  const lastAppendRef     = useRef(0);
  const lastMissionSeqRef = useRef<number | null>(null);
  const voiceScoreRef     = useRef(0.10);
  const voiceTranscriptRef = useRef('');
  const voiceAccuracyRef  = useRef(0);

  // Squat counter
  const squatPhaseRef   = useRef<'up' | 'down' | 'unknown'>('unknown');
  const squatCountRef   = useRef(0);
  const squatCountState = useRef(0);
  const lastKneeAngle   = useRef(180);

  // UI State
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAccuracy,   setVoiceAccuracy]   = useState(0);
  const [squatCount, setSquatCount]           = useState(0);

  // ─────────────────────────────────────────────────────────────────────────
  const judge = useCallback(
    (landmarks: NormalizedLandmark[], elapsedMs: number) => {
      const now      = Date.now();
      const template = useSessionStore.getState().activeTemplate;
      const mission  = template
        ? getCurrentMission(template.missions, elapsedMs)
        : null;

      // ── Mission changed ─────────────────────────────────────────────────
      if (mission?.seq !== lastMissionSeqRef.current) {
        lastMissionSeqRef.current = mission?.seq ?? null;

        const sr = getGlobalSpeechRecognizer();
        // 누적 텍스트 초기화 (인식 인스턴스/스트림은 유지)
        sr.resetForNextMission();

        // 새 미션 목표 텍스트 교체 — stop/start 없이
        if (mission?.type === 'voice_read' && mission.read_text) {
          _currentTarget = mission.read_text;
          sr.setTargetText(mission.read_text);
        } else {
          _currentTarget = '';
          sr.setTargetText('');
        }

        // 미션별 점수/자막 리셋
        voiceScoreRef.current      = 0.10;
        voiceAccuracyRef.current   = 0;
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        setVoiceAccuracy(0);
      }

      // ── Squat counter ───────────────────────────────────────────────────
      let squatPhaseOut: 'up' | 'down' | 'unknown' = squatPhaseRef.current;
      let kneeAngleOut = lastKneeAngle.current;

      // 스쿼트 카운터는 한쪽 다리(hip/knee/ankle 3개)라도 신뢰도 >0.25 면 작동
      // 책상 카메라에서 한쪽만 잘 잡히는 상황 대응
      const legOk = (h: number, k: number, a: number) =>
        (landmarks[h]?.score ?? landmarks[h]?.visibility ?? 0) > 0.25 &&
        (landmarks[k]?.score ?? landmarks[k]?.visibility ?? 0) > 0.25 &&
        (landmarks[a]?.score ?? landmarks[a]?.visibility ?? 0) > 0.25;
      const squatLmOk = landmarks.length >= 17 &&
        (legOk(11, 13, 15) || legOk(12, 14, 16));
      if (template && template.genre === 'fitness' && squatLmOk) {
        const sq = detectSquat(landmarks);
        kneeAngleOut = sq.kneeAngle;
        lastKneeAngle.current = sq.kneeAngle;

        if (squatPhaseRef.current !== 'down' && sq.phase === 'down') {
          squatPhaseRef.current = 'down';
          squatPhaseOut = 'down';
        } else if (squatPhaseRef.current === 'down' && sq.phase === 'up') {
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

      // ── Score calculation ───────────────────────────────────────────────
      let score = 0;

      if (mission) {
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            // 실제 MoveNet 검출된 고신뢰도 landmark 존재 여부
            // 최소 10개 keypoint가 신뢰도 0.3 이상일 때만 "실제 검출"로 인정
            const hasRealLandmarks = landmarks.length >= 17 &&
              landmarks.filter(l => (l.score ?? l.visibility ?? 0) > 0.3).length >= 10;
            if (hasRealLandmarks && mission.gesture_id) {
              score = detectGesture(landmarks, mission.gesture_id);
            } else {
              // 실제 검출이 없으면 점수 0 — 가짜 상승 없음
              score = 0;
            }
            break;
          }

          case 'voice_read': {
            score = voiceScoreRef.current;

            // Web Audio 볼륨: 점수에는 영향 없음, "발화 중" 감지 UI용
            setupAudioAnalyser();

            // ── 세션 레벨 인식 시작 (1회만) ────────────────────────────────
            const sr = getGlobalSpeechRecognizer();

            if (!_voiceActive && sr.isSupported()) {
              _voiceActive = true;

              // 현재 컴포넌트 인스턴스의 setState를 클로저로 캡처해두되
              // _interimCb / _finalCb 에 저장해서 remount 시 교체 가능
              _interimCb = (interim: string) => {
                voiceTranscriptRef.current = interim;
                setVoiceTranscript(interim);
                const target = _currentTarget;
                if (target && interim) {
                  const sim = textSimilarity(target, interim);
                  const newScore = Math.max(voiceScoreRef.current, sim * 0.8 + 0.10 * 0.2);
                  voiceScoreRef.current    = Math.min(1, newScore);
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };

              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                // 정직한 점수: 목표 없으면 발화 여부로 0/0.3, 목표 있으면 유사도 그대로
                const sim = target ? textSimilarity(target, final) : (final.trim() ? 0.3 : 0);
                voiceScoreRef.current      = sim;
                voiceAccuracyRef.current   = sim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(sim);
              };

              _progressCb = (similarity: number) => {
                voiceAccuracyRef.current = similarity;
                setVoiceAccuracy(similarity);
              };

              const totalMs = Math.max(30_000, ((template?.duration_sec ?? 60) + 5) * 1000);

              _voiceStopFn = sr.listen(
                (mission.read_lang ?? 'ko') as 'ko' | 'en',
                (t) => _interimCb?.(t),
                (t) => _finalCb?.(t),
                totalMs,
                _currentTarget,
                (s) => _progressCb?.(s),
              );

            } else if (_voiceActive) {
              // 이미 실행 중 — 콜백만 현재 인스턴스로 갱신 (remount 대응)
              _interimCb = (interim: string) => {
                voiceTranscriptRef.current = interim;
                setVoiceTranscript(interim);
                const target = _currentTarget;
                if (target && interim) {
                  const sim = textSimilarity(target, interim);
                  const newScore = Math.max(voiceScoreRef.current, sim * 0.8 + 0.10 * 0.2);
                  voiceScoreRef.current    = Math.min(1, newScore);
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };
              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                const sim = target ? textSimilarity(target, final) : (final.trim() ? 0.3 : 0);
                voiceScoreRef.current      = sim;
                voiceAccuracyRef.current   = sim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(sim);
              };

            } else if (!sr.isSupported()) {
              // 브라우저 미지원 — 점수 0 (가짜 상승 없음)
              score = 0;
            }

            break;
          }

          case 'timing':
          case 'expression':
          default: {
            // fitness 장르: 실제 포즈 감지 시에만 점수 부여
            // 최소 10개 keypoint가 신뢰도 0.3 이상일 때만 "실제 검출"로 인정
            const hasRealLandmarks = landmarks.length >= 17 &&
              landmarks.filter(l => (l.score ?? l.visibility ?? 0) > 0.3).length >= 10;
            if (template && template.genre === 'fitness' && hasRealLandmarks && kneeAngleOut < 130) {
              const sqScore =
                kneeAngleOut < 90  ? 1.00 :
                kneeAngleOut < 110 ? 0.88 :
                kneeAngleOut < 130 ? 0.72 : 0.50;
              score = sqScore;
            } else {
              // 실제 검출 없음 → 점수 0
              score = 0;
            }
            break;
          }
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

      return {
        score, tag, currentMission: mission,
        voiceTranscript: voiceTranscriptRef.current,
        voiceAccuracy:   voiceAccuracyRef.current,
        squatCount: squatCountRef.current,
        squatPhase: squatPhaseOut,
        kneeAngle: kneeAngleOut,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appendFrameTag],
  );

  // ── resetVoice ────────────────────────────────────────────────────────────
  const resetVoice = useCallback(() => {
    // stop() — 명시적 중단 (다음 세션 시작 가능하도록)
    if (_voiceStopFn) { _voiceStopFn(); _voiceStopFn = null; }
    getGlobalSpeechRecognizer().stop();
    getGlobalSpeechRecognizer().resetForNextMission();

    // 모듈 레벨 플래그 초기화
    _voiceActive   = false;
    _currentTarget = '';
    _interimCb     = null;
    _finalCb       = null;
    _progressCb    = null;

    // 오디오 분석기 초기화
    if (_analyser) { _analyser.disconnect(); _analyser = null; }
    if (_audioCtx) { try { _audioCtx.close(); } catch {} _audioCtx = null; }

    // 컴포넌트 상태 초기화
    lastMissionSeqRef.current   = null;
    voiceScoreRef.current       = 0.10;
    voiceAccuracyRef.current    = 0;
    voiceTranscriptRef.current  = '';
    setVoiceTranscript('');
    setVoiceAccuracy(0);

    // 스쿼트 초기화
    squatCountRef.current   = 0;
    squatCountState.current = 0;
    squatPhaseRef.current   = 'unknown';
    lastKneeAngle.current   = 180;
    setSquatCount(0);
  }, []);

  return { judge, voiceTranscript, voiceAccuracy, squatCount, resetVoice };
}
