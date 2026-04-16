/**
 * speechUtils.ts — Web Speech API 음성 인식 + 텍스트 유사도 평가
 * Chrome/Safari 지원. 미지원 브라우저는 자동 pass.
 */

export type SpeechState = 'idle' | 'listening' | 'processing' | 'done' | 'unsupported';

export interface SpeechResult {
  transcript: string;
  score: number;       // 0~1
  matchedWords: number;
  totalWords: number;
}

// ── 텍스트 유사도 (단어 기반 Jaccard) ──
export function textSimilarity(a: string, b: string): number {
  const normalize = (s: string): string[] =>
    s.toLowerCase().replace(/[^가-힣a-z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const wordsA = normalize(a);
  const wordsB = normalize(b);
  if (wordsA.length === 0) return 1;
  let matched = 0;
  for (const w of wordsA) {
    if (wordsB.some((wb) => wb.includes(w) || w.includes(wb))) matched++;
  }
  return matched / wordsA.length;
}

// ── SpeechRecognition 래퍼 ──
export class SpeechRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rec: any = null;
  private supported = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.rec = new SpeechRec();
        this.rec.continuous = false;
        this.rec.interimResults = true;
        this.supported = true;
      }
    }
  }

  isSupported(): boolean {
    return this.supported;
  }

  listen(
    lang: 'ko' | 'en',
    onInterim: (text: string) => void,
    onFinal: (result: string) => void,
    timeoutMs = 5000,
  ): () => void {
    if (!this.supported) {
      setTimeout(() => onFinal(''), 500);
      return () => {};
    }
    this.rec.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onresult = (e: any) => {
      const t: string = Array.from(e.results as ArrayLike<SpeechRecognitionResult>)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join('');
      if (e.results[e.results.length - 1].isFinal) {
        onFinal(t);
      } else {
        onInterim(t);
      }
    };
    this.rec.onerror = () => onFinal('');
    this.rec.start();
    const timer = setTimeout(() => {
      try { this.rec.stop(); } catch { /* ignore */ }
    }, timeoutMs);
    return () => {
      clearTimeout(timer);
      try { this.rec.stop(); } catch { /* ignore */ }
    };
  }

  stop(): void {
    try { this.rec?.stop(); } catch { /* ignore */ }
  }
}
