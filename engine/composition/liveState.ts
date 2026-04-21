/**
 * engine/composition/liveState.ts
 *
 * Focused Session-3 Candidate G: **라이브 컴포지션 상태 싱글톤**.
 *
 * 음성 인식·비트·미션 결과 등 런타임 reactive 값을 컴포지터 렌더 state 로
 * 전달하기 위한 프레임-싸이클 독립적 싱글톤.
 *
 * 설계 원칙
 *   - Zustand 의존 피함: 레이어 렌더 hot-path 에서 store subscribe 오버헤드 금지.
 *   - React 밖(녹화 파이프라인·worker)에서도 쓸 수 있어야 함.
 *   - `getLiveState()` 는 매 프레임 호출 — O(1), 새 객체 생성 X (동일 ref 반환).
 *
 * 기여자 배선:
 *   - `engine/recognition/speechRecognizer.ts` onInterim → `setSpeechTranscript`
 *   - `engine/beat/beatClock.ts` onBeat → `setBeatIntensity`
 *   - `engine/missions/*` 결과 → `setMissionState`
 *
 * 소비자 배선:
 *   - `utils/videoCompositor.ts renderLayeredFrame` 가 state 병합 시 merge
 *   - `subtitle_track` 등 레이어는 `state.speechTranscript` 만 읽음 (CLAUDE §3 개별 레이어 격리)
 */

export interface LiveMissionState {
  repCount?: number;
  lastUtterance?: string;
  /** 최근 판정: perfect | good | fail */
  lastTag?: 'perfect' | 'good' | 'fail';
  [k: string]: unknown;
}

export interface LiveState {
  /** 최종 인식 누적 텍스트 (공백 trim). */
  speechTranscript: string;
  /** 현재 인터림(미확정) 텍스트. */
  speechInterim: string;
  /** 0~1 BeatClock onset envelope. */
  beatIntensity: number;
  /** 미션 관련 상태 모음. */
  missionState: LiveMissionState;
}

// ── 싱글톤 버퍼 ─────────────────────────────────────────────
// 동일 객체 ref 유지 → renderLayeredFrame state 병합 시 shallow spread 비용만.
const _live: LiveState = {
  speechTranscript: '',
  speechInterim: '',
  beatIntensity: 0,
  missionState: {},
};

type Listener = (s: Readonly<LiveState>) => void;
const _listeners = new Set<Listener>();

function _notify(): void {
  for (const cb of Array.from(_listeners)) {
    try { cb(_live); } catch (e) { console.warn('[liveState] listener err:', e); }
  }
}

// ── Setters ────────────────────────────────────────────────
export function setSpeechTranscript(final: string, interim = ''): void {
  _live.speechTranscript = final ?? '';
  _live.speechInterim = interim ?? '';
  _notify();
}

export function setBeatIntensity(v: number): void {
  _live.beatIntensity = Math.max(0, Math.min(1, v || 0));
  _notify();
}

export function setMissionState(patch: Partial<LiveMissionState>): void {
  if (!patch) return;
  Object.assign(_live.missionState, patch);
  _notify();
}

/** 세션 시작/종료 시 호출 — 모든 필드 리셋. */
export function resetLiveState(): void {
  _live.speechTranscript = '';
  _live.speechInterim = '';
  _live.beatIntensity = 0;
  for (const k of Object.keys(_live.missionState)) delete _live.missionState[k];
  _notify();
}

// ── Getters / Subscription ─────────────────────────────────
/** 매 프레임 호출용. 반환 객체는 mutate 금지 (readonly). */
export function getLiveState(): Readonly<LiveState> {
  return _live;
}

export function subscribeLiveState(cb: Listener): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

/**
 * 컴포지터용: 레이어 렌더 state 에 라이브 값 병합.
 * 기존 state 키가 있으면 우선(수동 오버라이드 가능) → 없으면 live 값 주입.
 */
export function mergeLiveIntoState<T extends Record<string, unknown>>(state: T): T & LiveState {
  const live = _live;
  return {
    speechTranscript: live.speechTranscript,
    speechInterim:    live.speechInterim,
    beatIntensity:    live.beatIntensity,
    missionState:     live.missionState,
    ...state, // 호출자 명시 값이 우선
  } as T & LiveState;
}
