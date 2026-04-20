/**
 * engine/recording/codecNegotiator.ts
 *
 * Phase 3 — 녹화 코덱 · 비트레이트 네고시에이션.
 *
 * docs/COMPATIBILITY §2:
 *   - iOS Safari: mp4 우선 (avc1+mp4a)
 *   - Android Chrome: webm (vp9 > vp8)
 *   - Firefox: webm only
 *   - 코덱 하드코딩 금지 (CLAUDE §3 #16).
 *
 * docs/PERFORMANCE §3 디바이스 tier별 비트레이트:
 *   - high: 3_500_000 (30fps 1080p)
 *   - mid:  2_000_000
 *   - low:  1_000_000
 */

import { MIME_CANDIDATES } from '../session/compatibilityCheck';

export type DeviceTier = 'high' | 'mid' | 'low';

export interface CodecSelection {
  mimeType: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  /** 1초 청크(ms). docs/PERFORMANCE §3 권장. */
  timesliceMs: number;
}

export interface NegotiateDeps {
  isTypeSupported?: (t: string) => boolean;
  /** 저사양 감지 결과. 없으면 'mid'. */
  tier?: DeviceTier;
}

export const BITRATE_BY_TIER: Record<DeviceTier, { video: number; audio: number }> = {
  high: { video: 3_500_000, audio: 128_000 },
  mid:  { video: 2_000_000, audio: 96_000 },
  low:  { video: 1_000_000, audio: 64_000 },
};

export interface NegotiateResult {
  ok: true;
  selection: CodecSelection;
}
export interface NegotiateFailure {
  ok: false;
  reason: string;
}

export function negotiateCodec(deps: NegotiateDeps = {}): NegotiateResult | NegotiateFailure {
  const isTypeSupported = deps.isTypeSupported
    ?? (typeof MediaRecorder !== 'undefined'
        ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
        : undefined);
  if (!isTypeSupported) {
    return { ok: false, reason: 'MediaRecorder API unavailable' };
  }

  let mimeType: string | null = null;
  for (const c of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(c)) { mimeType = c; break; }
    } catch { /* 일부 브라우저 unsupported mime throw */ }
  }
  if (!mimeType) {
    return { ok: false, reason: '지원되는 녹화 코덱이 없습니다.' };
  }

  const tier = deps.tier ?? 'mid';
  const br = BITRATE_BY_TIER[tier];
  return {
    ok: true,
    selection: {
      mimeType,
      videoBitsPerSecond: br.video,
      audioBitsPerSecond: br.audio,
      timesliceMs: 1000,
    },
  };
}

/**
 * 디바이스 tier 자동 추정. docs/PERFORMANCE §2:
 *   - deviceMemory (Chrome) + hardwareConcurrency 기반
 *   - iOS는 정보 제공 안 함 → 기본 mid, iOS 16.4+ 이면서 최신 iPhone 가정 시 high 가능
 */
export function estimateTier(nav: Partial<Navigator> = typeof navigator !== 'undefined' ? navigator : {}): DeviceTier {
  const mem = (nav as { deviceMemory?: number }).deviceMemory;
  const cpu = nav.hardwareConcurrency;
  if (typeof mem === 'number') {
    if (mem >= 6 && (cpu ?? 0) >= 6) return 'high';
    if (mem >= 3) return 'mid';
    return 'low';
  }
  // 정보 없음 (iOS): CPU로만 판단
  if ((cpu ?? 0) >= 6) return 'high';
  if ((cpu ?? 0) >= 4) return 'mid';
  return 'low';
}
