/**
 * engine/studio/retry.ts
 *
 * Phase 6 — 지수 백오프 재시도 + AbortSignal.
 * 모델 다운로드, SpeechRecognition 재시작, fetch 등 공용.
 *
 * docs/EDGE_CASES.md §3: 모델 3회 재시도 / iOS SR 자동 재시작 등.
 */

export interface RetryPolicy {
  /** 최대 시도 횟수 (초기 시도 포함). 기본 3. */
  maxAttempts: number;
  /** 초기 백오프 ms. 기본 300. */
  baseDelayMs: number;
  /** 지수 팩터. 기본 2. */
  factor: number;
  /** 지터 최대 비율 (0~1, 0.3 = ±30%). 기본 0.3. */
  jitter: number;
  /** 상한 ms. 기본 10000. */
  maxDelayMs: number;
  /** 재시도 대상 판정. true 를 반환하면 재시도. */
  shouldRetry: (err: unknown, attempt: number) => boolean;
}

export const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 300,
  factor: 2,
  jitter: 0.3,
  maxDelayMs: 10000,
  shouldRetry: () => true,
};

export interface RetryDeps {
  /** setTimeout 주입 (테스트용). 기본 globalThis.setTimeout. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** 지터용 난수 [0,1). 기본 Math.random. */
  random?: () => number;
}

/**
 * 시도 n(0-based)에 대한 백오프 지연 ms 계산 — 지터 적용 전.
 * 공개해 테스트·로그에 활용.
 */
export function computeBackoffMs(attempt: number, policy: RetryPolicy, rand = Math.random): number {
  const raw = policy.baseDelayMs * Math.pow(policy.factor, attempt);
  const capped = Math.min(raw, policy.maxDelayMs);
  const sign = rand() < 0.5 ? -1 : 1;
  const jitterAmt = capped * policy.jitter * rand();
  return Math.max(0, Math.round(capped + sign * jitterAmt));
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RetryContext {
  attempt: number;    // 0-based
  lastError: unknown;
  signal?: AbortSignal;
}

/**
 * fn 을 재시도 정책대로 호출.
 * @throws 마지막 에러 (maxAttempts 소진) 또는 AbortError
 */
export async function withRetry<T>(
  fn: (ctx: RetryContext) => Promise<T>,
  policy: Partial<RetryPolicy> = {},
  deps: RetryDeps = {},
  signal?: AbortSignal,
): Promise<T> {
  const p: RetryPolicy = { ...DEFAULT_POLICY, ...policy };
  const sleep = deps.sleep ?? defaultSleep;
  const rand = deps.random ?? Math.random;
  let lastError: unknown = undefined;

  for (let attempt = 0; attempt < p.maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn({ attempt, lastError, signal });
    } catch (err) {
      lastError = err;
      const isLast = attempt === p.maxAttempts - 1;
      const retryable = p.shouldRetry(err, attempt);
      if (isLast || !retryable) throw err;
      const delay = computeBackoffMs(attempt, p, rand);
      await sleep(delay, signal);
    }
  }
  // unreachable — 루프가 항상 throw 또는 return
  throw lastError;
}

/** shouldRetry 헬퍼: 특정 에러 이름만 재시도. */
export function retryOnNames(...names: string[]): RetryPolicy['shouldRetry'] {
  const set = new Set(names);
  return (err) => {
    if (err && typeof err === 'object' && 'name' in err) {
      return set.has(String((err as { name?: unknown }).name));
    }
    return false;
  };
}
