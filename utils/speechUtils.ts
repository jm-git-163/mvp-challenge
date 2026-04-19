/**
 * speechUtils.ts — Web Speech API 음성 인식 + 한국어 자모 기반 텍스트 유사도
 *
 * 개선 사항:
 *  - 한국어 자모 분해 (ㄱ,ㄴ,ㄷ... 레벨 매칭)
 *  - 문자 레벨 유사도 (Levenshtein distance 기반)
 *  - 실시간 중간 결과에 대한 onProgress 콜백
 *  - 음성 인식 정확도 바 실시간 업데이트
 */

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'unsupported';

export interface SpeechResult {
  transcript: string;
  score:      number;       // 0~1
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

// 음성적으로 유사한 자모 그룹 (부분 점수 부여)
const PHONETIC_GROUPS: string[][] = [
  ['ㄱ','ㄲ','ㅋ'],
  ['ㄷ','ㄸ','ㅌ'],
  ['ㅂ','ㅃ','ㅍ'],
  ['ㅅ','ㅆ'],
  ['ㅈ','ㅉ','ㅊ'],
  ['ㄴ','ㄹ'],         // 외래어 발음 변환
  ['ㅐ','ㅔ'],         // 현대 한국어에서 자주 혼동
  ['ㅒ','ㅖ'],
  ['ㅘ','ㅏ'],
  ['ㅝ','ㅓ'],
];

/** 한글 유니코드 한 글자를 초/중/종성 자모 배열로 분해 */
function decomposeHangul(char: string): string[] {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return [char]; // 비한글 그대로

  const offset = code - 0xAC00;
  const jongsungIdx = offset % 28;
  const jungsungIdx = Math.floor(offset / 28) % 21;
  const chosungIdx  = Math.floor(offset / 28 / 21);

  const result = [CHOSUNG[chosungIdx], JUNGSUNG[jungsungIdx]];
  if (jongsungIdx > 0) result.push(JONGSUNG[jongsungIdx]);
  return result;
}

/** 문자열을 자모 배열로 완전 분해 (한글 + 영문 모두 지원) */
function stringToJamo(text: string): string[] {
  const jamo: string[] = [];
  for (const char of text) {
    const decomposed = decomposeHangul(char);
    jamo.push(...decomposed);
  }
  return jamo;
}

/** 두 자모가 음성적으로 유사한지 확인 (0=다름, 0.5=유사, 1=동일) */
function jamoSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  for (const group of PHONETIC_GROUPS) {
    if (group.includes(a) && group.includes(b)) return 0.5;
  }
  return 0;
}

/** Levenshtein distance (자모 레벨, 음성 유사도 가중치 적용) */
function jamoLevenshtein(seqA: string[], seqB: string[]): number {
  const m = seqA.length;
  const n = seqB.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // dp[i][j] = seqA[0..i-1] vs seqB[0..j-1]의 편집 비용
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = jamoSimilarity(seqA[i - 1], seqB[j - 1]);
      const substitutionCost = sim === 1 ? 0 : sim === 0.5 ? 0.5 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,                       // deletion
        dp[i][j - 1] + 1,                       // insertion
        dp[i - 1][j - 1] + substitutionCost,    // substitution (with phonetic weight)
      );
    }
  }
  return dp[m][n];
}

/** 정규화 함수: 특수문자 제거, 소문자, 공백 정리 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 텍스트 유사도 (자모 분해 + Levenshtein 기반) ──────────────────────────────

/**
 * 한국어 자모 분해 기반 텍스트 유사도
 * - 자모 레벨에서 음성적 유사도 계산
 * - 음성적으로 유사한 자모(ㄱ/ㄲ/ㅋ 등)는 부분 점수 부여
 * - 단어 레벨 Jaccard와 자모 레벨 편집거리를 결합
 *
 * @returns 0.0 (아무것도 말하지 않음) ~ 1.0 (완벽 일치)
 */
