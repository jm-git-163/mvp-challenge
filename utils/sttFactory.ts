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
  setLanguage(lang: 'ko' | 'en'): void;
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

// FIX-Y5 (2026-04-22): Whisper 엔진 재활성.
//   webkitSpeechRecognition 이 Android Chrome 에서 `not-allowed` 로 거의 100%
//   실패함을 실기기 테스트로 확인. 모바일에서는 Whisper 가 유일한 선택지.
//   데스크톱은 webkit 유지 (빠르고 안정).
const WHISPER_ENABLED = true;

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Android / iPhone / iPad / 기타 모바일 키워드. iPad 13+ 는 MacIntel 로 위장 → touch 포인트도 확인.
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true; // iPad desktop mode
  return false;
}

export function resolveSttEngine(): SttEngine {
  if (_cachedEngine) return _cachedEngine;
  if (typeof window === 'undefined') return 'webkit';

  if (!WHISPER_ENABLED) {
    _cachedEngine = 'webkit';
    return _cachedEngine;
  }

  // 1) URL 오버라이드 (디버그)
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
  // 3) ENV
  // @ts-ignore
  const envEngine = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STT_ENGINE) as
    | string
    | undefined;
  if (envEngine === 'whisper' || envEngine === 'webkit') {
    _cachedEngine = envEngine;
    return _cachedEngine;
  }
  // 4) 자동: 모바일 → Whisper, 데스크톱 → webkit
  _cachedEngine = isMobileUA() ? 'whisper' : 'webkit';
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
