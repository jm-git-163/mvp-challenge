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
import { createAngleSmoother }          from '../engine/missions/angleSmoother';
import { CloseProximitySquatDetector } from '../engine/missions/closeProximitySquat';
import { textSimilarity } from '../utils/speechUtils';
import { getRecognizer as getGlobalSpeechRecognizer } from '../utils/sttFactory';
import { wrapInterimCallback, wrapFinalCallback } from '../engine/composition/speechBridge';
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
 * Previously this briefly started/stopped SpeechRecognition to prewarm
 * the permission dialog. That start→stop→start cycle actually TRIGGERS
 * a second permission popup in Chrome — exactly what we wanted to avoid.
 * Now it's a no-op: the real voice_read mission starts recognition once
 * and keeps it running continuously across missions.
 */
export function prewarmSpeech(): void {
  const sr = getGlobalSpeechRecognizer();
  if (!sr.isSupported()) return;
  if (_voiceActive) return;

  // FIX-F (2026-04-21): 모바일 크롬 대응.
  //   모바일 Chrome 은 webkitSpeechRecognition.start() 가 "사용자 제스처"
  //   스택 안에서 호출되지 않으면 NotAllowedError / 무반응.
  //   기존 구조: 녹화 버튼 클릭 → state=recording → useEffect → judge() → sr.listen()
  //   useEffect 여러 틱 뒤에 실행되므로 모바일이 제스처 타임아웃 → 실패.
  //   해결: 녹화 버튼 onPress 안에서 prewarmSpeech() 즉시 호출하여
  //   제스처 스택 안에서 listen() 시작. judge() 는 _voiceActive=true 감지하고
  //   start 스킵 (기존 else-if 분기 그대로 사용), 콜백만 교체.
  _voiceActive = true;

  const bridgedInterim = wrapInterimCallback((t: string) => _interimCb?.(t));
  const bridgedFinal   = wrapFinalCallback((t: string) => _finalCb?.(t));

  try {
    _voiceStopFn = sr.listen(
      'ko',
      bridgedInterim,
      bridgedFinal,
      120_000, // 2분 — judge() 가 미션 진입 시 충분
      _currentTarget,
      (s: number) => _progressCb?.(s),
    );
  } catch (e) {
    _voiceActive = false;
    if (typeof console !== 'undefined') console.warn('[prewarmSpeech] listen failed:', e);
  }
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
    squatMode: 'full-body' | 'near-mode' | 'idle';
  };
  voiceTranscript: string;
  voiceAccuracy: number;
  squatCount: number;
  squatMode: 'full-body' | 'near-mode' | 'idle';
  resetVoice: () => void;
} {
  const { activeTemplate, appendFrameTag } = useSessionStore();

  // ── Stable refs ────────────────────────────────────────────────────────────
  const lastAppendRef     = useRef(0);
  const lastMissionSeqRef = useRef<number | null>(null);
  const voiceScoreRef     = useRef(0);  // FIX-P: 시작 0 점 (가짜 10% 제거)
  const voiceTranscriptRef = useRef('');
  const voiceAccuracyRef  = useRef(0);

  // Squat counter — with phase-stability debouncing to reject MoveNet estimate noise
  const squatPhaseRef          = useRef<'up' | 'down' | 'unknown'>('unknown');
  const squatCandidatePhaseRef = useRef<'up' | 'down' | 'unknown'>('unknown');
  const squatCandidateFrames   = useRef(0);
  const squatReadyRef          = useRef(false); // arm only after first real "up" seen
  const squatCountRef          = useRef(0);
  const squatCountState        = useRef(0);
  const lastKneeAngle          = useRef(180);
  // Session-4 N: MoveNet 각도 지터 억제용 스무더 (한 프레임 55° 이상 점프 reject + EMA)
  const kneeSmootherRef        = useRef(createAngleSmoother({
    smoothing: 'ema', emaAlpha: 0.35, maxAnglePerFrame: 55,
  }));
  // FIX-J: 근접 촬영 대응 — 무릎이 안 보여도 얼굴 Y 진동으로 스쿼트 카운트.
  const closeSquatRef          = useRef(new CloseProximitySquatDetector());
  // FIX-N (2026-04-22): 스쿼트 감지 소스 트래킹.
  //   'full-body' = MediaPipe 무릎각도 기반(정밀). 점수 제한 없음.
  //   'near-mode' = 얼굴 Y 진동 프록시(근사). 점수 최대 70% 제한 → 정직한 UX.
  //   'idle'      = 아직 감지 안 됨.
  const squatSourceRef         = useRef<'full-body' | 'near-mode' | 'idle'>('idle');

  // UI State
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAccuracy,   setVoiceAccuracy]   = useState(0);
  const [squatCount, setSquatCount]           = useState(0);
  const [squatMode, setSquatMode]             = useState<'full-body' | 'near-mode' | 'idle'>('idle');

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
        voiceScoreRef.current      = 0;
        voiceAccuracyRef.current   = 0;
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        setVoiceAccuracy(0);
      }

      // ── Squat counter ───────────────────────────────────────────────────
      let squatPhaseOut: 'up' | 'down' | 'unknown' = squatPhaseRef.current;
      let kneeAngleOut = lastKneeAngle.current;

      // 스쿼트 카운터 — MoveNet 추정 노이즈가 심하므로:
      //  (1) 신뢰도 게이트 상향 (0.25 → 0.50)
      //  (2) fullLeg(hip+knee+ankle)이 실제로 보일 때만 인정 (torso 폴백은 제거)
      //  (3) 동일 phase가 3프레임(≈300ms) 이상 연속돼야 전이 인정 (디바운스)
      //  (4) 첫 번째 확정 "up"을 본 뒤에만 카운터 무장 — 시작 시 down에서 바로 up으로 튀는 false positive 차단
      const conf = (i: number) =>
        (landmarks[i]?.score ?? landmarks[i]?.visibility ?? 0);
      const fullLeg = (h: number, k: number, a: number) =>
        conf(h) > 0.40 && conf(k) > 0.40 && conf(a) > 0.40;
      // Fallback gate: shoulder+hip+knee visible is enough for the ratio-based
      // depth proxy in detectSquat() — ankles commonly crop on phone selfies.
      const hipKneeOnly = (s: number, h: number, k: number) =>
        conf(s) > 0.40 && conf(h) > 0.40 && conf(k) > 0.40;
      const squatLmOk = landmarks.length >= 17 && (
        fullLeg(11, 13, 15) || fullLeg(12, 14, 16) ||
        hipKneeOnly(5, 11, 13) || hipKneeOnly(6, 12, 14)
      );
      // FIX-J: fitness 장르에선 근접 디텍터를 항상 병렬로 돌림.
      //   무릎이 안 보일 때 (squatLmOk=false) 얼굴 Y 진동이 유일한 신호.
      //   primary 와 동시에 돌아도 Math.max 로 합치므로 이중 카운트 없음.
      if (template && template.genre === 'fitness') {
        const closeState = closeSquatRef.current.update(landmarks);
        if (closeState.count > squatCountRef.current) {
          squatCountRef.current = closeState.count;
          squatCountState.current = closeState.count;
          setSquatCount(closeState.count);
          squatPhaseOut = closeState.phase;
          // FIX-N: 이 증분은 근접(얼굴) 디텍터 소스. full-body 가 아직 안 잡혔으면 near-mode.
          if (squatSourceRef.current !== 'full-body') {
            squatSourceRef.current = 'near-mode';
            setSquatMode('near-mode');
          }
        }
      }
      if (template && template.genre === 'fitness' && squatLmOk) {
        const sq = detectSquat(landmarks, 0.40);
        // Session-4 N: 각도 스무딩 + 스파이크 reject. reject 시 이전 phase 유지
        const smoothed = kneeSmootherRef.current.push(sq.kneeAngle);
        let phaseIn: 'up' | 'down' | 'unknown' = sq.phase;
        if (smoothed === null) {
          phaseIn = 'unknown';                 // 아웃라이어 프레임 → debounce 리셋 유도
        } else {
          kneeAngleOut = smoothed;
          lastKneeAngle.current = smoothed;
          // 스무딩된 각도로 phase 재유도 (detectSquat 와 동일 임계)
          phaseIn = smoothed < 115 ? 'down' : smoothed > 150 ? 'up' : sq.phase;
        }

        // 디바운스: 같은 phase가 연속 프레임으로 들어오는지 추적
        const DEBOUNCE_FRAMES = 3;
        const sqPhase = phaseIn;
        if (sqPhase === 'unknown') {
          squatCandidateFrames.current = 0;
          squatCandidatePhaseRef.current = 'unknown';
        } else if (sqPhase === squatCandidatePhaseRef.current) {
          squatCandidateFrames.current += 1;
        } else {
          squatCandidatePhaseRef.current = sqPhase;
          squatCandidateFrames.current = 1;
        }

        // 확정된 phase 전이만 반영
        if (squatCandidateFrames.current >= DEBOUNCE_FRAMES) {
          const stable = squatCandidatePhaseRef.current;

          // 무장: 처음 "up"을 확정한 순간부터 카운트 허용
          if (!squatReadyRef.current && stable === 'up') {
            squatReadyRef.current = true;
            squatPhaseRef.current = 'up';
            squatPhaseOut = 'up';
          } else if (squatReadyRef.current) {
            if (squatPhaseRef.current === 'up' && stable === 'down') {
              squatPhaseRef.current = 'down';
              squatPhaseOut = 'down';
            } else if (squatPhaseRef.current === 'down' && stable === 'up') {
              // 진짜 1 rep 완료
              squatCountRef.current += 1;
              squatPhaseRef.current = 'up';
              squatPhaseOut = 'up';
              if (squatCountRef.current !== squatCountState.current) {
                squatCountState.current = squatCountRef.current;
                setSquatCount(squatCountRef.current);
              }
              // FIX-N: full-body 실제 무릎각도 기반 rep 완료 → 정밀 모드 확정.
              if (squatSourceRef.current !== 'full-body') {
                squatSourceRef.current = 'full-body';
                setSquatMode('full-body');
              }
            }
          }
        }
      }

      // ── Score calculation ───────────────────────────────────────────────
      let score = 0;

      if (mission) {
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            // More forgiving: upper-body gestures only need 6+ keypoints (face/shoulders/arms)
            // since most gestures in this app are hands_up/v_sign/heart (no legs needed).
            const hasRealLandmarks = landmarks.length >= 17 &&
              landmarks.filter(l => (l.score ?? l.visibility ?? 0) > 0.25).length >= 6;
            if (hasRealLandmarks && mission.gesture_id) {
              const raw = detectGesture(landmarks, mission.gesture_id);
              // Lift slightly to reward partial matches while user settles into pose
              score = Math.min(1, raw * 1.12 + 0.03);
            } else {
              score = 0;
            }
            break;
          }

          case 'voice_read': {
            score = voiceScoreRef.current;

            // Web Audio 볼륨: 점수에는 영향 없음, "발화 중" 감지 UI용
            setupAudioAnalyser();

            // FIX-P (2026-04-22): 볼륨 기반 부분점수 제거.
            //   CLAUDE.md §3 FORBIDDEN: 가짜 인식·점수 금지.
            //   "마이크가 시끄러우면 점수 상승" 은 무엇을 말했는지와 무관 → 가짜.
            //   SR 이 실패하면 점수 0 을 유지하고, 그 사실을 UI 에 정직하게 표시.

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
                  // Forgiving scoring: Web Speech often mis-transcribes 1-2 jamo.
                  // Lift by ~15% then clamp; interim keeps monotonic max.
                  // FIX-P: +0.05 floor 제거. 유사도 0 이면 점수 0 유지.
                  //   15% 상향(*1.15) 은 STT 자모 오차에 대한 완화책으로 유지.
                  const lifted = Math.min(1, sim * 1.15);
                  const newScore = Math.max(voiceScoreRef.current, lifted);
                  voiceScoreRef.current    = Math.min(1, newScore);
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };

              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                // FIX-P: 목표 텍스트 없으면 점수 0 (무작위 발화에 30% 부여 금지).
                const rawSim = target ? textSimilarity(target, final) : 0;
                // Forgiving final score — users who clearly said the line
                // shouldn't be punished for STT jamo quirks.
                const lifted = target ? Math.min(1, rawSim * 1.15) : 0;
                voiceScoreRef.current      = lifted;
                voiceAccuracyRef.current   = rawSim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(rawSim);
              };

              _progressCb = (similarity: number) => {
                voiceAccuracyRef.current = similarity;
                setVoiceAccuracy(similarity);
              };

              const totalMs = Math.max(30_000, ((template?.duration_sec ?? 60) + 5) * 1000);

              // Focused Session-4 Candidate L: liveState 브릿지로 감싸 subtitle_track 레이어에 전달.
              const bridgedInterim = wrapInterimCallback((t) => _interimCb?.(t));
              const bridgedFinal   = wrapFinalCallback((t) => _finalCb?.(t));
              _voiceStopFn = sr.listen(
                (mission.read_lang ?? 'ko') as 'ko' | 'en',
                bridgedInterim,
                bridgedFinal,
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
                  // FIX-P: +0.05 floor 제거. 유사도 0 이면 점수 0 유지.
                  //   15% 상향(*1.15) 은 STT 자모 오차에 대한 완화책으로 유지.
                  const lifted = Math.min(1, sim * 1.15);
                  const newScore = Math.max(voiceScoreRef.current, lifted);
                  voiceScoreRef.current    = Math.min(1, newScore);
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };
              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                // FIX-P: 목표 텍스트 없으면 점수 0 (무작위 발화에 30% 부여 금지).
                const rawSim = target ? textSimilarity(target, final) : 0;
                const lifted = target ? Math.min(1, rawSim * 1.15) : 0;
                voiceScoreRef.current      = lifted;
                voiceAccuracyRef.current   = rawSim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(rawSim);
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
            // fitness 장르: lower-body-only framing is common on phone selfies;
            // accept 8+ keypoints at 0.25 (was 10 at 0.3) — compatible with detectSquat's fallback.
            const hasRealLandmarks = landmarks.length >= 17 &&
              landmarks.filter(l => (l.score ?? l.visibility ?? 0) > 0.25).length >= 8;
            if (template && template.genre === 'fitness' && hasRealLandmarks && kneeAngleOut < 140) {
              const sqScore =
                kneeAngleOut < 95  ? 1.00 :
                kneeAngleOut < 115 ? 0.85 :
                kneeAngleOut < 135 ? 0.65 : 0.45;
              score = sqScore;
            } else if (template && template.genre === 'fitness' && squatSourceRef.current === 'near-mode' && squatCountRef.current > 0) {
              // FIX-N: 근접 모드 — 실제 무릎각도 얻을 수 없지만 얼굴 Y 진동이 실제 신호.
              //   가짜 점수 아님: 1 rep 당 10% 가산, 기본 30% 에서 시작, **최대 70% 제한**.
              //   정밀 모드(full-body)로 전환되면 자동으로 위 분기가 100% 까지 올려줌.
              const reps = squatCountRef.current;
              score = Math.min(0.70, 0.30 + reps * 0.10);
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
        squatMode: squatSourceRef.current,
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
    // FIX-J: 근접 스쿼트 디텍터도 함께 초기화 (다음 세션용)
    try { closeSquatRef.current?.reset(); } catch {}

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
    squatCountRef.current          = 0;
    squatCountState.current        = 0;
    squatPhaseRef.current          = 'unknown';
    squatCandidatePhaseRef.current = 'unknown';
    squatCandidateFrames.current   = 0;
    squatReadyRef.current          = false;
    lastKneeAngle.current   = 180;
    kneeSmootherRef.current.reset();
    squatSourceRef.current = 'idle';
    setSquatCount(0);
    setSquatMode('idle');
  }, []);

  return { judge, voiceTranscript, voiceAccuracy, squatCount, squatMode, resetVoice };
}
