/**
 * speechUtils.ts — Web Speech API 음성 인식 + 텍스트 유사도 평가
 *
 * 핵심 수정:
 *  - continuous = true → 미션 시간 동안 계속 듣기
 *  - interimResults = true → 실시간 중간 결과 즉시 표시
 *  - 마이크 권한: RecordingCamera.web의 getUserMedia 스트림 공유로 재요청 방지
 *  - 누적 transcript: 중간 결과를 계속 누적해서 표시
 */

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'unsupported';

export interface SpeechResult {
  transcript: string;
  score:      number;       // 0~1
  matchedWords: number;
  totalWords:   number;
}

// ── 텍스트 유사도 (단어 기반 Jaccard + 부분 매칭) ──────────────────────────────
export function textSimilarity(target: string, spoken: string): number {
  const normalize = (s: string): string[] =>
    s.toLowerCase()
      .replace(/[^가-힣a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const wordsA = normalize(target);
  const wordsB = normalize(spoken);
  if (wordsA.length === 0) return 1;
  if (wordsB.length === 0) return 0;

  let matched = 0;
  for (const w of wordsA) {
    if (wordsB.some((wb) => wb.includes(w) || w.includes(wb))) matched++;
  }
  // Bonus for length coverage
  const lenRatio = Math.min(1, spoken.length / Math.max(1, target.length));
  return Math.min(1, (matched / wordsA.length) * 0.7 + lenRatio * 0.3);
}

// ── 전역 권한 pre-request ─────────────────────────────────────────────────────
// 카메라 스트림 허용 후 SpeechRecognition이 다시 마이크 팝업을 띄우는 것을 방지.
// _layout.tsx의 __permissionStream 또는 직접 getUserMedia로 마이크 권한을 확보합니다.
let _micGranted = false;
export async function prewarmMic(): Promise<void> {
  if (_micGranted || typeof window === 'undefined') return;

  // 방법 1: _layout.tsx에서 이미 카메라+마이크 스트림을 취득했다면 마이크 트랙 존재 확인
  const pre = (window as any).__permissionStream as MediaStream | undefined;
  if (pre && pre.getAudioTracks().length > 0 && pre.getAudioTracks()[0].readyState === 'live') {
    _micGranted = true;
    return;
  }

  // 방법 2: 직접 오디오 전용 getUserMedia
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // 스트림은 바로 정지하지 않고 __permissionStream에 보관 (SpeechRecognition 재사용)
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

  constructor() {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.rec = new SpeechRec();
        this.rec.continuous     = true;   // ← 핵심: 계속 듣기
        this.rec.interimResults = true;   // ← 핵심: 중간 결과 즉시 표시
        this.rec.maxAlternatives = 1;
        this.supported = true;
      }
    }
  }

  isSupported(): boolean { return this.supported; }
  isListening(): boolean { return this._listening; }

  listen(
    lang: 'ko' | 'en',
    onInterim: (text: string) => void,
    onFinal:   (result: string) => void,
    timeoutMs  = 7000,
  ): () => void {
    if (!this.supported || this._listening) {
      if (!this.supported) setTimeout(() => onFinal(''), 200);
      return () => {};
    }

    this._listening  = true;
    this._finalText  = '';
    this.rec.lang    = lang === 'ko' ? 'ko-KR' : 'en-US';

    // 누적 transcript
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
      // 항상 실시간 표시 (누적 + 현재 interim)
      onInterim((accumulated + interim).trim());
    };

    this.rec.onerror = (e: any) => {
      // no-speech: 말 없음 → 계속 듣기
      // aborted: stop() 수동 호출로 인한 종료 → 이미 onFinal 예약됨, 무시
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      // not-allowed: 마이크 권한 거부 → 인식 포기, 타임 기반 점수 유지
      if (e.error === 'not-allowed') {
        this._listening = false;
        return; // onFinal 호출 안 함 → voiceScoreRef.current 그대로 유지
      }
      this._listening = false;
      onFinal(this._finalText || accumulated.trim());
    };

    this.rec.onend = () => {
      // continuous=true임에도 자동 종료될 경우 재시작 (브라우저 이슈)
      if (this._listening) {
        try { this.rec.start(); } catch { /* ignore */ }
      }
    };

    try {
      this.rec.start();
    } catch (err) {
      this._listening = false;
      onFinal('');
      return () => {};
    }

    // 미션 시간이 끝나면 최종 결과 확정
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
