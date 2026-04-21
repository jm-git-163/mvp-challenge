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

// FIX-I7: Whisper 엔진 일시 비활성 (Session 2 재개 전까지 강제 webkit).
//   기존 우선순위 로직(URL·localStorage·env) 은 주석으로 보존 → Session 2 에
//   Worker 격리 + WASM 경로 수동 지정 완료 후 복원.
const WHISPER_ENABLED = false;

export function resolveSttEngine(): SttEngine {
  if (_cachedEngine) return _cachedEngine;
  if (typeof window === 'undefined') return 'webkit';

  if (!WHISPER_ENABLED) {
    _cachedEngine = 'webkit';
    return _cachedEngine;
  }

  // ── 이하는 WHISPER_ENABLED=true 때만 유효 (Session 2 에서 복원) ──
  const q = window.location.search;
  const m = q.match(/[?&]stt=(whisper|webkit)\b/);
  if (m) {
    _cachedEngine = m[1] as SttEngine;
    try { window.localStorage.setItem('motiq_stt', _cachedEngine); } catch {}
    return _cachedEngine;
  }
  try {
    const ls = window.localStorage.getItem('motiq_stt');
    if (ls === 'whisper' || ls === 'webkit') {
      _cachedEngine = ls;
      return _cachedEngine;
    }
  } catch {}
  // @ts-ignore
  const envEngine = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STT_ENGINE) as
    | string
    | undefined;
  if (envEngine === 'whisper' || envEngine === 'webkit') {
    _cachedEngine = envEngine;
    return _cachedEngine;
  }
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
