import { describe, it, expect, vi } from 'vitest';
import { withRetry, computeBackoffMs, retryOnNames, DEFAULT_POLICY } from './retry';

describe('computeBackoffMs', () => {
  it('0차 시도 = baseDelayMs (rand=0.5 → sign=±, jitter 0 가정)', () => {
    // rand() 반복 호출: 첫 번째 = sign 결정(0.5 → sign=+1), 두 번째 = jitter 배율(0 → 0)
    const values = [0.5, 0];
    const rand = () => values.shift() ?? 0;
    const d = computeBackoffMs(0, DEFAULT_POLICY, rand);
    expect(d).toBe(300);
  });
  it('지수 증가', () => {
    const rand = () => 0; // sign=-1, jitter=0
    expect(computeBackoffMs(0, DEFAULT_POLICY, rand)).toBe(300);
    expect(computeBackoffMs(1, DEFAULT_POLICY, rand)).toBe(600);
    expect(computeBackoffMs(2, DEFAULT_POLICY, rand)).toBe(1200);
  });
  it('상한 적용', () => {
    const rand = () => 0;
    expect(computeBackoffMs(20, { ...DEFAULT_POLICY, maxDelayMs: 2000 }, rand)).toBe(2000);
  });
  it('지터는 음수가 되지 않음', () => {
    const rand = () => 1; // sign=+1, jitter 최대
    const d = computeBackoffMs(0, DEFAULT_POLICY, rand);
    expect(d).toBeGreaterThanOrEqual(0);
  });
});

describe('withRetry', () => {
  it('첫 시도 성공 시 재시도 없음', async () => {
    const fn = vi.fn(async () => 'ok');
    const sleep = vi.fn(async () => {});
    const r = await withRetry(fn, {}, { sleep });
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('두 번째에 성공', async () => {
    let i = 0;
    const fn = vi.fn(async () => {
      i++;
      if (i === 1) throw new Error('first fail');
      return 'ok';
    });
    const sleep = vi.fn(async () => {});
    const r = await withRetry(fn, { maxAttempts: 3 }, { sleep, random: () => 0 });
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('모두 실패 시 마지막 에러 throw', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    const sleep = vi.fn(async () => {});
    await expect(
      withRetry(fn, { maxAttempts: 3 }, { sleep, random: () => 0 }),
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('shouldRetry=false 면 즉시 throw', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal');
    });
    const sleep = vi.fn(async () => {});
    await expect(
      withRetry(fn, { maxAttempts: 5, shouldRetry: () => false }, { sleep }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('AbortSignal aborted 초기 체크', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fn = vi.fn(async () => 'ok');
    await expect(withRetry(fn, {}, {}, ctrl.signal)).rejects.toThrow(/Aborted/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('ctx.attempt 가 0,1,2 로 증가', async () => {
    const seenAttempts: number[] = [];
    let i = 0;
    const fn = vi.fn(async (ctx: { attempt: number }) => {
      seenAttempts.push(ctx.attempt);
      i++;
      if (i < 3) throw new Error('again');
      return 'done';
    });
    const sleep = vi.fn(async () => {});
    await withRetry(fn, { maxAttempts: 3 }, { sleep, random: () => 0 });
    expect(seenAttempts).toEqual([0, 1, 2]);
  });
});

describe('retryOnNames', () => {
  it('이름 일치 → true', () => {
    const p = retryOnNames('NetworkError', 'TimeoutError');
    expect(p({ name: 'NetworkError' }, 0)).toBe(true);
    expect(p({ name: 'TimeoutError' }, 0)).toBe(true);
    expect(p({ name: 'FatalError' }, 0)).toBe(false);
  });
  it('name 없으면 false', () => {
    expect(retryOnNames('X')({}, 0)).toBe(false);
    expect(retryOnNames('X')('str', 0)).toBe(false);
  });
});
