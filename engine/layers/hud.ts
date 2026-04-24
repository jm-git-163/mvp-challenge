/**
 * engine/layers/hud.ts
 *
 * Phase 5g — HUD 레이어 **순수 계산** + Canvas 렌더러 팩토리.
 *
 * docs/COMPOSITION.md §3 HUD types: score_hud / counter_hud / timer_ring / mission_prompt.
 *
 * 순수 함수(timer arc / score tween / counter overshoot)만 test하고, Canvas 그리기는
 * 실 렌더에서만 검증 (Phase 5 체크리스트 수동 확인).
 */

import { tween, EASE } from '../design/motion';

// ── Timer Ring ──────────────────────────────────────────────
export interface TimerRingState {
  elapsedSec: number;
  totalSec: number;
}

/**
 * 남은 시간에 해당하는 호 각도(라디안). 12시 방향 시작, 시계 방향 감소.
 * 0..2π. 시간 끝나면 0.
 */
export function timerRingAngle(s: TimerRingState): number {
  if (s.totalSec <= 0) return 0;
  const remain = Math.max(0, s.totalSec - s.elapsedSec);
  return (remain / s.totalSec) * Math.PI * 2;
}

/** 5초 전부터 "위험" 표시. */
export function timerIsCritical(s: TimerRingState): boolean {
  return s.totalSec - s.elapsedSec <= 5;
}

// ── Counter HUD ─────────────────────────────────────────────
/**
 * 카운트 증가 시 overshoot 스케일 애니메이션.
 * @param ageMs 숫자 변경된 이후 경과 ms
 * @returns 현재 scale (1 → 1.3 → 1 형태)
 */
export function counterOvershoot(ageMs: number, durationMs = 240): number {
  if (ageMs < 0 || ageMs >= durationMs) return 1;
  const t = ageMs / durationMs;
  const eased = EASE.overshoot(t);
  // 시작 1 → 피크 1.3 근처 → 종료 1
  // overshoot easing은 끝에 1로 수렴하므로, 1 + 0.3 * "peak envelope"
  const envelope = t < 0.5 ? t * 2 : (1 - t) * 2;
  return 1 + 0.3 * envelope * eased;
}

// ── Score HUD ───────────────────────────────────────────────
/**
 * 점수 카운트업: 이전 점수 → 새 점수로 durationMs 동안 보간.
 */
export function scoreCountUp(prev: number, next: number, elapsedMs: number, durationMs = 600): number {
  return Math.round(tween(prev, next, elapsedMs, durationMs, 'standard'));
}

// ── Mission Prompt ──────────────────────────────────────────
/**
 * 등장 2초 유지 후 페이드아웃 300ms. 반환값은 alpha 0..1.
 */
export function missionPromptAlpha(elapsedMs: number, visibleMs = 2000, fadeMs = 300): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < fadeMs) return elapsedMs / fadeMs; // 페이드 인
  if (elapsedMs < fadeMs + visibleMs) return 1;
  const outElapsed = elapsedMs - fadeMs - visibleMs;
  if (outElapsed < fadeMs) return 1 - outElapsed / fadeMs;
  return 0;
}

/** 프롬프트 위치 (세이프 영역 하단 16% 위쪽, 중앙 정렬). */
export function missionPromptPosition(canvasW: number, canvasH: number): { x: number; y: number } {
  return { x: canvasW / 2, y: canvasH * (1 - 0.18) };
}
