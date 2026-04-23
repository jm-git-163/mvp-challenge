/**
 * speechUtils.ts — Web Speech API 음성 인식 + 한국어 자모 기반 텍스트 유사도
 *
 * 핵심 수정:
 *  - SpeechRecognizer 인스턴스 재사용 (미션 변경 시 새 인스턴스 금지)
 *  - generation counter로 onend race condition 완전 방지
 *  - resetForNextMission() 메서드 추가 (권한 팝업 없이 다음 미션 준비)
 *  - 한국어 자모 분해 기반 텍스트 유사도
 */

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'unsupported';

export interface SpeechResult {
  transcript: string;
  score:      number;
  matchedWords: number;
  totalWords:   number;
}

// ── 한국어 자모 분해 테이블 ───────────────────────────────────────────────────

const CHOSUNG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

const JUNGSUNG = [
  'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ',
  'ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ',
];

const JONGSUNG = [
  '','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ',
  'ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

const PHONETIC_GROUPS: string[][] = [
  ['ㄱ','ㄲ','ㅋ'],
  ['ㄷ','ㄸ','ㅌ'],
  ['ㅂ','ㅃ','ㅍ'],
  ['ㅅ','ㅆ'],
  ['ㅈ','ㅉ','ㅊ'],
  ['ㄴ','ㄹ'],
  ['ㅐ','ㅔ'],
  ['ㅒ','ㅖ'],
  ['ㅘ','ㅏ'],
  ['ㅝ','ㅓ'],
];

function decomposeHangul(char: string): string[] {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return [char];
  const offset = code - 0xAC00;
  const jongsungIdx = offset % 28;
  const jungsungIdx = Math.floor(offset / 28) % 21;
  const chosungIdx  = Math.floor(offset / 28 / 21);
  const result = [CHOSUNG[chosungIdx], JUNGSUNG[jungsungIdx]];
  if (jongsungIdx > 0) result.push(JONGSUNG[jongsungIdx]);
  return result;
}

function stringToJamo(text: string): string[] {
  const jamo: string[] = [];
  for (const char of text) jamo.push(...decomposeHangul(char));
  return jamo;
}

function jamoSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  for (const group of PHONETIC_GROUPS) {
    if (group.includes(a) && group.includes(b)) return 0.5;
  }
  return 0;
}

