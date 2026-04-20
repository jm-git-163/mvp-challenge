/**
 * engine/layers/text.ts
 *
 * Phase 5h — 텍스트 레이어 **순수 계산**.
 *
 * docs/COMPOSITION.md §3:
 *   - kinetic_text: 글자 단위 등장 애니메이션
 *   - karaoke_caption: 음성 실시간 자막 (음절별 하이라이트)
 *   - beat_text: 비트에 맞춰 scale 펄스
 *   - news_ticker: 하단 스크롤 뉴스
 *   - banner_badge: 고정 배지
 *
 * 순수 계산만 이 파일에 위치. 실제 Canvas 드로잉은 레이어 어댑터에서.
 */

import { EASE, tween, type EasingToken } from '../design/motion';

// ── Kinetic Text ────────────────────────────────────────────
/**
 * 글자 단위 bounce 등장. i번째 글자는 `perCharDelayMs * i` 이후 등장.
 * 반환: { alpha, scale, translateY } 글자별.
 */
export interface KineticCharState { alpha: number; scale: number; translateY: number; }

export function kineticCharStates(
  text: string,
  elapsedMs: number,
  perCharDelayMs = 70,
  charDurationMs = 400,
): KineticCharState[] {
  const out: KineticCharState[] = [];
  for (let i = 0; i < text.length; i++) {
    const localElapsed = elapsedMs - perCharDelayMs * i;
    if (localElapsed <= 0) { out.push({ alpha: 0, scale: 0.6, translateY: 16 }); continue; }
    if (localElapsed >= charDurationMs) { out.push({ alpha: 1, scale: 1, translateY: 0 }); continue; }
    const t = localElapsed / charDurationMs;
    const e = EASE.overshoot(t);
    out.push({
      alpha: Math.min(1, t * 2),
      scale: 0.6 + 0.4 * e,
      translateY: 16 * (1 - e),
    });
  }
  return out;
}

// ── Karaoke Caption ─────────────────────────────────────────
/**
 * 카라오케 자막 상태 계산.
 * @param script 전체 문장. 어절 단위로 split.
 * @param spokenSoFar 현재까지 인식된 텍스트.
 * @returns 어절별 { text, state: 'spoken'|'matched'|'pending' }
 *   - matched: spoken 안에 포함된 어절 (대소문자 무시 prefix 일치)
 *   - spoken: 현재 말하고 있는 어절 (하이라이트)
 *   - pending: 아직 안 읽은 어절 (흐리게)
 */
export type KaraokeWordState = 'matched' | 'spoken' | 'pending';
export interface KaraokeWord { text: string; state: KaraokeWordState; }

export function karaokeState(script: string, spokenSoFar: string): KaraokeWord[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  const spoken = spokenSoFar.trim();
  const spokenWords = spoken.split(/\s+/).filter(Boolean);
  const out: KaraokeWord[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i < spokenWords.length - 1) {
      out.push({ text: words[i], state: 'matched' });
    } else if (i === spokenWords.length - 1 && spokenWords.length > 0) {
      // 현재 말하는 중
      out.push({ text: words[i], state: 'spoken' });
    } else {
      out.push({ text: words[i], state: 'pending' });
    }
  }
  return out;
}

// ── Beat Text ───────────────────────────────────────────────
/**
 * 비트마다 scale pulse 1 → 1+amount → 1.
 * @param timeSinceLastBeatMs 마지막 비트 이후 경과 ms
 * @param beatPeriodMs 비트 주기 (예: 120bpm = 500ms)
 * @param amount 피크 증가량 (0.15 = 최대 1.15)
 */
export function beatTextScale(timeSinceLastBeatMs: number, beatPeriodMs: number, amount = 0.15): number {
  if (beatPeriodMs <= 0) return 1;
  const pulseMs = 200;
  if (timeSinceLastBeatMs < 0 || timeSinceLastBeatMs >= pulseMs) return 1;
  const t = timeSinceLastBeatMs / pulseMs;
  const env = t < 0.5 ? t * 2 : (1 - t) * 2;
  return 1 + amount * env;
}

// ── News Ticker ─────────────────────────────────────────────
/**
 * 뉴스 티커 X 오프셋. 시간 경과에 따라 왼쪽으로 흘러감.
 * 텍스트 너비 + 캔버스 너비 만큼 이동 후 반복.
 * @param speedPxPerSec 스크롤 속도
 * @param elapsedMs 경과
 * @param totalTextWidth 텍스트+여백 너비(px)
 * @param canvasW 캔버스 너비
 */
export function newsTickerOffset(elapsedMs: number, speedPxPerSec: number, totalTextWidth: number, canvasW: number): number {
  const cycle = totalTextWidth + canvasW;
  if (cycle <= 0) return 0;
  const dx = (elapsedMs / 1000) * speedPxPerSec;
  return canvasW - (dx % cycle);
}

// ── Text Tween Helper ───────────────────────────────────────
export function interpolatedPosition(
  fromX: number, fromY: number,
  toX: number, toY: number,
  elapsedMs: number, durationMs: number,
  ease: EasingToken = 'standard',
): { x: number; y: number } {
  return {
    x: tween(fromX, toX, elapsedMs, durationMs, ease),
    y: tween(fromY, toY, elapsedMs, durationMs, ease),
  };
}