export function textSimilarity(target: string, spoken: string): number {
  if (!target || !target.trim()) return 1;
  if (!spoken || !spoken.trim()) return 0;

  const normTarget = normalize(target);
  const normSpoken = normalize(spoken);

  if (normTarget === normSpoken) return 1;

  // ─ 1. 자모 레벨 유사도 ──────────────────────────────────────────────────
  const jamoTarget = stringToJamo(normTarget);
  const jamoSpoken = stringToJamo(normSpoken);

  const maxLen = Math.max(jamoTarget.length, jamoSpoken.length);
  if (maxLen === 0) return 1;

  const editDist = jamoLevenshtein(jamoTarget, jamoSpoken);
  const jamoScore = Math.max(0, 1 - editDist / maxLen);

  // ─ 2. 단어 레벨 유사도 (포함 관계 + Jaccard) ────────────────────────────
  const wordsTarget = normTarget.split(/\s+/).filter(Boolean);
  const wordsSpoken = normSpoken.split(/\s+/).filter(Boolean);

  let wordMatches = 0;
  for (const wt of wordsTarget) {
    if (wordsSpoken.some(ws => {
      if (ws === wt) return true;
      if (ws.includes(wt) || wt.includes(ws)) return true;
      // 자모 레벨 부분 유사도 체크
      const jt = stringToJamo(wt);
      const js = stringToJamo(ws);
      const dist = jamoLevenshtein(jt, js);
      const wordLen = Math.max(jt.length, js.length);
      return wordLen > 0 && (1 - dist / wordLen) >= 0.7;
    })) {
      wordMatches++;
    }
  }
  const wordScore = wordsTarget.length > 0 ? wordMatches / wordsTarget.length : 0;

  // ─ 3. 길이 커버리지 보너스 ──────────────────────────────────────────────
  const lenCoverage = Math.min(1, normSpoken.length / Math.max(1, normTarget.length));

  // ─ 4. 가중 평균: 자모 60% + 단어 30% + 길이 10% ─────────────────────────
  const combined = jamoScore * 0.6 + wordScore * 0.3 + lenCoverage * 0.1;
  return Math.min(1, Math.max(0, combined));
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
    // 거부돼도 앱 동작 — SpeechRecognition에서 not-allowed 에러 처리됨
  }
}

// ── SpeechRecognition 래퍼 ────────────────────────────────────────────────────
export class SpeechRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rec: any = null;
  private supported = false;
  private _listening = false;
  private _finalText  = '';
  private _stopTimer: ReturnType<typeof setTimeout> | null = null;
  private _targetText = '';

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
   * 음성 인식 시작
   * @param lang         인식 언어
   * @param onInterim    실시간 중간 결과 텍스트 콜백
   * @param onFinal      최종 결과 텍스트 콜백
   * @param timeoutMs    최대 인식 시간
   * @param targetText   목표 텍스트 (onProgress 계산에 사용)
   * @param onProgress   실시간 유사도 0~1 콜백 (정확도 바 업데이트용)
   */
  listen(
    lang: 'ko' | 'en',
    onInterim: (text: string) => void,
    onFinal:   (result: string) => void,
    timeoutMs  = 7000,
    targetText?: string,
    onProgress?: (similarity: number) => void,
  ): () => void {
    if (!this.supported || this._listening) {
      if (!this.supported) setTimeout(() => onFinal(''), 200);
      return () => {};
    }

    this._listening  = true;
    this._finalText  = '';
    this._targetText = targetText ?? '';
    this.rec.lang    = lang === 'ko' ? 'ko-KR' : 'en-US';

    let accumulated = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onresult = (e: any) => {
      let interim = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          newFinal += t + ' ';
        } else {
          interim += t;
        }
      }
      if (newFinal) {
        accumulated += newFinal;
        this._finalText = accumulated.trim();
      }

      const currentText = (accumulated + interim).trim();
      onInterim(currentText);

      // 실시간 유사도 계산 → 정확도 바 업데이트
      if (this._targetText && onProgress) {
        const sim = textSimilarity(this._targetText, currentText);
        onProgress(sim);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') {
        this._listening = false;
        return;
      }
      this._listening = false;
      onFinal(this._finalText || accumulated.trim());
    };

    this.rec.onend = () => {
      if (this._listening) {
        try { this.rec.start(); } catch { /* ignore */ }
      }
    };

    try {
      this.rec.start();
    } catch {
      this._listening = false;
      onFinal('');
      return () => {};
    }

    this._stopTimer = setTimeout(() => {
      this._listening = false;
      try { this.rec.stop(); } catch { /* ignore */ }
      onFinal(this._finalText || accumulated.trim());
    }, timeoutMs);

    return () => {
      this._listening = false;
      if (this._stopTimer) clearTimeout(this._stopTimer);
      try { this.rec.stop(); } catch { /* ignore */ }
      onFinal(this._finalText || accumulated.trim());
    };
  }

  stop(): void {
    this._listening = false;
    if (this._stopTimer) { clearTimeout(this._stopTimer); this._stopTimer = null; }
    try { this.rec?.stop(); } catch { /* ignore */ }
  }
}