function jamoLevenshtein(seqA: string[], seqB: string[]): number {
  const m = seqA.length, n = seqB.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = jamoSimilarity(seqA[i - 1], seqB[j - 1]);
      const cost = sim === 1 ? 0 : sim === 0.5 ? 0.5 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[m][n];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^가-힣a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function textSimilarity(target: string, spoken: string): number {
  if (!target || !target.trim()) return 1;
  if (!spoken || !spoken.trim()) return 0;

  const normTarget = normalize(target);
  const normSpoken = normalize(spoken);
  if (normTarget === normSpoken) return 1;

  const jamoTarget = stringToJamo(normTarget);
  const jamoSpoken = stringToJamo(normSpoken);
  const maxLen = Math.max(jamoTarget.length, jamoSpoken.length);
  if (maxLen === 0) return 1;

  const editDist  = jamoLevenshtein(jamoTarget, jamoSpoken);
  const jamoScore = Math.max(0, 1 - editDist / maxLen);

  const wordsTarget = normTarget.split(/\s+/).filter(Boolean);
  const wordsSpoken = normSpoken.split(/\s+/).filter(Boolean);
  let wordMatches = 0;
  for (const wt of wordsTarget) {
    if (wordsSpoken.some(ws => {
      if (ws === wt || ws.includes(wt) || wt.includes(ws)) return true;
      const jt = stringToJamo(wt), js = stringToJamo(ws);
      const d = jamoLevenshtein(jt, js);
      return Math.max(jt.length, js.length) > 0 && (1 - d / Math.max(jt.length, js.length)) >= 0.7;
    })) wordMatches++;
  }
  const wordScore   = wordsTarget.length > 0 ? wordMatches / wordsTarget.length : 0;
  const lenCoverage = Math.min(1, normSpoken.length / Math.max(1, normTarget.length));

  return Math.min(1, Math.max(0, jamoScore * 0.6 + wordScore * 0.3 + lenCoverage * 0.1));
}

// ── 전역 권한 pre-request ─────────────────────────────────────────────────────
let _micGranted = false;
export async function prewarmMic(): Promise<void> {
  if (_micGranted || typeof window === 'undefined') return;
  const pre = (window as any).__permissionStream as MediaStream | undefined;
  if (pre && pre.getAudioTracks().length > 0 && pre.getAudioTracks()[0].readyState === 'live') {
    _micGranted = true;
    return;
  }
  try {
    // FIX-MIC-SINGLETON (2026-04-23): ensureMediaSession 싱글톤을 통한 공유 스트림.
    const mod = await import('../engine/session/mediaSession');
    const stream = await mod.ensureMediaSession();
    (window as any).__micStream = stream;
    _micGranted = true;
  } catch {
    // 거부돼도 앱 동작
  }
}

// ── 모듈 레벨 SpeechRecognizer 싱글톤 ─────────────────────────────────────────
// 화면 이동(remount)해도 동일 인스턴스 재사용 → Chrome 권한 팝업 1회만 표시
let _globalRecognizer: SpeechRecognizer | null = null;

export function getGlobalSpeechRecognizer(): SpeechRecognizer {
  if (!_globalRecognizer && typeof window !== 'undefined') {
    _globalRecognizer = new SpeechRecognizer();
    // Team RELIABILITY: 전역 인스턴스 1개만 존재해야 정상.
    //   tracker 는 "싱글톤이 살아있음" 표시 1 로 고정 — 2 이상이면 누가 중복 생성.
    try {
      const { resourceTracker } = require('./resourceTracker');
      resourceTracker.inc('speechRecognizer');
    } catch {}
  }
  // SSR 환경 대비 fallback
  if (!_globalRecognizer) _globalRecognizer = new SpeechRecognizer();
  return _globalRecognizer;
}

/**
 * Team RELIABILITY (2026-04-22): 앱 전체 셧다운 시 싱글톤 정리.
 * record 화면 언마운트 정도로는 쓰지 말 것 — 다음 세션에서 권한 팝업이 다시 뜬다.
 * 현재는 테스트·디버그 전용.
 */
export function disposeGlobalSpeechRecognizer(): void {
  if (_globalRecognizer) {
    try { _globalRecognizer.stop(); } catch {}
    _globalRecognizer = null;
    try {
      const { resourceTracker } = require('./resourceTracker');
      resourceTracker.dec('speechRecognizer');
    } catch {}
  }
}

// ── SpeechRecognition 래퍼 ────────────────────────────────────────────────────
// 핵심: 인스턴스 1개를 전체 세션 동안 재사용
//       new SpeechRecognition() 생성 = Chrome 마이크 팝업 재표시
export class SpeechRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rec: any = null;
  private supported = false;
  private _listening = false;
  private _finalText  = '';
  private _stopTimer: ReturnType<typeof setTimeout> | null = null;
  private _watchdog: ReturnType<typeof setInterval> | null = null;
  private _lastResultsSnapshot = 0;
  private _stallChecks = 0;
  private _targetText = '';
  // generation counter: stop() 호출 시 증가 → 이전 onend가 잘못 재시작하는 race condition 방지
  private _gen = 0;
  // FIX-Z20 (2026-04-22): onerror 자동 재시도 카운터.
  //   no-speech / audio-capture / network 에러 시 1초 후 start() 재호출.
  //   onresult 가 성공적으로 들어오면 0 으로 리셋.
  //   5회 초과 시 포기 → lastEvent / lastError 에 사유 기록, 화면 뱃지로 노출.
  private retryCountRef = 0;
  private static RETRY_MAX = 5;
  private static RETRY_DELAY_MS = 1000;

  constructor() {
    this.lastEvent = 'init: webkit-api-check';
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.rec = new SpeechRec();
        this.rec.continuous     = true;
        this.rec.interimResults = true;
        this.rec.maxAlternatives = 1;
        this.supported = true;
        this.lastEvent = 'init: ok';
      } else {
        this.lastEvent = 'init: no-api';
      }
    } else {
      this.lastEvent = 'init: no-window';
    }
  }

  isSupported(): boolean { return this.supported; }
  isListening(): boolean { return this._listening; }

  // FIX-H (2026-04-21): UI 에서 실시간 진단할 수 있도록 상태 노출.
  public lastError: string | null = null;
  public lastTranscript: string = '';
  public startCount = 0;
  public endCount = 0;
  public resultCount = 0;
  // 신규: 단계별 라이프사이클 이벤트 기록 (실기기 콘솔 없이 화면에서 직접 확인).
  public lastEvent: string = 'init: pending';
  // Team STT (2026-04-22): 실기기 진단용 확장 필드.
  //   - lastResultAt: 마지막 onresult 수신 performance.now() (없으면 null).
  //   - 아래 retryCountRef 는 이미 존재 — getDiagnostic 으로 공개만 한다.
  public lastResultAt: number | null = null;
  getDiagnostic(): {
    listening: boolean;
    error: string | null;
    transcript: string;
    starts: number;
    ends: number;
    results: number;
    /** 자동 재시도 누적 횟수 (resultCount>0 이면 0 으로 리셋됨). */
    retryCount: number;
    /** 마지막 onresult 수신 시점 (performance.now() 기준 ms). 한 번도 없으면 null. */
    lastResultAt: number | null;
    /** 마지막 onresult 이후 경과 시간 (ms). listening=true 일 때만 의미 있음. */
    msSinceLastResult: number | null;
  } {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      listening: this._listening,
      error: this.lastError,
      transcript: this.lastTranscript,
      starts: this.startCount,
      ends: this.endCount,
      results: this.resultCount,
      retryCount: this.retryCountRef,
      lastResultAt: this.lastResultAt,
      msSinceLastResult: this.lastResultAt === null ? null : Math.max(0, now - this.lastResultAt),
    };
  }

  /**
   * 화면에 실시간 표시할 상세 진단 (엔진·플랫폼·마지막 이벤트).
   * SttRecognizer.getDiagnostics 구현.
   */
  getDiagnostics(): { lastEvent: string; engine: string; platform: string } {
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const platform = /Android/i.test(ua) ? 'android'
                   : /iPhone|iPad|iPod/i.test(ua) ? 'ios'
                   : /Mobile/i.test(ua) ? 'mobile'
                   : 'desktop';
    return {
      lastEvent: this.lastEvent,
      engine: 'webkit',
      platform,
    };
  }

  getLastEvent(): string { return this.lastEvent; }

  /**
   * 미션 변경 시 호출: 마이크 팝업 없이 누적 텍스트만 리셋
   * listen()은 계속 실행 중이므로 stop/start 하지 않음
   */
  resetForNextMission(): void {
    this._finalText  = '';
    this._targetText = '';
  }

  /**
   * 인식 중 목표 텍스트만 교체 (새 미션 텍스트 반영)
   * listen() 재호출 없이 실시간 유사도 비교 대상만 변경
   */
  setTargetText(text: string): void {
    this._targetText = text;
  }

  /**
   * FIX-Y11: webkitSpeechRecognition.lang 실시간 교체.
   *   미션 진입 시 한국어/영어 전환. listen() 재시작 없이 .lang 프로퍼티만 교체하면
   *   다음 인식 세션(onend → start 리프레시)에서 반영된다.
   */
  setLanguage(lang: 'ko' | 'en'): void {
    if (this.rec) {
      this.rec.lang = lang === 'en' ? 'en-US' : 'ko-KR';
    }
  }

  /**
   * 음성 인식 시작 (세션 당 1회 호출 권장 — 미션 전환 시 resetForNextMission() 사용)
   */
  listen(
    lang: 'ko' | 'en',
    onInterim: (text: string) => void,
    onFinal:   (result: string) => void,
    timeoutMs  = 30000,          // 기본 30초 (미션 전체)
    targetText?: string,
    onProgress?: (similarity: number) => void,
  ): () => void {
    if (!this.supported || this._listening) {
      if (!this.supported) setTimeout(() => onFinal(''), 100);
      return () => {};
    }

    this._listening  = true;
    this._finalText  = '';
    this._targetText = targetText ?? '';
    this.rec.lang    = lang === 'ko' ? 'ko-KR' : 'en-US';

    // FIX-Z9 (2026-04-22): 모바일 Chrome 에서 continuous=true 는 구글 ASR 백엔드가
    //   10~15초 후 무응답으로 세션을 끊지만 onend 가 즉시 발생하지 않음 → dead state.
    //   모바일에서는 continuous=false 로 두고 onend → start() 로 능동 재시작.
    //   데스크톱은 기존 continuous=true 유지 (안정적).
    const isMobile = typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    this.rec.continuous = !isMobile;
    this.rec.interimResults = true;

    let accumulated = '';
    const myGen = ++this._gen;   // capture current generation

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onresult = (e: any) => {
      this.resultCount++;
      // FIX-Z20: 결과가 도착했으면 자동 재시도 카운터 리셋.
      if (this.retryCountRef > 0) this.retryCountRef = 0;
      // Team STT: 진단용 타임스탬프 — VoiceDebugOverlay 가 "마지막 수신 몇초 전" 표시.
      this.lastResultAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.lastEvent = `onresult #${this.resultCount} len=${e?.results?.length ?? 0}`;
      try {
        if (typeof window !== 'undefined' && /[?&]debug=1\b/.test(window.location?.search || '')) {
          console.debug('[speech:onresult]', this.resultCount, this.lastTranscript);
        }
      } catch {}
      let interim = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t + ' ';
        else interim += t;
      }
      if (newFinal) {
        accumulated += newFinal;
        this._finalText = accumulated.trim();
      }
      const current = (accumulated + interim).trim();
      this.lastTranscript = current;
      onInterim(current);
      if (this._targetText && onProgress) {
        onProgress(textSimilarity(this._targetText, current));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onerror = (e: any) => {
      // 진단용 — 왜 인식이 멈추는지 콘솔에 기록
      this.lastError = String(e?.error || e || 'unknown');
      this.lastEvent = `onerror: ${this.lastError}`;
      try { console.warn('[speech] onerror:', e.error || e); } catch {}

      // FIX-Z20 (2026-04-22): 복구 가능 에러에 대한 능동적 재시도.
      //   onend 기반 재시작은 브라우저가 onend 를 발생시켜야 동작하지만
      //   모바일 Chrome 은 특정 에러(no-speech/audio-capture/network) 후
      //   onend 가 지연되거나 누락되는 경우가 있어 dead-state 에 빠진다.
      //   명시적 setTimeout(1000) 후 start() 재호출로 확정적 회복을 보장.
      const recoverable = (e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'network');
      if (recoverable && this._listening && this._gen === myGen) {
        if (this.retryCountRef < SpeechRecognizer.RETRY_MAX) {
          this.retryCountRef += 1;
          this.lastEvent = `onerror: ${e.error} → auto-retry #${this.retryCountRef}`;
          setTimeout(() => {
            if (!this._listening || this._gen !== myGen) return;
            try { this.rec?.start(); }
            catch (err) {
              this.lastEvent = `auto-retry #${this.retryCountRef} start failed: ${String((err as Error)?.message ?? err)}`;
            }
          }, SpeechRecognizer.RETRY_DELAY_MS);
          // 복구 가능 에러는 _listening 유지한 채 돌아간다 (아래 fallthrough 에서 false 되지 않도록).
          return;
        } else {
          this.lastEvent = 'give-up: 5 failures';
          this.lastError = '자동 재시도 5회 실패';
          return;
        }
      }

      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Chrome은 침묵이 길면 자동 종료 → onend에서 재시작됨 (listening 유지)
        return;
      }
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this._listening = false;
        onInterim('[마이크 권한 필요 — 주소창 🔒 아이콘에서 마이크 허용]');
        onFinal('');
        return;
      }
      if (e.error === 'network') {
        // 네트워크 에러 — 잠시 후 재시도 (listening 유지)
        return;
      }
      this._listening = false;
      onFinal(this._finalText || accumulated.trim());
    };

    // onend: continuous 모드에서 중간에 끊기면 재시작
    // generation check으로 이전 stop()에 의한 onend가 잘못 재시작하는 것 방지
    this.rec.onstart = () => {
      this.startCount++;
      this.lastError = null;
      this.lastEvent = `onstart #${this.startCount}`;
      try {
        if (typeof window !== 'undefined' && /[?&]debug=1\b/.test(window.location?.search || '')) {
          console.debug('[speech:onstart]', this.startCount);
        }
      } catch {}
    };
    this.rec.onend = () => {
      this.endCount++;
      try {
        if (typeof window !== 'undefined' && /[?&]debug=1\b/.test(window.location?.search || '')) {
          console.debug('[speech:onend]', this.endCount, 'listening=', this._listening);
        }
      } catch {}
      if (this._listening && this._gen === myGen) {
        this.lastEvent = `onend #${this.endCount} → restart`;
        // Chrome InvalidStateError 회피: 100ms 지연 후 재시작
        setTimeout(() => {
          if (!this._listening || this._gen !== myGen) return;
          try { this.rec.start(); }
          catch (err) {
            this.lastEvent = `onend-restart failed: ${String((err as Error)?.message ?? err)}`;
            try { console.warn('[speech] restart failed:', err); } catch {}
            // 400ms 뒤 한 번 더 시도
            setTimeout(() => {
              if (!this._listening || this._gen !== myGen) return;
              try { this.rec.start(); } catch {}
            }, 400);
          }
        }, 100);
      } else {
        this.lastEvent = `onend #${this.endCount} final`;
      }
    };

    // 이전 stop() 이후 브라우저가 처리할 시간이 필요할 수 있음
    // start()가 실패하면 onend 이벤트가 발생할 때 재시도
    const tryStart = () => {
      try {
        this.rec.start();
      } catch {
        // InvalidStateError: still stopping — onend 핸들러가 재시작해줌
        // listening=true 유지하여 onend에서 재시작 허용
      }
    };

    // FIX-Z9 (2026-04-22): 모바일 Chrome 은 user gesture stack 이 ~200ms 내에서만
    //   start() 를 허가. setTimeout(50) 은 stack 을 이탈할 수 있음 → 우선 동기 호출,
    //   InvalidStateError 발생 시에만 50ms 지연 재시도.
    this.lastEvent = 'start: calling';
    try {
      this.rec.start();
      this.lastEvent = 'start: ok';
    } catch (err) {
      this.lastEvent = `start: error: ${String((err as Error)?.name ?? err)}`;
      try { console.warn('[speech] sync start threw, retry after 50ms:', err); } catch {}
      setTimeout(tryStart, 50);
    }

    // FIX-M (2026-04-21): Android Chrome Google ASR 스톨 우회.
    //   continuous=true 상태에서 구글 백엔드가 무응답이면 result 가 영원히 안 옴
    //   (starts 계속 누적, results=0). 매 4초마다 result 증가 여부 체크 →
    //   7초(2회 연속) 무증가면 강제 stop() → onend 가 재시작 → 구글 세션 리프레시.
    //   이 패턴이 Android Chrome 환경에서 ASR 복구 유일한 클라이언트 우회책.
    if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
    this._lastResultsSnapshot = this.resultCount;
    this._stallChecks = 0;
    this._watchdog = setInterval(() => {
      if (!this._listening || this._gen !== myGen) {
        if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
        return;
      }
      if (this.resultCount > this._lastResultsSnapshot) {
        this._lastResultsSnapshot = this.resultCount;
        this._stallChecks = 0;
        return;
      }
      this._stallChecks++;
      if (this._stallChecks >= 2 && this.startCount >= 1) {
        // 스톨 감지 — 강제 재시작 (onend 핸들러가 재시작 담당)
        try { console.warn('[speech] watchdog: stall detected, forcing restart'); } catch {}
        this._stallChecks = 0;
        try { this.rec.stop(); } catch {}
        // onend 핸들러가 자동으로 rec.start() 호출 → 세션 리프레시
      }
    }, 4000);

    // 최대 timeoutMs 후 자동 종료
    this._stopTimer = setTimeout(() => {
      if (this._gen !== myGen) return;  // 이미 stop() 됐으면 무시
      this._listening = false;
      try { this.rec.stop(); } catch { /* ignore */ }
      onFinal(this._finalText || accumulated.trim());
    }, timeoutMs);

    return () => {
      if (this._gen !== myGen) return;
      this._gen++;                   // 이 세대 무효화 → onend 재시작 차단
      this._listening = false;
      if (this._stopTimer) { clearTimeout(this._stopTimer); this._stopTimer = null; }
      if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
      try { this.rec.stop(); } catch { /* ignore */ }
      onFinal(this._finalText || accumulated.trim());
    };
  }

  stop(): void {
    this._gen++;                   // generation 증가 → onend 재시작 차단
    this._listening = false;
    this.lastEvent = 'stop: called';
    if (this._stopTimer) { clearTimeout(this._stopTimer); this._stopTimer = null; }
    if (this._watchdog) { clearInterval(this._watchdog); this._watchdog = null; }
    try { this.rec?.stop(); } catch { /* ignore */ }
  }
}

