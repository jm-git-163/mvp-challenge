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
import { NoseSquatDetector }           from '../engine/missions/noseSquat';
import { HeadShoulderSquatDetector }   from '../engine/missions/headShoulderSquat';
import { HipMotionGate }               from '../engine/missions/hipMotionGate';
import { textSimilarity } from '../utils/speechUtils';
import { getRecognizer as getGlobalSpeechRecognizer } from '../utils/sttFactory';
import { wrapInterimCallback, wrapFinalCallback } from '../engine/composition/speechBridge';
import { pickScriptWithHistory } from '../engine/missions/scriptPrompterMission';
import { SCRIPT_POOLS_BY_THEME, pickSubPoolForText, getScriptText, getScriptTranslation, type ScriptPoolItem } from '../services/mockData';
import { similarityToTier, type JudgementTier } from '../utils/liveCaption';
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
    // FIX-INVITE-EXHAUSTIVE (2026-04-24): 싱글톤 스트림 우선. __cameraStream 이
    //   아직 세팅되기 전에도 (__permissionStream 가 먼저) 볼륨 측정 가능.
    const w = window as any;
    const stream = (w.__cameraStream ?? w.__permissionStream) as MediaStream | undefined;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') return;
    try { console.info('[perm-src] AudioContext+createMediaStreamSource from useJudgement.setupAudioAnalyser'); } catch {}
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
  if (!sr.isSupported()) {
    if (typeof console !== 'undefined') {
      console.warn('[prewarmSpeech] SpeechRecognition API 미지원 (iOS Safari 또는 비 Chrome 브라우저)');
    }
    return;
  }
  // 이미 listen() 이 실제로 실행 중이면(_voiceStopFn 존재) 재시작 금지.
  // FIX-Z11 (2026-04-22): 기존엔 _voiceActive=true 만 확인했으나,
  //   실패 경로에서도 이 플래그가 남을 수 있어 이후 재시도가 막히는 버그가 있었다.
  if (_voiceActive && _voiceStopFn) return;

  // FIX-INVITE-POPUP-FINAL (2026-04-24): 현재 세션 템플릿에 voice_read 미션이
  //   **없으면** SpeechRecognition 을 절대 시작하지 않는다. 이전엔 모든 챌린지
  //   (스쿼트·댄스 등) 진입 시에도 prewarmSpeech 가 sr.listen() 을 호출했고
  //   Chrome 이 "mic in use" 신호를 주면서 카카오 in-app / 일부 Chromium 에서
  //   두번째 권한 팝업을 띄우는 원인이 됐다. voice_read 미션이 없으면 Speech API
  //   를 건드릴 이유 자체가 없다.
  try {
    const tpl = (require('../store/sessionStore') as any).useSessionStore?.getState?.()?.activeTemplate;
    const missions = Array.isArray(tpl?.missions) ? tpl.missions : [];
    const hasVoiceRead = missions.some((m: any) => m?.type === 'voice_read');
    if (!hasVoiceRead) {
      if (typeof console !== 'undefined') {
        console.info('[prewarmSpeech] skipped — template has no voice_read missions');
      }
      return;
    }
  } catch { /* fall-through: if we can't inspect, be conservative and proceed */ }

  // FIX-F (2026-04-21): 모바일 크롬 대응 — user gesture 스택 안에서 바로 start() 호출.
  // FIX-Z11: listen() 이 내부 start() 실패해도 우리가 플래그를 미리 true 로 세워버리면
  //   judge() / 다음 gesture 재호출이 모두 no-op 이 되어 음성 인식이 "아예 안 되는"
  //   현상의 원인이 됨. 따라서 listen() 호출 성공 후에만 플래그 세운다.
  const bridgedInterim = wrapInterimCallback((t: string) => _interimCb?.(t));
  const bridgedFinal   = wrapFinalCallback((t: string) => _finalCb?.(t));

  try {
    const stopFn = sr.listen(
      'ko',
      bridgedInterim,
      bridgedFinal,
      120_000, // 2분 — judge() 가 미션 진입 시 충분
      _currentTarget,
      (s: number) => _progressCb?.(s),
    );
    _voiceStopFn = stopFn;
    _voiceActive = true;
  } catch (e) {
    _voiceActive = false;
    _voiceStopFn = null;
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
    squatDebug: {
      faceY: number;
      amplitude: number;
      visibility: number;
      velSign: -1 | 0 | 1;
      lastPivotType: 'top' | 'bottom' | 'none';
      landmarkCount: number;
      squatLmOk: boolean;
      faceOk: boolean;
      allowCloseMode: boolean;
      candidatePhase: 'up' | 'down' | 'unknown';
      candidateFrames: number;
      ready: boolean;
      // FIX-Z20 (2026-04-22): 녹화 10초 경과 && landmarks 비면 true.
      //   포즈 엔진이 사실상 죽은 상태(wasm 로드 성공했으나 detectForVideo 가
      //   결과 없음)를 UI 가 정직하게 표시하도록 플래그로 노출.
      poseTimeout: boolean;
      // TEAM-ACCURACY (2026-04-23): hip 진폭 게이트 진단.
      hipAmplitude: number;
      hipGateAllow: boolean;
      hipGateReason: string;
    };
  };
  voiceTranscript: string;
  voiceAccuracy: number;
  squatCount: number;
  squatMode: 'full-body' | 'near-mode' | 'idle';
  /** FIX-SCRIPT-POOL (2026-04-23): 현재 voice_read 미션에서 실제 선택된 대본 문자열.
   *  풀(배열) 입력 시 세션 시작 시 한 번만 선택된 값이 고정되며, 단일 string 일 땐 그대로.
   *  UI 는 mission.read_text 대신 이 값을 렌더링해야 사용자가 이번에 읽을 문장을 본다. */
  resolvedReadText: string;
  /** FIX-SCRIPT-I18N (2026-04-23 v4): English 풀 항목의 한글 번역. 없으면 빈 문자열. */
  resolvedReadTranslation: string;
  // FIX-Z25: 대본 판정 결과 (voice_read 미션 final transcript 기준).
  //   RecordingCamera.drawFrame 에서 drawJudgementToast 에 넘김.
  latestJudgement: { tier: JudgementTier; at: number } | null;
  // FIX-Z25: 방금 스쿼트 카운트가 증가한 시각 (performance.now()).
  //   +1 팝업 트리거용.
  lastSquatCountAt: number | null;
  // FIX-Z25: 마이크 권한 필요 배너 트리거 시각.
  micPermissionDeniedAt: number | null;
  resetVoice: () => void;
  /** Team SQUAT (2026-04-22): 캘리브레이션 컴포넌트에서 d0 주입. */
  injectSquatBaseline: (d0: number) => void;
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
  // FIX-Z25: nose-based 초단순 detector — PoseCalibration 없이 머리 하강-복귀만으로 카운트.
  //   두 로직(knee/close/nose) 중 가장 관대한 쪽이 이기는 max-count 정책.
  const noseSquatRef           = useRef(new NoseSquatDetector());
  // Team SQUAT (2026-04-22): research §4 추천안 HeadShoulderSquat — primary 근접촬영 detector.
  //   shoulder 평균 y − nose.y 차분 신호 + 3초 정적 캘리브레이션 + 첫 rep 자동 진폭 학습.
  const hssRef                 = useRef(new HeadShoulderSquatDetector());
  // TEAM-ACCURACY (2026-04-23): 가짜 카운트 차단 게이트.
  //   사용자 제보(앉아있는데 카운트 12 개) 대응 — 모든 near-mode rep 인정 직전에
  //   hip y 진폭을 검사한다. 실제 스쿼트가 아닌 머리 흔들림은 hip 이 정지 → 거부.
  const hipGateRef             = useRef(new HipMotionGate());
  // TEAM-ACCURACY (2026-04-23): hipGate 거부로 외부 카운트에 반영 못한 HSS rep 누적치.
  //   HSS 내부 count 는 매 rep 마다 +1 → 외부 squatCountRef 와 비교 시 게이트 통과한 만큼만
  //   가산해야 한다. 미반영 누적치를 빼서 "다음 rep 1 개" 만 통과시키도록.
  const hssRejectedCountRef    = useRef(0);
  const noseRejectedCountRef   = useRef(0);
  const closeRejectedCountRef  = useRef(0);
  const lastSquatCountAtRef    = useRef<number | null>(null);
  const latestJudgementRef     = useRef<{ tier: JudgementTier; at: number } | null>(null);
  const micDeniedAtRef         = useRef<number | null>(null);
  // FIX-N (2026-04-22): 스쿼트 감지 소스 트래킹.
  //   'full-body' = MediaPipe 무릎각도 기반(정밀). 점수 제한 없음.
  //   'near-mode' = 얼굴 Y 진동 프록시(근사). 점수 최대 70% 제한 → 정직한 UX.
  //   'idle'      = 아직 감지 안 됨.
  const squatSourceRef         = useRef<'full-body' | 'near-mode' | 'idle'>('idle');
  // FIX-Z20 (2026-04-22): 녹화 시작 시각 tracking (포즈 타임아웃 감지용).
  //   첫 judge() 호출 시점에 0 으로 설정되며, landmarks 가 10 초 이상 비면 poseTimeout=true.
  const recordingStartRef      = useRef<number | null>(null);

  // FIX-SCRIPT-POOL (2026-04-23): 세션 동안 미션별로 실제 선택된 read_text 를 저장.
  //   mission.read_text 가 배열이면 pickScriptWithHistory 로 한 번만 뽑아서 여기에
  //   고정 — 같은 미션이 재진입돼도 동일 문자열 유지 (seq 단위 캐시).
  const resolvedReadTextRef = useRef<string>('');
  const resolvedReadTranslationRef = useRef<string>('');
  const resolvedMissionKeyRef = useRef<string>('');
  const [resolvedReadText, setResolvedReadText] = useState<string>('');
  const [resolvedReadTranslation, setResolvedReadTranslation] = useState<string>('');

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
      // FIX-Z20: 첫 judge() 호출 시각 기록.
      if (recordingStartRef.current === null) recordingStartRef.current = now;
      const recordingElapsedMs = now - (recordingStartRef.current ?? now);
      const poseTimeout = recordingElapsedMs > 10_000 && landmarks.length === 0;
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
        // FIX-SCRIPT-POOL (2026-04-23): read_text 가 배열이면 풀 로테이션 선택.
        //   세션 내 동일 (templateId, missionSeq) 조합은 한 번만 뽑아 캐시 → 같은
        //   미션이 다시 트리거돼도 대본이 중간에 바뀌지 않음.
        let resolvedText = '';
        if (mission?.type === 'voice_read' && mission.read_text) {
          const rt = mission.read_text;
          const tmplId = template?.id ?? 'unknown';
          const missionKey = `${tmplId}::${mission.seq}`;
          // FIX-SCRIPT-POOL-PROD (2026-04-23 v2): 서브풀 우선 매칭 — news 템플릿이라도
          //   인사 미션에 마무리 멘트("시청 감사합니다") 같은 엉뚱한 문장이 뜨지 않도록
          //   원문 read_text 가 속하는 서브풀을 먼저 찾는다. 없으면 장르/테마 포괄 풀.
          // FIX-TONE-OVERRIDE (2026-04-23 v3): prod Supabase 에는 read_text 가 단일 캐주얼
          //   문자열("안녕 친구들!" 등)로 저장된 경우가 있음 → 키워드가 없어 pickSubPoolForText
          //   가 null, 또 기존 폴백은 raw 를 pool 에 prepend 해 캐주얼 문장이 그대로 노출.
          //   genre/theme 이 news/kids/fairy_tale/english/motivation 인 경우엔 raw 를 **버리고**
          //   톤 맞는 풀에서만 로테이션. 또한 mission.seq 로 서브세그먼트 추정:
          //   seq 1 → greeting/intro, 마지막 → closing/end, 중간 → report/middle.
          let pool: ScriptPoolItem[] | null = Array.isArray(rt) ? (rt as ScriptPoolItem[]) : null;
          if (!pool && typeof rt === 'string') {
            const genreKey = (template?.genre || '').toLowerCase();
            const themeKey = (template?.theme_id || '').toLowerCase();
            const slugHit  = (template?.id || '').toLowerCase();
            const isNews   = genreKey === 'news' || themeKey === 'news' || slugHit.includes('news-anchor');
            const isKids   = genreKey === 'kids' || themeKey === 'fairy_tale' || themeKey === 'kids' || slugHit.includes('storybook');
            const isEng    = genreKey === 'english' || themeKey === 'english' || slugHit.includes('english-speaking');
            const isMotiv  = themeKey === 'motivation' || slugHit.includes('motivation-speech');

            // 1) 강한 톤 오버라이드: 원문이 톤에 안 맞을 확률이 높음 → 원문 버림.
            if (isNews || isKids || isEng || isMotiv) {
              const totalMissions = template?.missions?.filter(m => m.type === 'voice_read').length ?? 0;
              const mySeq = mission?.seq ?? 0;
              const isFirst = mySeq <= 1;
              const isLast  = totalMissions > 0 && mySeq >= totalMissions;
              let subKey = '';
              if (isNews) {
                subKey = isFirst ? 'news_greeting' : isLast ? 'news_closing' : 'news_report';
              } else if (isKids) {
                subKey = isFirst ? 'storybook_intro' : isLast ? 'storybook_end' : 'storybook_middle';
              } else if (isEng) {
                subKey = 'english';
              } else if (isMotiv) {
                subKey = 'motivation';
              }
              const forced = SCRIPT_POOLS_BY_THEME[subKey];
              if (forced && forced.length > 0) pool = forced;
            }
            // 2) 원문 키워드로 서브풀 매칭 (약한 톤 — food/travel/unboxing 등).
            if (!pool) {
              const sub = pickSubPoolForText(rt);
              if (sub && sub.length > 1) pool = sub;
            }
            // 3) 최후 폴백 — theme/genre 전체 풀. 원문 포함(약한 톤 장르).
            if (!pool) {
              const key = themeKey || genreKey;
              const candidate = SCRIPT_POOLS_BY_THEME[key];
              if (candidate && candidate.length > 0) {
                const alreadyIn = candidate.some(it => getScriptText(it) === rt);
                pool = alreadyIn ? candidate : [rt as ScriptPoolItem, ...candidate];
              }
            }
          }
          let resolvedTranslation = '';
          if (pool && pool.length > 1) {
            let pickedItem: ScriptPoolItem;
            if (resolvedMissionKeyRef.current !== missionKey) {
              pickedItem = pickScriptWithHistory(pool, tmplId, String(mission.seq));
              resolvedMissionKeyRef.current = missionKey;
            } else {
              // 기존 resolved 가 있으면 그대로 재사용. 없으면 풀에서 다시 뽑음.
              if (resolvedReadTextRef.current) {
                const hit = pool.find(it => getScriptText(it) === resolvedReadTextRef.current);
                pickedItem = hit ?? pickScriptWithHistory(pool, tmplId, String(mission.seq));
              } else {
                pickedItem = pickScriptWithHistory(pool, tmplId, String(mission.seq));
              }
            }
            resolvedText = getScriptText(pickedItem);
            resolvedTranslation = getScriptTranslation(pickedItem);
          } else if (pool && pool.length === 1) {
            resolvedText = getScriptText(pool[0]);
            resolvedTranslation = getScriptTranslation(pool[0]);
            resolvedMissionKeyRef.current = missionKey;
          } else {
            resolvedText = Array.isArray(rt)
              ? (rt[0] ? getScriptText(rt[0] as ScriptPoolItem) : '')
              : String(rt);
            resolvedMissionKeyRef.current = missionKey;
          }
          resolvedReadTranslationRef.current = resolvedTranslation;
          setResolvedReadTranslation(resolvedTranslation);
        } else {
          resolvedMissionKeyRef.current = '';
          resolvedReadTranslationRef.current = '';
          setResolvedReadTranslation('');
        }
        resolvedReadTextRef.current = resolvedText;
        setResolvedReadText(resolvedText);

        if (mission?.type === 'voice_read' && resolvedText) {
          _currentTarget = resolvedText;
          sr.setTargetText(resolvedText);
          // FIX-Y11 (2026-04-22): 영어/한국어 자동 감지.
          //   read_text 의 ASCII 알파벳 비율 > 50% → 영어로 추정.
          //   동화/뉴스 리딩 미션 지원.
          const ascii = (resolvedText.match(/[a-zA-Z]/g) || []).length;
          const letters = (resolvedText.match(/[a-zA-Z가-힣]/g) || []).length;
          const lang: 'ko' | 'en' = letters > 0 && (ascii / letters) > 0.5 ? 'en' : 'ko';
          try { (sr as any).setLanguage?.(lang); } catch {}
        } else {
          _currentTarget = '';
          sr.setTargetText('');
          try { (sr as any).setLanguage?.('ko'); } catch {}
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
      // FIX-Z25: 이 프레임에서 count 가 늘었는지 추적용. 아래 블록들 지나고 변하면 timestamp.
      const preCount = squatCountRef.current;

      // TEAM-ACCURACY (2026-04-23): hip 진폭 게이트 매 프레임 갱신.
      //   near-mode (HSS/nose/close) 디텍터들이 머리 흔들림만으로 false count 를 만들지 않도록,
      //   카운트 증가 직전에 hipGate.update().allow 가 true 인지 확인한다.
      const hipGate = hipGateRef.current.update(landmarks, now);

      // 스쿼트 카운터 — MoveNet 추정 노이즈가 심하므로:
      //  (1) 신뢰도 게이트 상향 (0.25 → 0.50)
      //  (2) fullLeg(hip+knee+ankle)이 실제로 보일 때만 인정 (torso 폴백은 제거)
      //  (3) 동일 phase가 3프레임(≈300ms) 이상 연속돼야 전이 인정 (디바운스)
      //  (4) 첫 번째 확정 "up"을 본 뒤에만 카운터 무장 — 시작 시 down에서 바로 up으로 튀는 false positive 차단
      // FIX-W (2026-04-22): 가짜 카운트 근절.
      //   (1) hipKneeOnly 폴백 제거 — ratio 기반 추정이 머리/어깨 움직임만으로도 phase 뒤집혀 카운트됨.
      //   (2) fullLeg 신뢰도 0.40 → 0.55 (MoveNet 노이즈 기준으로 안전선).
      //   (3) close-detector 는 "full-body 가 절대 불가능한 경우에만" 작동하도록 게이트.
      //       → 얼굴이 잘 보이는데 무릎이 안 보이면: 근접 카운트도 0.
      //       (유저가 무릎을 안 보이게 촬영하면 정식 카운트 불가 — StanceGuide 로 안내됨)
      const conf = (i: number) =>
        (landmarks[i]?.score ?? landmarks[i]?.visibility ?? 0);
      // FIX-Z5 (2026-04-22): 실사용 기준으로 완화.
      //   이전 Y4 에서 0.55 로 올렸더니 실기기(카메라 2m 거리)에서 MoveNet 무릎
      //   신뢰도가 거의 0.45~0.55 주변 → 거의 squatLmOk 를 못 얻어 카운트 0.
      //   0.40 로 되돌리되, 가짜 카운트는 phase 디바운스(300ms)·속도·각도 복합
      //   조건으로 억제 (detectSquat 내부 로직).
      const fullLeg = (h: number, k: number, a: number) =>
        conf(h) > 0.40 && conf(k) > 0.40 && conf(a) > 0.40;
      const squatLmOk = landmarks.length >= 17 && (
        fullLeg(11, 13, 15) || fullLeg(12, 14, 16)
      );
      // FIX-Z5: close-detector 게이트 완화.
      //   얼굴이 보이고 full-body 가 안 잡히면 항상 근접 모드 허용.
      //   "다리가 부분적으로 보이면 금지" 제약 제거 — 실제로는 무릎이 살짝
      //   보이는 근접 촬영이 가장 흔한 케이스인데 기존엔 이걸 다 막아버림.
      const faceOk = conf(0) > 0.35 || conf(1) > 0.35 || conf(2) > 0.35;
      const allowCloseMode = faceOk && !squatLmOk;
      let lastCloseState: ReturnType<typeof closeSquatRef.current.update> | null = null;
      if (template && template.genre === 'fitness' && allowCloseMode) {
        const closeState = closeSquatRef.current.update(landmarks);
        lastCloseState = closeState;
        // TEAM-ACCURACY (2026-04-23): close-detector 도 hip 진폭 게이트 통과 필수.
        //   close 는 absolute count 만 반환하므로 매 프레임 변화를 reject ref 와 비교.
        if (closeState.count > squatCountRef.current + closeRejectedCountRef.current) {
          // 새 rep 1 개가 detector 내부에서 인정됐다.
          if (hipGate.allow) {
            const effective = closeState.count - closeRejectedCountRef.current;
            squatCountRef.current = effective;
            squatCountState.current = effective;
            setSquatCount(effective);
            squatPhaseOut = closeState.phase;
            // TEAM-ACCURACY v2 (2026-04-23): 게이트 히스토리 소진 — 다음 rep 은 새 hip 움직임 필요.
            hipGateRef.current.consume();
            // FIX-N: 이 증분은 근접(얼굴) 디텍터 소스. full-body 가 아직 안 잡혔으면 near-mode.
            if (squatSourceRef.current !== 'full-body') {
              squatSourceRef.current = 'near-mode';
              setSquatMode('near-mode');
            }
          } else {
            closeRejectedCountRef.current += 1;
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

        // 디바운스: 같은 phase가 연속 프레임으로 들어오는지 추적.
        // FIX-Z17 (2026-04-22): 3 → 2 프레임 완화.
        //   MoveNet 실기기 fps ~10. 3 프레임 = 300ms = 사용자가 이미 다음 phase 로
        //   넘어가는 경우 있음 → 카운트 누락. 2 프레임(~200ms) 이면 여전히 단발
        //   스파이크는 거절되면서 일반적 스쿼트 템포(1rep ≥1s) 에 여유 있음.
        const DEBOUNCE_FRAMES = 2;
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

          // TEAM-ACCURACY (2026-04-23): 사용자 "스쿼트 카운트 잘못 셈" 피드백 대응.
          //   녹화 시작 직후 사용자가 이미 앉아있거나 자세 찾는 중 순간 'up' 이 튀면
          //   1-2 프레임 디바운스만으론 무장되어 첫 움직임이 오카운트됨.
          //   무장은 4 프레임 연속 'up' 필요 — 전이(up↔down) 는 기존 2 프레임 유지.
          const ARM_FRAMES = 4;
          if (!squatReadyRef.current && stable === 'up' && squatCandidateFrames.current >= ARM_FRAMES) {
            squatReadyRef.current = true;
            squatPhaseRef.current = 'up';
            squatPhaseOut = 'up';
          } else if (squatReadyRef.current) {
            if (squatPhaseRef.current === 'up' && stable === 'down') {
              squatPhaseRef.current = 'down';
              squatPhaseOut = 'down';
            } else if (squatPhaseRef.current === 'down' && stable === 'up') {
              // 진짜 1 rep 완료 — 단, hip 진폭 게이트 통과 필수.
              // TEAM-ACCURACY v2 (2026-04-23): 사용자 재제보 "앉아 있었는데 3 카운트".
              //   풀바디 경로에도 게이트 적용. 의자에 앉으면 무릎각이 자연스레 90도 →
              //   detectSquat 가 'down' 으로 판정, 미세한 움직임으로 'up' 토글되면 누적 카운트.
              //   hip 이 실제로 움직이지 않았다면 rep 으로 인정 안 함.
              if (hipGate.allow) {
                squatCountRef.current += 1;
                squatPhaseRef.current = 'up';
                squatPhaseOut = 'up';
                if (squatCountRef.current !== squatCountState.current) {
                  squatCountState.current = squatCountRef.current;
                  setSquatCount(squatCountRef.current);
                }
                hipGateRef.current.consume();
                // FIX-N: full-body 실제 무릎각도 기반 rep 완료 → 정밀 모드 확정.
                if (squatSourceRef.current !== 'full-body') {
                  squatSourceRef.current = 'full-body';
                  setSquatMode('full-body');
                }
              } else {
                // 게이트 거부 — phase 만 진행(다음 rep 기회 열어둠), 카운트 증가 없음.
                squatPhaseRef.current = 'up';
                squatPhaseOut = 'up';
              }
            }
          }
        }
      }

      // Team SQUAT (2026-04-22): HeadShoulderSquat primary detector.
      //   research §4. shoulder.y − nose.y 신호 + 3초 캘리브레이션 + 첫 rep 진폭 학습.
      //   full-body(knee) 로직이 이미 카운트를 올렸다면 max-count 로 병합.
      //   nose-only detector (noseSquatRef) 는 HSS 가 아직 calibrated 전인 "완전 스톨" 안전망.
      if (template && template.genre === 'fitness') {
        const hssRes = hssRef.current.update(landmarks, now);
        // TEAM-ACCURACY (2026-04-23): HSS 가 rep 을 인정하더라도 hip 이 실제로 움직였어야 한다.
        //   사용자 제보: 의자에 앉아있는 동안 카운트 12. HSS 는 머리/어깨 신호만 보므로
        //   슬럼프·고개 끄덕임을 스쿼트로 오인식. hipGate.allow=false 면 거부 + reject 누적.
        if (hssRes.justCounted) {
          if (hipGate.allow) {
            // HSS 내부 count − 누적 reject = 외부에 반영해야 할 누적 카운트.
            const effective = hssRes.count - hssRejectedCountRef.current;
            if (effective > squatCountRef.current) {
              squatCountRef.current = effective;
              squatCountState.current = effective;
              setSquatCount(effective);
              squatPhaseOut = hssRes.phase;
              lastSquatCountAtRef.current = now;
              hipGateRef.current.consume();
              if (squatSourceRef.current !== 'full-body') {
                squatSourceRef.current = 'near-mode';
                setSquatMode('near-mode');
              }
            }
          } else {
            // 거부: 다음 rep 부터 게이트가 풀려도 누적 가짜 카운트가 한꺼번에 들어오지 않도록.
            hssRejectedCountRef.current += 1;
          }
        }

        // HSS 가 여전히 캘리브레이션 중이고, 다른 detector 도 3초 이상 스톨이면
        // 최후의 안전망으로 기존 nose-only detector 도 굴린다.
        if (!hssRef.current.isCalibrated()) {
          const stalled = (noseSquatRef.current.msSinceLastChange(now) > 3_000) || squatCountRef.current === 0;
          if (stalled) {
            const noseRes = noseSquatRef.current.update(landmarks, now);
            // TEAM-ACCURACY (2026-04-23): nose-only 디텍터도 hip 진폭 게이트 통과 필수.
            if (noseRes.justCounted) {
              if (hipGate.allow) {
                const effective = noseRes.count - noseRejectedCountRef.current;
                if (effective > squatCountRef.current) {
                  squatCountRef.current = effective;
                  squatCountState.current = effective;
                  setSquatCount(effective);
                  squatPhaseOut = noseRes.phase;
                  lastSquatCountAtRef.current = now;
                  hipGateRef.current.consume();
                  if (squatSourceRef.current !== 'full-body') {
                    squatSourceRef.current = 'near-mode';
                    setSquatMode('near-mode');
                  }
                }
              } else {
                noseRejectedCountRef.current += 1;
              }
            }
          } else {
            noseSquatRef.current.update(landmarks, now);
          }
        }
      }

      // FIX-Z25: 이 프레임에서 count 가 늘었다면 +1 팝업 타임스탬프 기록.
      if (squatCountRef.current > preCount) {
        lastSquatCountAtRef.current = now;
      }

      // ── Score calculation ───────────────────────────────────────────────
      let score = 0;

      if (mission) {
        const missionDur  = Math.max(1, mission.end_ms - mission.start_ms);
        const missionProg = Math.min(1, Math.max(0, (elapsedMs - mission.start_ms) / missionDur));

        switch (mission.type) {
          case 'gesture': {
            // TEAM-HONESTY (2026-04-23): 가짜 PERFECT/GOOD 차단.
            //   기존 `raw * 1.12 + 0.03` 가산식은 raw 가 0.7 이면 0.81 → PERFECT,
            //   raw 가 0.45 라도 +0.03 floor 로 GOOD threshold 근접 → 사용자 보고와 일치.
            //   이제는 detectGesture 가 반환한 진짜 신뢰도만 그대로 사용.
            //   또 키포인트 8개 이상 + 평균 신뢰도 0.30 이상이라는 더 엄격한 게이트.
            const visiblePts = landmarks.filter(l => (l.score ?? l.visibility ?? 0) > 0.30);
            const hasRealLandmarks = landmarks.length >= 17 && visiblePts.length >= 8;
            if (hasRealLandmarks && mission.gesture_id) {
              score = Math.min(1, Math.max(0, detectGesture(landmarks, mission.gesture_id)));
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
                // FIX-Z25: 권한 거부 시 speechUtils 가 '[마이크 권한 필요 …]' 을
                //   interim 콜백으로 보냄 — 이를 감지해 온캔버스 빨간 배너 트리거.
                if (interim && interim.includes('마이크 권한 필요')) {
                  micDeniedAtRef.current = performance.now();
                }
                voiceTranscriptRef.current = interim;
                setVoiceTranscript(interim);
                const target = _currentTarget;
                if (target && interim) {
                  const sim = textSimilarity(target, interim);
                  // Forgiving scoring: Web Speech often mis-transcribes 1-2 jamo.
                  // Lift by ~15% then clamp; interim keeps monotonic max.
                  // TEAM-HONESTY (2026-04-23): interim 단계 PERFECT 가짜 발화 금지.
                  //   기존 *1.15 lift 는 sim 0.70 → 0.805 → PERFECT (≥0.80 임계) 트리거.
                  //   interim 은 부분 transcript 라 신뢰도가 낮으므로 lift 금지 +
                  //   PERFECT 임계(0.80) 직전인 0.79 까지만 허용. 진짜 PERFECT 는 final 에서.
                  //   최소 글자 수 게이트도 추가 — 1~2 음절짜리 짧은 interim 은 점수 X.
                  if (interim.trim().length < 3) return;
                  const newScore = Math.max(voiceScoreRef.current, Math.min(0.79, sim));
                  voiceScoreRef.current    = newScore;
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };

              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                // FIX-P: 목표 텍스트 없으면 점수 0 (무작위 발화에 30% 부여 금지).
                const rawSim = target ? textSimilarity(target, final) : 0;
                // TEAM-HONESTY (2026-04-23): final lift 1.15 → 1.08.
                //   1.15 는 rawSim 0.70 → 0.805 → 가짜 PERFECT. 1.08 는 0.74 → 0.80
                //   으로 진짜 잘 읽었을 때만 PERFECT. STT 자모 오차 1~2 음절은 여전히 보정.
                const lifted = target ? Math.min(1, rawSim * 1.08) : 0;
                voiceScoreRef.current      = lifted;
                voiceAccuracyRef.current   = rawSim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(rawSim);
                // FIX-Z25: 발화 단위 판정 — Perfect(≥0.90)/Good(≥0.70)/So-so(≥0.50)/Miss.
                //   rawSim (원본 유사도) 기준 — lifted 1.15 는 점수용, 판정은 정직하게.
                if (target && final.trim().length > 0) {
                  latestJudgementRef.current = {
                    tier: similarityToTier(rawSim),
                    at: performance.now(),
                  };
                }
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
                // FIX-Z25: 권한 거부 시 speechUtils 가 '[마이크 권한 필요 …]' 을
                //   interim 콜백으로 보냄 — 이를 감지해 온캔버스 빨간 배너 트리거.
                if (interim && interim.includes('마이크 권한 필요')) {
                  micDeniedAtRef.current = performance.now();
                }
                voiceTranscriptRef.current = interim;
                setVoiceTranscript(interim);
                const target = _currentTarget;
                if (target && interim) {
                  const sim = textSimilarity(target, interim);
                  // TEAM-HONESTY (2026-04-23): interim 단계 PERFECT 가짜 발화 금지.
                  //   기존 *1.15 lift 는 sim 0.70 → 0.805 → PERFECT (≥0.80 임계) 트리거.
                  //   interim 은 부분 transcript 라 신뢰도가 낮으므로 lift 금지 +
                  //   PERFECT 임계(0.80) 직전인 0.79 까지만 허용. 진짜 PERFECT 는 final 에서.
                  //   최소 글자 수 게이트도 추가 — 1~2 음절짜리 짧은 interim 은 점수 X.
                  if (interim.trim().length < 3) return;
                  const newScore = Math.max(voiceScoreRef.current, Math.min(0.79, sim));
                  voiceScoreRef.current    = newScore;
                  voiceAccuracyRef.current = sim;
                  setVoiceAccuracy(sim);
                }
              };
              _finalCb = (final: string) => {
                _voiceActive = false;
                const target = _currentTarget;
                // FIX-P: 목표 텍스트 없으면 점수 0 (무작위 발화에 30% 부여 금지).
                const rawSim = target ? textSimilarity(target, final) : 0;
                // TEAM-HONESTY (2026-04-23): final lift 1.15 → 1.08 (위 분기와 동일 사유).
                const lifted = target ? Math.min(1, rawSim * 1.08) : 0;
                voiceScoreRef.current      = lifted;
                voiceAccuracyRef.current   = rawSim;
                voiceTranscriptRef.current = final;
                setVoiceTranscript(final);
                setVoiceAccuracy(rawSim);
                if (target && final.trim().length > 0) {
                  latestJudgementRef.current = {
                    tier: similarityToTier(rawSim),
                    at: performance.now(),
                  };
                }
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
            // FIX-Y4 (2026-04-22): fitness 폴백 점수를 **squatLmOk (실제 무릎 visible)** 로 게이트.
            //   기존엔 hasRealLandmarks(8 keypoints @0.25) 만 통과하면 kneeAngleOut 으로 점수 → 상체 랜드마크
            //   만으로도 "perfect" 가 떠버림. 이제는 full-body 검출이 성공했을 때만 점수 부여.
            if (template && template.genre === 'fitness' && squatLmOk && kneeAngleOut < 140) {
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
        squatDebug: {
          faceY: lastCloseState?.faceY ?? 0,
          amplitude: lastCloseState?.amplitude ?? 0,
          visibility: lastCloseState?.visibility ?? 0,
          velSign: lastCloseState?.velSign ?? 0,
          lastPivotType: lastCloseState?.lastPivotType ?? 'none',
          landmarkCount: landmarks.length,
          squatLmOk,
          faceOk,
          allowCloseMode,
          candidatePhase: squatCandidatePhaseRef.current,
          candidateFrames: squatCandidateFrames.current,
          ready: squatReadyRef.current,
          poseTimeout,
          // TEAM-ACCURACY (2026-04-23): hip 진폭 게이트 디버그 — UI 가
          //   "왜 카운트가 안 되는지" 정직하게 표시할 수 있도록 노출.
          hipAmplitude: hipGate.amplitude,
          hipGateAllow: hipGate.allow,
          hipGateReason: hipGate.reason,
        },
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
    try { noseSquatRef.current?.reset(); } catch {}
    try { hssRef.current?.reset(); } catch {}
    try { hipGateRef.current?.reset(); } catch {}
    hssRejectedCountRef.current = 0;
    noseRejectedCountRef.current = 0;
    closeRejectedCountRef.current = 0;
    lastSquatCountAtRef.current = null;
    latestJudgementRef.current  = null;
    micDeniedAtRef.current      = null;

    // 오디오 분석기 초기화
    if (_analyser) { _analyser.disconnect(); _analyser = null; }
    if (_audioCtx) { try { _audioCtx.close(); } catch {} _audioCtx = null; }

    // 컴포넌트 상태 초기화
    lastMissionSeqRef.current   = null;
    voiceScoreRef.current       = 0; // TEAM-HONESTY (2026-04-23): 가짜 10% 시작점 제거
    voiceAccuracyRef.current    = 0;
    voiceTranscriptRef.current  = '';
    setVoiceTranscript('');
    setVoiceAccuracy(0);
    // FIX-SCRIPT-POOL (2026-04-23): 다음 세션에서 다시 풀 로테이션 돌도록 초기화.
    resolvedReadTextRef.current  = '';
    resolvedReadTranslationRef.current = '';
    resolvedMissionKeyRef.current = '';
    setResolvedReadText('');
    setResolvedReadTranslation('');

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
    // FIX-Z20: 다음 녹화용으로 타임아웃 타이머 리셋.
    recordingStartRef.current = null;
    setSquatCount(0);
    setSquatMode('idle');
  }, []);

  return {
    judge,
    voiceTranscript,
    voiceAccuracy,
    squatCount,
    squatMode,
    resolvedReadText,
    resolvedReadTranslation,
    latestJudgement: latestJudgementRef.current,
    lastSquatCountAt: lastSquatCountAtRef.current,
    micPermissionDeniedAt: micDeniedAtRef.current,
    resetVoice,
    injectSquatBaseline: (d0: number) => {
      try { hssRef.current?.injectBaseline(d0); } catch {}
    },
  };
}
