/**
 * engine/composition/speechBridge.ts
 *
 * Focused Session-4 Candidate L: **SpeechRecognizer → liveState 브릿지**.
 *
 * useJudgement (또는 임의의 recognizer 호출부) 가 onInterim/onFinal 콜백을 만들 때,
 * 이 브릿지를 거치면 자동으로 `liveState.speechTranscript` 가 갱신되어
 * `subtitle_track` 레이어가 실시간 렌더링할 수 있다.
 *
 * 설계:
 *   - 순수 함수 계층 — React/훅 의존 X (Jest/Vitest 에서 그대로 테스트 가능).
 *   - wrapInterimCallback/wrapFinalCallback: 사용자 콜백을 감싸서 liveState 업데이트 삽입.
 *   - makeSpeechBridge: 한 번에 {onInterim, onFinal} 페어 생성.
 *
 * 리셋:
 *   - 미션 전환/세션 종료 시 `resetLiveState()` 직접 호출 (또는 brige.reset()).
 */
import { setSpeechTranscript, resetLiveState } from './liveState';

export type InterimCallback = (transcript: string) => void;
export type FinalCallback = (transcript: string) => void;

export interface SpeechBridge {
  onInterim: InterimCallback;
  onFinal: FinalCallback;
  /** 미션 전환/세션 종료 시 호출 — liveState 의 speech 관련 필드 비움. */
  reset(): void;
}

/**
 * 기존 interim 콜백 앞단에 liveState 업데이트 삽입.
 * 원 콜백이 throw 해도 liveState 는 이미 갱신되어 subtitle 은 멈추지 않는다.
 */
export function wrapInterimCallback(userCb?: InterimCallback): InterimCallback {
  return (text: string) => {
    // liveState 먼저 갱신 — 사용자 콜백에서 에러 나도 화면 자막 유지
    try { setSpeechTranscript('', text ?? ''); } catch { /* ignore */ }
    if (userCb) {
      try { userCb(text); } catch (e) { console.warn('[speechBridge] interim userCb err:', e); }
    }
  };
}

/**
 * final 콜백 래퍼. final 확정 시 interim 은 비우고 final 만 유지.
 */
export function wrapFinalCallback(userCb?: FinalCallback): FinalCallback {
  return (text: string) => {
    try { setSpeechTranscript(text ?? '', ''); } catch { /* ignore */ }
    if (userCb) {
      try { userCb(text); } catch (e) { console.warn('[speechBridge] final userCb err:', e); }
    }
  };
}

/**
 * 한 번에 brige 생성. 호출부 변경:
 *   - before: `sr.listen(lang, onInterim, onFinal, ...)`
 *   - after:  `const b = makeSpeechBridge({ onInterim, onFinal }); sr.listen(lang, b.onInterim, b.onFinal, ...)`
 */
export function makeSpeechBridge(cbs: {
  onInterim?: InterimCallback;
  onFinal?: FinalCallback;
} = {}): SpeechBridge {
  return {
    onInterim: wrapInterimCallback(cbs.onInterim),
    onFinal:   wrapFinalCallback(cbs.onFinal),
    reset() {
      // speech 관련만 비우고 beat/mission 은 유지하고 싶을 수 있음 →
      // 필요시 호출자가 resetLiveState() 직접. 여기서는 speech 만 깔끔히 비움.
      try { setSpeechTranscript('', ''); } catch { /* ignore */ }
    },
  };
}

/** 전체 liveState 초기화 (세션 종료용 편의 export). */
export { resetLiveState };