// ── 음성 인식 사전 가용성 체크 ────────────────────────────────────────────────
// 녹화 시작 전 호출하여 어느 단계에서 막혔는지 화면에 표시할 수 있게 한다.
// 서버 전송 없이 100% 클라이언트 체크.
export async function checkSpeechCapability(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'SSR 환경' };
  if (!navigator?.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'mediaDevices.getUserMedia 미지원 (HTTPS 필요)' };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    // FIX-Z11 (2026-04-22): iOS Safari 는 webkitSpeechRecognition 미지원 → 명시적 안내.
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
                  (/Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1);
    if (isIOS) {
      return {
        ok: false,
        reason: 'iOS Safari 는 음성 인식 미지원 — Android Chrome 또는 데스크톱 Chrome 에서 열어주세요',
      };
    }
    return { ok: false, reason: 'SpeechRecognition API 없음 (Chrome/Edge 권장)' };
  }
  // permissions.query 는 브라우저별 지원 편차가 커서 실패해도 무시.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyNav = navigator as any;
    if (anyNav.permissions?.query) {
      const status = await anyNav.permissions.query({ name: 'microphone' });
      if (status?.state === 'denied') {
        return { ok: false, reason: '마이크 권한 거부됨 (브라우저 설정에서 허용)' };
      }
    }
  } catch { /* ignore */ }
  return { ok: true };
}
