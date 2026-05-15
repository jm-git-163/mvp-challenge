/**
 * engine/design/tokens.ts
 *
 * docs/VISUAL_DESIGN.md §2~7 디자인 토큰의 **단일 진실 공급원**.
 * 프레임워크 중립 — Tailwind/CSS 변수·React Native StyleSheet·Canvas 어디서든 참조 가능.
 *
 * CLAUDE.md §11: 토큰 변경은 사용자 승인 필요 (docs/VISUAL_DESIGN.md 명시).
 */

// ── 색 팔레트 ──────────────────────────────────────────────────
export const COLORS = {
  // 배경·서피스
  bgBase: '#050814',
  bgElevated: '#0A0E27',
  bgGlass: 'rgba(10,14,39,0.6)',
  bgOverlay: 'rgba(0,0,0,0.75)',

  // 액센트 (템플릿 무드)
  neonPink: '#FF2D95',
  electricBlue: '#00E0FF',
  acidGreen: '#39FF7D',
  sunsetOrange: '#FF8A3D',
  royalPurple: '#8B5CF6',
  newsGold: '#D4AF37',

  // 텍스트
  textPrimary: '#FFFFFF',
  textSecondary: '#A0AEC0',
  textMuted: '#4A5568',
  textOnAccent: '#050814',

  // 상태
  success: '#00FFB2',
  warning: '#FFB800',
  danger: '#FF3B5C',
} as const;
export type ColorToken = keyof typeof COLORS;

// RGBA hex → {r,g,b,a} (0..1). 저수준 그라디언트/글로우 합성용.
export function parseColor(v: string): { r: number; g: number; b: number; a: number } {
  const s = v.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const parse = (h: string) => parseInt(h, 16);
    if (hex.length === 3) {
      return { r: parse(hex[0] + hex[0]) / 255, g: parse(hex[1] + hex[1]) / 255, b: parse(hex[2] + hex[2]) / 255, a: 1 };
    }
    if (hex.length === 6) {
      return { r: parse(hex.slice(0, 2)) / 255, g: parse(hex.slice(2, 4)) / 255, b: parse(hex.slice(4, 6)) / 255, a: 1 };
    }
    if (hex.length === 8) {
      return { r: parse(hex.slice(0, 2)) / 255, g: parse(hex.slice(2, 4)) / 255, b: parse(hex.slice(4, 6)) / 255, a: parse(hex.slice(6, 8)) / 255 };
    }
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i.exec(s);
  if (m) {
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] !== undefined ? +m[4] : 1 };
  }
  throw new Error(`parseColor: 인식 불가 형식 "${v}"`);
}

export function rgbaString(hex: string, alpha: number): string {
  const c = parseColor(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ── 타이포그래피 ───────────────────────────────────────────────
export const FONTS = {
  sans: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;

export const TYPO = {
  display:  { size: 72, weight: 800, tracking: -0.02, lineHeight: 1.1 },
  h1:       { size: 48, weight: 800, tracking: -0.01, lineHeight: 1.1 },
  h2:       { size: 32, weight: 700, tracking: -0.005, lineHeight: 1.15 },
  h3:       { size: 24, weight: 700, tracking: 0, lineHeight: 1.2 },
  bodyLg:   { size: 18, weight: 500, tracking: 0, lineHeight: 1.5 },
  body:     { size: 16, weight: 400, tracking: 0, lineHeight: 1.5 },
  caption:  { size: 14, weight: 500, tracking: 0, lineHeight: 1.4 },
  micro:    { size: 12, weight: 600, tracking: 0.01, lineHeight: 1.3 },
  score:    { size: 56, weight: 900, tracking: 0, lineHeight: 1.0, mono: true },
} as const;
export type TypoScale = keyof typeof TYPO;

// ── 스페이싱·반경 ──────────────────────────────────────────────
export const SPACING = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 } as const;
export const RADIUS = { none: 0, sm: 8, md: 12, lg: 16, xl: 20, full: 9999 } as const;

// ── 안전 영역 (9:16 기준) ──────────────────────────────────────
export const SAFE_AREA = {
  topPct: 0.12,    // 상단 12% HUD 배치 구역
  bottomPct: 0.16, // 하단 16% 자막 배치 구역
} as const;

// ── 캔버스 기준 크기 ───────────────────────────────────────────
export const CANVAS = {
  width: 1080,
  height: 1920,
  aspect: 9 / 16,
} as const;

// ── 효과 레시피 ────────────────────────────────────────────────
/** 글래스 카드 shadow 레시피 (docs/VISUAL_DESIGN §5.1). */
export const GLASS_CARD = {
  background: COLORS.bgGlass,
  backdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: [
    '0 8px 32px rgba(0,0,0,0.4)',
    'inset 0 1px 0 rgba(255,255,255,0.08)',
  ].join(','),
  borderRadius: RADIUS.xl,
} as const;

/** 네온 글로우 (accent 색 기준). */
export function neonGlow(accentHex: string): string {
  return [
    `0 0 0 1px ${accentHex}`,
    `0 0 20px ${accentHex}`,
    `0 0 60px ${rgbaString(accentHex, 0.4)}`,
  ].join(',');
}
