import { describe, it, expect } from 'vitest';
import { COLORS, parseColor, rgbaString, TYPO, CANVAS, GLASS_CARD, neonGlow, SAFE_AREA } from './tokens';

describe('tokens: 색 파싱', () => {
  it('#RRGGBB 파싱', () => {
    const c = parseColor('#FF2D95');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(45 / 255, 2);
    expect(c.b).toBeCloseTo(149 / 255, 2);
    expect(c.a).toBe(1);
  });
  it('#RGB 파싱', () => {
    const c = parseColor('#0F0');
    expect(c.g).toBe(1);
    expect(c.r).toBe(0);
  });
  it('rgba(...) 파싱', () => {
    const c = parseColor('rgba(10,14,39,0.6)');
    expect(c.a).toBe(0.6);
    expect(c.b).toBeCloseTo(39 / 255, 3);
  });
  it('불량 입력은 throw', () => {
    expect(() => parseColor('not-a-color')).toThrow();
  });
  it('rgbaString(hex, a)는 합성 rgba 문자열', () => {
    expect(rgbaString('#FF2D95', 0.5)).toBe('rgba(255,45,149,0.5)');
    expect(rgbaString('#000', 1.5)).toBe('rgba(0,0,0,1)'); // 클램프
  });
});

describe('tokens: 필수 상수', () => {
  it('팔레트가 docs/VISUAL_DESIGN §2 값과 일치', () => {
    expect(COLORS.neonPink).toBe('#FF2D95');
    expect(COLORS.electricBlue).toBe('#00E0FF');
    expect(COLORS.acidGreen).toBe('#39FF7D');
  });
  it('타이포 스케일이 docs 값과 일치', () => {
    expect(TYPO.display.size).toBe(72);
    expect(TYPO.score.mono).toBe(true);
  });
  it('캔버스 1080x1920', () => {
    expect(CANVAS.width).toBe(1080);
    expect(CANVAS.height).toBe(1920);
  });
  it('safe area 상단 12%, 하단 16%', () => {
    expect(SAFE_AREA.topPct).toBe(0.12);
    expect(SAFE_AREA.bottomPct).toBe(0.16);
  });
});

describe('tokens: 효과 레시피', () => {
  it('GLASS_CARD가 blur/saturate 포함', () => {
    expect(GLASS_CARD.backdropFilter).toContain('blur(20px)');
    expect(GLASS_CARD.backdropFilter).toContain('saturate(180%)');
  });
  it('neonGlow가 3단 그림자 생성', () => {
    const g = neonGlow('#FF2D95');
    expect(g.split(',').length).toBeGreaterThanOrEqual(3);
    expect(g).toContain('#FF2D95');
    expect(g).toContain('rgba(255,45,149,0.4)');
  });
});
