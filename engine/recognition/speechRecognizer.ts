/**
 * engine/recognition/speechRecognizer.ts
 *
 * Phase 1 — 네이티브 SpeechRecognition 래퍼 + 스크립트 매처.
 *
 * docs/COMPATIBILITY §5:
 *   - webkitSpeechRecognition (iOS Safari, 구버전 Chrome)
 *   - SpeechRecognition (표준, Edge/최신 Chrome)
 *   - iOS는 세션이 5~10초마다 끊김 → `onend` 에서 자동 재시작 필요
 *   - 권한 거부 시 재시작 무한 루프 방지 (연속 실패 3회 이상 → 중단)
 *
 * 미션 "Script":
 *   - 실시간 transcript를 낭독 스크립트와 비교
 *   - 공식 = 레벤슈타인 유사도 60 + 완주율 20 + 시간 20 (docs/CLAUDE §5)
 */

// ─── 텍스트 유틸 ────────────────────────────────────────────────────────────

/** 공백·구두점 정규화 + 한글 자모는 유지. */
export function normalizeKorean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\t\n\r]+/g, ' ')
    .replace(/[.,!?"'`()[\]{}、，。！？「」『』〜~\-—–…·]/g, '')
    .trim();
}

/** 표준 레벤슈타인 거리 (O(mn) DP). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // sub
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0..1 유사도 = 1 − levenshtein / max(len). */
export function similarity(a: string, b: string): number {
  const na = normalizeKorean(a);
  const nb = normalizeKorean(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/** 낭독 완주율: 스크립트 단어 중 transcript에 포함된 비율 (순서 무관). */
export function completion(transcript: string, script: string): number {
  const tWords = new Set(normalizeKorean(transcript).split(' ').filter(Boolean));
  const sWords = normalizeKorean(script).split(' ').filter(Boolean);
  if (sWords.length === 0) return 1;
  let hit = 0;
  for (const w of sWords) if (tWords.has(w)) hit++;
  return hit / sWords.length;
}

// ─── 래퍼 ───────────────────────────────────────────────────────────────────

export interface SpeechResultEvent {
  results: SpeechResultItem[];
}
export interface SpeechResultItem {
  isFinal: boolean;
  transcript: string;
  confidence?: number;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognizerDeps {
  /** new 가능한 생성자. 없으면 webkitSpeechRecognition/SpeechRecognition 자동 탐색. */
  ctor?: new () => RecognitionLike;
  /** iOS Safari 감지 (auto-restart 활성화). */
  isIOS?: boolean;
  /** setTimeout 주입 (테스트용). */
  setTimeout?: (cb: () => void, ms: number) => unknown;
}

export interface SpeechRecognizerOptions {
  lang?: string;              // 기본 'ko-KR'
  continuous?: boolean;
  interimResults?: boolean;
  /** iOS에서 onend 시 재시작 최대 연속 실패 횟수. */
  maxConsecutiveErrors?: number;
}

export type SpeechState = 'idle' | 'running' | 'ended' | 'error';

export class SpeechRecognizer {
  private rec: RecognitionLike | null = null;
  private transcript = '';
  private interim = '';
  private consecutiveErrors = 0;
  private shouldRun = false;
  private state: SpeechState = 'idle';
  private listeners: Array<(t: { final: string; interim: string; state: SpeechState }) => void> = [];
  private readonly Ctor: (new () => RecognitionLike) | undefined;
  private readonly isIOS: boolean;
  private readonly setTimeoutFn: (cb: () => void, ms: number) => unknown;

  constructor(
    private opts: SpeechRecognizerOptions = {},
    deps: SpeechRecognizerDeps = {},
  ) {
    this.Ctor = deps.ctor ?? this.pickCtor();
    this.isIOS = deps.isIOS ?? false;
    this.setTimeoutFn = deps.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
  }

  private pickCtor(): (new () => RecognitionLike) | undefined {
    if (typeof globalThis === 'undefined') return undefined;
    const g = globalThis as unknown as Record<string, unknown>;
    const C = (g.SpeechRecognition ?? g.webkitSpeechRecognition) as (new () => RecognitionLike) | undefined;
    return C;
  }

  isSupported(): boolean { return !!this.Ctor; }
  getState(): SpeechState { return this.state; }
  getTranscript(): string { return this.transcript.trim(); }

  start(): void {
    if (!this.Ctor) {
      this.state = 'error';
      this.notify();
      return;
    }
    this.shouldRun = true;
    this.consecutiveErrors = 0;
    this.transcript = '';
    this.interim = '';
    this.spawn();
  }

  stop(): void {
    this.shouldRun = false;
    try { this.rec?.stop(); } catch { /* ignore */ }
    this.state = 'ended';
    this.notify();
  }

  subscribe(cb: (t: { final: string; interim: string; state: SpeechState }) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private spawn(): void {
    if (!this.Ctor) return;
    const rec = new this.Ctor();
    rec.lang = this.opts.lang ?? 'ko-KR';
    rec.continuous = this.opts.continuous ?? true;
    rec.interimResults = this.opts.interimResults ?? true;

    rec.onresult = (e) => {
      let newFinal = '';
      let newInterim = '';
      for (const r of e.results) {
        if (r.isFinal) newFinal += r.transcript + ' ';
        else newInterim += r.transcript;
      }
      if (newFinal) {
        this.transcript += newFinal;
        this.consecutiveErrors = 0;
      }
      this.interim = newInterim;
      this.notify();
    };

    rec.onerror = (e) => {
      this.consecutiveErrors++;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.shouldRun = false;
        this.state = 'error';
        this.notify();
      }
    };

    rec.onend = () => {
      if (!this.shouldRun) {
        // 이미 error로 진입했으면 유지 (not-allowed / max-errors 경로)
        if (this.state !== 'error') this.state = 'ended';
        this.notify();
        return;
      }
      // iOS: 세션이 자주 끊김. 재시작 시도. 단 연속 실패 과다면 포기.
      const max = this.opts.maxConsecutiveErrors ?? 3;
      if (this.consecutiveErrors >= max) {
        this.state = 'error';
        this.shouldRun = false;
        this.notify();
        return;
      }
      // Focused Commit B-3: iOS 만 재시작하던 걸 모든 브라우저로 확장.
      //   - Chrome Desktop/Android Chrome 도 continuous=true 에서 조용히 onend 후 멈추는 경우 존재.
      //   - shouldRun 이 유지되는 한 150ms 뒤 spawn. transcript/listeners 는 보존 (this. 스코프 유지).
      const delay = this.isIOS ? 100 : 150;
      this.setTimeoutFn(() => { if (this.shouldRun) this.spawn(); }, delay);
    };

    try {
      rec.start();
      this.rec = rec;
      this.state = 'running';
      this.notify();
    } catch {
      this.consecutiveErrors++;
      this.state = 'error';
      this.notify();
    }
  }

  private notify() {
    const snap = { final: this.getTranscript(), interim: this.interim, state: this.state };
    for (const cb of [...this.listeners]) {
      try { cb(snap); } catch { /* ignore */ }
    }
  }
}
