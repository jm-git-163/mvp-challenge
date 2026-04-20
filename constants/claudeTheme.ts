/**
 * claudeTheme.ts
 * 중앙 디자인 토큰 — Anthropic Claude 시그니처 팔레트.
 * 모든 화면은 이 모듈에서 색/타이포/모양을 가져온다.
 */

export const Claude = {
  // Cream paper surfaces (light)
  paper: '#F7F3EB',       // primary cream
  paperDeep: '#EEE6D5',   // warmer cream
  paperEdge: '#E3D7BC',   // page-edge tint

  // Ink (dark text / tab shell)
  ink: '#1F1B16',         // near-black brown-ink
  inkSoft: '#3F2A1F',
  inkMuted: '#5C3A2E',
  inkFaint: '#8A5A3E',

  // Amber (signature accent)
  amber: '#CC785C',       // Claude signature burnt-coral
  amberDeep: '#A16244',
  amberGlow: 'rgba(204,120,92,0.35)',

  // Borders / hairlines
  hairline: 'rgba(161,98,68,0.22)',
  hairlineStrong: 'rgba(161,98,68,0.40)',

  // Semantic
  success: '#4F8060',
  warning: '#D8A85B',
  danger:  '#C15A5A',

  // Shell (dark areas that remain)
  shell:      '#0E0B06',  // very dark warm-black (instead of pure #0a0a0f)
  shellSoft:  '#1A140D',
} as const;

export const ClaudeFont = {
  serif:
    '"Tiempos Headline","Copernicus","Source Serif Pro",Georgia,"Times New Roman",serif',
  sans:
    '"Styrene A","Inter","SF Pro Text",-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
  mono:
    '"IBM Plex Mono","SF Mono",Menlo,Consolas,monospace',
} as const;

export const ClaudeRadius = {
  chip: 999,
  card: 18,
  hero: 22,
  panel: 14,
} as const;

export const ClaudeShadow = {
  paper:  '0 22px 48px -18px rgba(161,98,68,0.45), 0 2px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
  card:   '0 14px 32px -14px rgba(63,42,31,0.55), 0 1px 0 rgba(255,255,255,0.5) inset',
  lift:   '0 20px 40px -18px rgba(63,42,31,0.55)',
} as const;
