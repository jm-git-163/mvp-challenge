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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    (window as any).__micStream = stream;
    _micGranted = true;
  } catch {
    // 거부돼도 앱 동작
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
  private _targetText = '';
  // generation counter: stop() 호출 시 증가 → 이전 onend가 잘못 재시작하는 race condition 방지
  private _gen = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.rec = new SpeechRec();
        this.rec.continuous     = true;
        this.rec.interimResults = true;
        this.rec.maxAlternatives = 1;
        this.supported = true;
      }
    }
  }

  isSupported(): boolean { return this.supported; }
  isListening(): boolean { return this._listening; }

  /**
   * 미션 변경 시 호출: 마이크 팝업 없이 누적 텍스트만 리셋
   * listen()은 계속 실행 중이므로 stop/start 하지 않음
   */
  resetForNextMission(): void {
    this._finalText  = '';
    this._targetText = '';
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

    let accumulated = '';
    const myGen = ++this._gen;   // capture current generation

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onresult = (e: any) => {
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
      onInterim(current);
      if (this._targetText && onProgress) {
        onProgress(textSimilarity(this._targetText, current));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        // 마이크 권한 거부 → 사용자에게 interim으로 알림
        this._listening = false;
        onInterim('[마이크 권한 필요: 브라우저 주소창 옆 🔒에서 마이크 허용]');
        onFinal('');
        return;
      }
      this._listening = false;
      onFinal(this._finalText || accumulated.trim());
    };

    // onend: continuous 모드에서 중간에 끊기면 재시작
    // generation check으로 이전 stop()에 의한 onend가 잘못 재시작하는 것 방지
    this.rec.onend = () => {
      if (this._listening && this._gen === myGen) {
        try { this.rec.start(); } catch { /* ignore */ }
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

    // 이전 recognition이 멈추는 중일 수 있으므로 50ms 후 시작
    setTimeout(tryStart, 50);

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
      try { this.rec.stop(); } catch { /* ignore */ }
      onFinal(this._finalText || accumulated.trim());
    };
  }

  stop(): void {
    this._gen++;                   // generation 증가 → onend 재시작 차단
    this._listening = false;
    if (this._stopTimer) { clearTimeout(this._stopTimer); this._stopTimer = null; }
    try { this.rec?.stop(); } catch { /* ignore */ }
  }
}
