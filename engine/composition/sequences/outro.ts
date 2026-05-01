/**
 * engine/composition/sequences/outro.ts
 *
 * Phase 5 wave1 — **아웃트로 시퀀스 빌더**.
 *
 * 촬영 종료 후 마지막 3초간 보여줄 결과 카드 레이어 세트.
 *   1. outro_flash    : 비트 플래시 (성공 시 액센트, 실패 시 빨강)
 *   2. outro_score    : score_hud 확대 — 총점 큰 숫자 + 별점
 *   3. outro_kinetic  : kinetic_text "결과 보러가기"
 *   4. outro_flare    : lens_flare (성공 시)
 *   5. outro_burst    : particle_burst (성공 시)
 *
 * 점수는 state.totalScore (0..100) 와 state.starRating (1..5) 가
 * compositor 측에서 주입되어 있어야 함.
 */
import type { BaseLayer } from '../../templates/schema';

export interface OutroOptions {
  /** 아웃트로 시작 시각(초). 보통 템플릿 duration - 3. */
  startSec: number;
  /** 아웃트로 길이(초). 기본 3. */
  durationSec?: number;
  /** 액센트 컬러. */
  accent?: string;
  /** zIndex 시작값. 기본 92. */
  baseZ?: number;
  /** CTA 텍스트. 기본 "결과 보러가기 →". */
  ctaText?: string;
}

export function buildOutroLayers(opts: OutroOptions): BaseLayer[] {
  const dur     = opts.durationSec ?? 3;
  const accent  = opts.accent ?? '#FFD23F';
  const baseZ   = opts.baseZ ?? 92;
  const cta     = opts.ctaText ?? '결과 보러가기 →';
  const start   = opts.startSec;
  const end     = start + dur;

  return [
    {
      id: '__outro_flash',
      type: 'beat_flash',
      zIndex: baseZ,
      opacity: 1,
      enabled: true,
      props: { color: accent, maxAlpha: 0.45, manualIntensity: 1, curve: 'cubic' },
      activeRange: { startSec: start, endSec: start + 0.4 },
    },
    {
      id: '__outro_score',
      type: 'score_hud',
      zIndex: baseZ + 2,
      opacity: 1,
      enabled: true,
      props: {
        position: 'center',
        label: 'TOTAL',
        fontSize: 180,
        labelFontSize: 36,
        color: accent,
        showStars: true,
        starsBelow: true,
      },
      activeRange: { startSec: start + 0.2, endSec: end },
    },
    {
      id: '__outro_kinetic',
      type: 'kinetic_text',
      zIndex: baseZ + 3,
      opacity: 1,
      enabled: true,
      props: {
        text: cta,
        fontSize: 56,
        color: '#FFFFFF',
        strokeColor: 'rgba(0,0,0,0.85)',
        strokeWidth: 4,
        mode: 'fade',
        position: 'bottom-center',
        startMs: 800,
        staggerMs: 28,
      },
      activeRange: { startSec: start + 1.0, endSec: end },
    },
    {
      id: '__outro_flare',
      type: 'lens_flare',
      zIndex: baseZ + 1,
      opacity: 0.6,
      enabled: true,
      props: { x: 540, y: 960, color: accent, size: 460 },
      activeRange: { startSec: start + 0.3, endSec: end - 0.3 },
    },
    {
      id: '__outro_burst',
      type: 'particle_burst',
      zIndex: baseZ + 4,
      opacity: 1,
      enabled: true,
      props: { count: 80, colors: [accent, '#FFFFFF'], cx: 540, cy: 960, lifeSec: 1.4 },
      activeRange: { startSec: start, endSec: start + 1.4 },
    },
  ];
}
