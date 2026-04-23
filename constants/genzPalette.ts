/**
 * genzPalette.ts
 * Gen-Z 컬러풀 디자인 토큰 — Korean women 18-30, TikTok/IG Stories vibe.
 *
 * Pretendard Variable + electric pink/cyan/lime + soft glass.
 * 기존 Claude 토큰을 대체하지 않고 보완 (Claude 는 자가진단/도구 화면에 잔존 가능).
 */

import { Platform } from 'react-native';

// ─── Core palette ────────────────────────────────────────────────────────────
export const GZ = {
  // 브랜드 시그니처 — electric pink + cyan + acid lime
  pink:       '#FF3D7F',  // 핫 마젠타, 메인 CTA
  pinkDeep:   '#E0246A',
  pinkSoft:   '#FF8AB6',
  cyan:       '#00E5FF',  // 일렉트릭 시안
  cyanSoft:   '#7FF1FF',
  lime:       '#C6FF00',  // 애시드 라임 (포인트)
  lilac:      '#B794F6',  // 라일락
  coral:      '#FF8A65',
  yellow:     '#FFE066',  // 하이라이트 텍스트
  violet:     '#8B5CF6',

  // 배경 — 어둡지 않고 라일락→코랄 그라데이션 베이스
  bg:         '#0F0A1F',  // 거의 검정 + 보라 기운 (다크 모드 폴백용)
  bgWeb:      'radial-gradient(120% 80% at 0% 0%, #2A1247 0%, #0F0A1F 55%, #1A0B2E 100%)',
  bgMesh:
    'radial-gradient(60% 40% at 12% 8%, rgba(255,61,127,0.35) 0%, rgba(255,61,127,0) 60%),' +
    'radial-gradient(45% 35% at 92% 18%, rgba(0,229,255,0.28) 0%, rgba(0,229,255,0) 65%),' +
    'radial-gradient(55% 45% at 78% 95%, rgba(198,255,0,0.20) 0%, rgba(198,255,0,0) 60%),' +
    'radial-gradient(70% 60% at 30% 95%, rgba(139,92,246,0.30) 0%, rgba(139,92,246,0) 70%),' +
    'linear-gradient(180deg, #150A28 0%, #0F0A1F 100%)',

  // 표면 — 글래스
  surface:        'rgba(255,255,255,0.08)',
  surfaceStrong:  'rgba(255,255,255,0.14)',
  surfaceSolid:   '#1B1130',
  surfaceCard:    'rgba(20,12,38,0.72)',

  // 보더
  border:         'rgba(255,255,255,0.18)',
  borderStrong:   'rgba(255,255,255,0.32)',
  borderHot:      'rgba(255,61,127,0.55)',

  // 텍스트
  ink:        '#FFFFFF',
  inkSub:     'rgba(255,255,255,0.78)',
  inkMuted:   'rgba(255,255,255,0.58)',
  inkFaint:   'rgba(255,255,255,0.38)',
  inkOnLight: '#160A2E',
  highlight:  '#FFE066',  // 노란 하이라이트

  // 시맨틱 — vivid
  success:    '#22F5A3',
  warning:    '#FFB020',
  danger:     '#FF4D6D',
  info:       '#00E5FF',
} as const;

// ─── Gradients (web CSS strings) ─────────────────────────────────────────────
export const GZGradient = {
  primary:   'linear-gradient(135deg, #FF3D7F 0%, #8B5CF6 50%, #00E5FF 100%)',
  hot:       'linear-gradient(135deg, #FF3D7F 0%, #FF8A65 100%)',
  electric:  'linear-gradient(135deg, #00E5FF 0%, #C6FF00 100%)',
  lilacCoral:'linear-gradient(135deg, #B794F6 0%, #FF8A65 100%)',
  text:      'linear-gradient(120deg, #FFE066 0%, #FF3D7F 50%, #00E5FF 100%)',
  glow:      'linear-gradient(135deg, rgba(255,61,127,0.45), rgba(0,229,255,0.45))',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
const PRETENDARD_STACK =
  '"Pretendard Variable",Pretendard,"Inter","SF Pro Text","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",-apple-system,BlinkMacSystemFont,system-ui,sans-serif';

export const GZFont = {
  sans: Platform.select({
    web:     PRETENDARD_STACK,
    default: 'System',
  }) as string,
  display: Platform.select({
    web:     PRETENDARD_STACK,
    default: 'System',
  }) as string,
  mono: Platform.select({
    web:     '"JetBrains Mono","SF Mono",Menlo,Consolas,monospace',
    default: 'Menlo',
  }) as string,
} as const;

// 사이즈 — 큰 점프, 중간 사이즈 없음
export const GZSize = {
  hero:    48,
  h1:      32,
  h2:      24,
  body:    16,
  small:   13,
  micro:   11,
} as const;

export const GZWeight = {
  black:    '900' as const,
  heavy:    '800' as const,
  bold:     '700' as const,
  semi:     '600' as const,
  med:      '500' as const,
};

// ─── Radius ──────────────────────────────────────────────────────────────────
export const GZRadius = {
  pill:   999,
  card:   24,   // rounded-2xl
  panel:  20,
  chip:   16,
  inner:  12,
} as const;

// ─── Shadows / glows ─────────────────────────────────────────────────────────
export const GZShadow = {
  card:    '0 18px 40px -16px rgba(255,61,127,0.35), 0 8px 16px -8px rgba(0,0,0,0.45)',
  glowPink:'0 0 0 1px rgba(255,61,127,0.45), 0 12px 36px -10px rgba(255,61,127,0.65)',
  glowCyan:'0 0 0 1px rgba(0,229,255,0.45), 0 12px 36px -10px rgba(0,229,255,0.55)',
  cta:     '0 14px 32px -10px rgba(255,61,127,0.65), 0 6px 18px -8px rgba(0,229,255,0.55)',
  panel:   '0 22px 48px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
} as const;
