/**
 * engine/composition/sequences/intro.ts
 *
 * Phase 5 wave1 — **인트로 시퀀스 빌더**.
 *
 * 어떤 템플릿이든 "촬영 시작 직전 2초" 인트로 레이어 세트를 동일 룩으로
 * 자동 생성하기 위한 헬퍼. 템플릿이 직접 layers 배열에 인트로 레이어를
 * 박아 넣는 것 보다, `buildIntroLayers({ title, accent })` 한 줄로 합성하면
 * 새 템플릿 추가 시 일관된 인트로를 보장.
 *
 * 구성 (총 4개 레이어):
 *   1. intro_flash      : beat_flash (전체 화면 짧은 화이트 플래시 0~0.3s)
 *   2. intro_kinetic    : kinetic_text (템플릿 타이틀, pop 모드)
 *   3. intro_countdown  : kinetic_text (3 → 2 → 1 → GO 카운트다운)
 *   4. intro_flare      : lens_flare (타이틀 뒤 글로우)
 *
 * 사용법:
 *   import { buildIntroLayers } from 'engine/composition/sequences/intro';
 *   const layers = [
 *     ...buildIntroLayers({ title: 'SQUAT × 10', accent: '#FFD23F' }),
 *     ...templateLayers,
 *   ];
 */
import type { BaseLayer } from '../../templates/schema';

export interface IntroOptions {
  /** 타이틀 텍스트 (필수). */
  title: string;
  /** 액센트 컬러. 기본 #FFD23F. */
  accent?: string;
  /** 인트로 시작 시각(초). 기본 0. */
  startSec?: number;
  /** 인트로 총 길이(초). 기본 2.4. */
  durationSec?: number;
  /** 카운트다운 표시 여부. 기본 true. */
  countdown?: boolean;
  /** zIndex 시작값. 기본 90 (HUD 보다 위). */
  baseZ?: number;
}

export function buildIntroLayers(opts: IntroOptions): BaseLayer[] {
  const accent = opts.accent ?? '#FFD23F';
  const start  = opts.startSec ?? 0;
  const dur    = opts.durationSec ?? 2.4;
  const baseZ  = opts.baseZ ?? 90;
  const countdown = opts.countdown !== false;
  const end = start + dur;

  const layers: BaseLayer[] = [
    {
      id: '__intro_flash',
      type: 'beat_flash',
      zIndex: baseZ,
      opacity: 1,
      enabled: true,
      props: { color: 'rgba(255,255,255,1)', maxAlpha: 0.6, manualIntensity: 1, curve: 'cubic' },
      activeRange: { startSec: start, endSec: start + 0.3 },
    },
    {
      id: '__intro_kinetic',
      type: 'kinetic_text',
      zIndex: baseZ + 2,
      opacity: 1,
      enabled: true,
      props: {
        text: opts.title,
        fontSize: 110,
        color: accent,
        strokeColor: 'rgba(0,0,0,0.85)',
        strokeWidth: 8,
        mode: 'pop',
        position: 'center',
        startMs: 200,
        staggerMs: 55,
      },
      activeRange: { startSec: start, endSec: end - (countdown ? 1.5 : 0) },
    },
    {
      id: '__intro_flare',
      type: 'lens_flare',
      zIndex: baseZ + 1,
      opacity: 0.55,
      enabled: true,
      props: { x: 540, y: 960, color: accent, size: 360 },
      activeRange: { startSec: start + 0.2, endSec: end - 0.2 },
    },
  ];

  if (countdown) {
    // GO 마지막 0.4s 강조
    layers.push({
      id: '__intro_countdown',
      type: 'kinetic_text',
      zIndex: baseZ + 3,
      opacity: 1,
      enabled: true,
      props: {
        text: 'GO!',
        fontSize: 180,
        color: '#FFFFFF',
        strokeColor: accent,
        strokeWidth: 10,
        mode: 'pop',
        position: 'center',
        startMs: 0,
        staggerMs: 0,
      },
      activeRange: { startSec: end - 0.6, endSec: end },
    });
  }

  return layers;
}
