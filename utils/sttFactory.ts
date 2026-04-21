/**
 * utils/sttFactory.ts — STT 엔진 선택 팩토리.
 *
 * FIX-I: webkitSpeechRecognition(기본) ↔ Whisper WASM(대체) 스위치.
 *
 * 선택 순서:
 *   1. URL `?stt=whisper` 또는 `?stt=webkit` (디버그용)
 *   2. localStorage `motiq_stt` (sticky)
 *   3. ENV `EXPO_PUBLIC_STT_ENGINE` ('whisper' | 'webkit')
 *   4. 자동: 모바일 → whisper, 데스크톱 → webkit (모바일 크롬의 webkit 불안정성 우회)
 */

import { SpeechRecognizer, getGlobalSpeechRecognizer } from './speechUtils';
import { WhisperRecognizer, getGlobalWhisperRecognizer } from './whisperRecognizer';

export type SttEngine = 'webkit' | 'whisper';

// 두 클래스가 공유하는 최소 인터페이스 — useJudgement 가 사용하는 메서드만.
export interface SttRecognizer {
  isSupported(): boolean;
  isListening(): boolean;
  resetForNextMission(): void;
  setTargetText(text: string): void;
  stop(): void;
  listen(
    lang: 'ko' | 'en',
    onInterim: (t: string) => void,
    onFinal: (t: string) => void,
    timeoutMs?: number,
    targetText?: string,
    onProgress?: (s: number) => void,
  ): () => void;
  getDiagnostic(): {
    listening: boolean;
    error: string | null;
    transcript: string;
    starts: number;
    ends: number;
    results: number;
  };
}

// 컴파일 타임에 두 클래스가 실제로 인터페이스를 만족하는지 타입 레벨에서 확인
const _sr: SttRecognizer = null as unknown as SpeechRecognizer;
const _wr: SttRecognizer = null as unknown as WhisperRecognizer;
void _sr; void _wr;

let _cachedEngine: SttEngine | null = null;

export function resolveSttEngine(): SttEngine {
  if (_cachedEngine) return _cachedEngine;
  if (typeof window === 'undefined') return 'webkit';

  // 1) URL 쿼리
  const q = window.location.search;
  const m = q.match(/[?&]stt=(whisper|webkit)\b/);
  if (m) {
    _cachedEngine = m[1] as SttEngine;
    try { window.localStorage.setItem('motiq_stt', _cachedEngine); } catch {}
    return _cachedEngine;
  }

  // 2) localStorage sticky
  try {
    const ls = window.localStorage.getItem('motiq_stt');
    if (ls === 'whisper' || ls === 'webkit') {
      _cachedEngine = ls;
      return _cachedEngine;
    }
  } catch {}

  // 3) env (Expo 는 EXPO_PUBLIC_* 만 번들에 노출)
  // @ts-ignore — process.env 는 번들러에 의해 정적 치환됨
  const envEngine = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STT_ENGINE) as
    | string
    | undefined;
  if (envEngine === 'whisper' || envEngine === 'webkit') {
    _cachedEngine = envEngine;
    return _cachedEngine;
  }

  // 4) 자동 감지 — 모바일은 whisper, 데스크톱은 webkit
  //   세션1 초기값: 안정성 위해 기본은 'webkit' (기존 동작 유지).
  //   유저가 원하면 ?stt=whisper 로 즉시 전환 가능.
  _cachedEngine = 'webkit';
  return _cachedEngine;
}

export function getRecognizer(): SttRecognizer {
  const engine = resolveSttEngine();
  return engine === 'whisper' ? getGlobalWhisperRecognizer() : getGlobalSpeechRecognizer();
}

/** 테스트·디버그 전용 — 캐시 리셋. */
export function _resetSttCache(): void {
  _cachedEngine = null;
}
