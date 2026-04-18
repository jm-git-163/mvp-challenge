// utils/videoCompositor.ts
// Real-time canvas compositor — 720×1280, 15 fps via requestAnimationFrame.
// The template is a PRE-MADE VIDEO SHELL; the user clip is one ingredient.

import {
  VideoTemplate,
  TextOverlay,
  TemplateZone,
  BgmSpec,
  ClipArea,
} from './videoTemplates';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RecordedClip {
  slot_id: string;
  blob: Blob;
  duration_ms: number;
}

export interface CompositorProgress {
  phase: string;
  percent: number;
}

// ---------------------------------------------------------------------------
// Canvas dimensions
// ---------------------------------------------------------------------------

const W = 720;
const H = 1280;
const FPS = 15;
const FRAME_MS = 1000 / FPS;
const INTRO_MS = 4000;   // 4-second pre-made intro animation (countdown + branding)
const OUTRO_MS = 3000;   // 3-second outro celebration (trophy + hashtags)

// ---------------------------------------------------------------------------
// Helper: rounded-rect path (no roundRect API dependency)
// ---------------------------------------------------------------------------

function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.lineTo(x + w - safeR, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
  ctx.lineTo(x + w, y + h - safeR);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
  ctx.lineTo(x + safeR, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
  ctx.lineTo(x, y + safeR);
  ctx.quadraticCurveTo(x, y, x + safeR, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Scene background drawers
// ---------------------------------------------------------------------------

function drawVlogScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Multi-layer bokeh circles
  const bokehData = [
    { x: 0.15, y: 0.12, r: 80, alpha: 0.10 },
    { x: 0.85, y: 0.08, r: 60, alpha: 0.08 },
    { x: 0.05, y: 0.45, r: 100, alpha: 0.07 },
    { x: 0.92, y: 0.55, r: 90, alpha: 0.09 },
    { x: 0.30, y: 0.90, r: 120, alpha: 0.08 },
    { x: 0.70, y: 0.88, r: 70, alpha: 0.10 },
    { x: 0.50, y: 0.05, r: 50, alpha: 0.12 },
    { x: 0.20, y: 0.70, r: 85, alpha: 0.07 },
    { x: 0.78, y: 0.30, r: 65, alpha: 0.09 },
    { x: 0.45, y: 0.60, r: 55, alpha: 0.08 },
    { x: 0.60, y: 0.20, r: 75, alpha: 0.10 },
    { x: 0.10, y: 0.85, r: 95, alpha: 0.07 },
    { x: 0.88, y: 0.75, r: 45, alpha: 0.12 },
    { x: 0.35, y: 0.35, r: 110, alpha: 0.06 },
    { x: 0.65, y: 0.65, r: 88, alpha: 0.08 },
    { x: 0.25, y: 0.55, r: 60, alpha: 0.11 },
    { x: 0.75, y: 0.50, r: 70, alpha: 0.09 },
    { x: 0.50, y: 0.80, r: 100, alpha: 0.07 },
    { x: 0.12, y: 0.25, r: 55, alpha: 0.13 },
    { x: 0.90, y: 0.40, r: 80, alpha: 0.08 },
  ];

  for (let i = 0; i < bokehData.length; i++) {
    const b = bokehData[i];
    const ox = Math.sin(elapsed * 0.0003 + i * 0.7) * 12;
    const oy = Math.cos(elapsed * 0.0004 + i * 0.5) * 10;
    const cx = b.x * canvasW + ox;
    const cy = b.y * canvasH + oy;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
    grad.addColorStop(0, `rgba(200,180,255,${b.alpha + 0.04})`);
    grad.addColorStop(1, 'rgba(200,180,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diagonal light streaks
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const xStart = -200 + i * 150 + Math.sin(elapsed * 0.0002 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(xStart, 0);
    ctx.lineTo(xStart + canvasH * 0.6, canvasH);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNewsScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Studio floor perspective grid from bottom-center vanishing point
  ctx.save();
  ctx.strokeStyle = 'rgba(100,150,255,0.05)';
  ctx.lineWidth = 1;
  const vpX = canvasW / 2;
  const vpY = canvasH * 0.85;
  for (let i = -6; i <= 6; i++) {
    const endX = i * 80;
    ctx.beginPath();
    ctx.moveTo(vpX, vpY);
    ctx.lineTo(vpX + endX, canvasH);
    ctx.stroke();
  }
  // Horizontal floor lines
  for (let row = 0; row < 5; row++) {
    const fy = vpY + (canvasH - vpY) * (row / 5);
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(canvasW, fy);
    ctx.stroke();
  }
  ctx.restore();

  // Vertical blue light bars on sides
  const barPulse = 0.08 + Math.sin(elapsed * 0.003) * 0.04;
  ctx.fillStyle = `rgba(21,101,192,${barPulse})`;
  ctx.fillRect(0, canvasH * 0.15, 2, canvasH * 0.7);
  ctx.fillRect(canvasW - 2, canvasH * 0.15, 2, canvasH * 0.7);

  // Blue glow halos on bars
  const glowGradL = ctx.createLinearGradient(0, 0, 20, 0);
  glowGradL.addColorStop(0, `rgba(21,101,192,${barPulse * 0.8})`);
  glowGradL.addColorStop(1, 'rgba(21,101,192,0)');
  ctx.fillStyle = glowGradL;
  ctx.fillRect(0, canvasH * 0.15, 20, canvasH * 0.7);

  const glowGradR = ctx.createLinearGradient(canvasW, 0, canvasW - 20, 0);
  glowGradR.addColorStop(0, `rgba(21,101,192,${barPulse * 0.8})`);
  glowGradR.addColorStop(1, 'rgba(21,101,192,0)');
  ctx.fillStyle = glowGradR;
  ctx.fillRect(canvasW - 20, canvasH * 0.15, 20, canvasH * 0.7);

  // Scan line effect
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.02)';
  for (let y = 0; y < canvasH; y += 4) {
    ctx.fillRect(0, y, canvasW, 1);
  }
  ctx.restore();

  // Top-right network logo area
  ctx.save();
  ctx.fillStyle = 'rgba(5,15,40,0.85)';
  ctx.strokeStyle = 'rgba(21,101,192,0.5)';
  ctx.lineWidth = 1;
  const logoX = canvasW - 90;
  const logoY = 14;
  const logoW = 76;
  const logoH = 36;
  rrPath(ctx, logoX, logoY, logoW, logoH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CH NEWS', logoX + logoW / 2, logoY + 14);
  ctx.fillStyle = '#93c5fd';
  ctx.font = '9px sans-serif';
  ctx.fillText('24/7 LIVE', logoX + logoW / 2, logoY + 28);
  ctx.restore();
}

function drawKpopScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // City silhouette at bottom 25%
  ctx.save();
  ctx.fillStyle = 'rgba(5,0,20,0.8)';
  const buildings = [
    { x: 0, w: 60, h: 180 },
    { x: 50, w: 45, h: 240 },
    { x: 90, w: 70, h: 160 },
    { x: 155, w: 50, h: 200 },
    { x: 200, w: 80, h: 140 },
    { x: 275, w: 55, h: 220 },
    { x: 325, w: 40, h: 170 },
    { x: 360, w: 75, h: 250 },
    { x: 430, w: 50, h: 180 },
    { x: 475, w: 65, h: 130 },
    { x: 535, w: 55, h: 210 },
    { x: 585, w: 80, h: 160 },
    { x: 660, w: 60, h: 190 },
  ];
  const floorY = canvasH;
  for (const b of buildings) {
    ctx.fillRect(b.x, floorY - b.h, b.w, b.h);
  }
  ctx.restore();

  // Stage lights: cone shapes from top
  const lightColors = [
    { r: 233, g: 69, b: 96 },   // pink
    { r: 100, g: 140, b: 255 }, // blue
    { r: 255, g: 255, b: 255 }, // white
    { r: 255, g: 200, b: 0 },   // gold
    { r: 180, g: 0, b: 255 },   // purple
    { r: 0, g: 220, b: 150 },   // teal
  ];
  const lightSources = [0.1, 0.3, 0.5, 0.7, 0.85, 0.95];
  ctx.save();
  for (let i = 0; i < lightSources.length; i++) {
    const baseAngle = Math.PI / 3 + (i / lightSources.length) * Math.PI / 3;
    const sweep = Math.sin(elapsed * 0.001 + i * 1.2) * 0.3;
    const angle = baseAngle + sweep;
    const lx = lightSources[i] * canvasW;
    const ly = 0;
    const length = canvasH * 0.65;
    const ex = lx + Math.cos(angle) * length;
    const ey = ly + Math.sin(angle) * length;
    const c = lightColors[i % lightColors.length];
    const coneGrad = ctx.createLinearGradient(lx, ly, ex, ey);
    coneGrad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.18)`);
    coneGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    const perpAngle = angle + Math.PI / 2;
    const spread = length * 0.22;
    ctx.lineTo(ex + Math.cos(perpAngle) * spread, ey + Math.sin(perpAngle) * spread);
    ctx.lineTo(ex - Math.cos(perpAngle) * spread, ey - Math.sin(perpAngle) * spread);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Neon glow horizontal lines
  const glowHeights = [0.30, 0.60, 0.80];
  const glowCols = ['rgba(233,69,96,0.25)', 'rgba(100,140,255,0.20)', 'rgba(233,69,96,0.18)'];
  ctx.save();
  for (let i = 0; i < glowHeights.length; i++) {
    const gy = glowHeights[i] * canvasH;
    const pulse = Math.sin(elapsed * 0.002 + i * 2) * 0.08 + 0.15;
    ctx.shadowColor = glowCols[i];
    ctx.shadowBlur = 12;
    ctx.strokeStyle = glowCols[i].replace(/[\d.]+\)$/, `${pulse})`);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(canvasW, gy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // Falling sparkle particles
  ctx.save();
  const sparkleColors = ['#e94560', '#fbbf24', '#fff', '#a78bfa', '#60a5fa'];
  for (let i = 0; i < 15; i++) {
    const speed = 0.03 + (i % 5) * 0.015;
    const baseX = ((i * 0.137 + 0.05) % 1) * canvasW;
    const rawY = (elapsed * speed * 0.1 + i * 90) % canvasH;
    const sy = rawY;
    const sx = baseX + Math.sin(elapsed * 0.001 + i) * 18;
    const alpha = 0.5 + Math.sin(elapsed * 0.003 + i * 0.8) * 0.4;
    ctx.fillStyle = sparkleColors[i % sparkleColors.length]
      .replace(')', `, ${Math.max(0.05, alpha)})`).replace('#', 'rgba(')
      .replace('rgba(', 'rgba(')
    ;
    // Draw star shape
    const size = 3 + (i % 3);
    ctx.globalAlpha = Math.max(0.05, alpha);
    ctx.fillStyle = sparkleColors[i % sparkleColors.length];
    ctx.beginPath();
    ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.globalAlpha = Math.max(0.02, alpha * 0.3);
    ctx.fillRect(sx - 0.5, sy - size * 3, 1, size * 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawEnglishScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // Subtle dot grid
  ctx.save();
  ctx.fillStyle = 'rgba(191,219,254,0.06)';
  const dotSpacing = 40;
  for (let gx = dotSpacing / 2; gx < canvasW; gx += dotSpacing) {
    for (let gy = dotSpacing / 2; gy < canvasH; gy += dotSpacing) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Globe outline at top-right (partial circle)
  ctx.save();
  ctx.strokeStyle = 'rgba(52,152,219,0.12)';
  ctx.lineWidth = 2;
  const globeX = canvasW + 60;
  const globeY = -60;
  const globeR = 220;
  ctx.beginPath();
  ctx.arc(globeX, globeY, globeR, Math.PI * 0.5, Math.PI * 1.2);
  ctx.stroke();
  // Latitude lines
  for (let la = 1; la <= 3; la++) {
    ctx.strokeStyle = `rgba(52,152,219,${0.04 + la * 0.02})`;
    ctx.beginPath();
    ctx.arc(globeX, globeY, globeR * (0.6 + la * 0.12), Math.PI * 0.4, Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();

  // Book spine decorations at left edge
  ctx.save();
  const bookColors = [
    'rgba(52,152,219,0.25)',
    'rgba(41,128,185,0.20)',
    'rgba(30,100,160,0.22)',
    'rgba(52,152,219,0.18)',
    'rgba(64,170,240,0.20)',
  ];
  const bookHeights = [80, 110, 90, 120, 70];
  let bookY = canvasH * 0.30;
  for (let i = 0; i < bookColors.length; i++) {
    ctx.fillStyle = bookColors[i];
    ctx.fillRect(0, bookY, 10, bookHeights[i]);
    bookY += bookHeights[i] + 4;
  }
  ctx.restore();

  // Horizontal rule lines at 18% and 82%
  ctx.save();
  ctx.strokeStyle = 'rgba(52,152,219,0.3)';
  ctx.lineWidth = 1;
  [0.18, 0.82].forEach((yPct) => {
    ctx.beginPath();
    ctx.moveTo(0, yPct * canvasH);
    ctx.lineTo(canvasW, yPct * canvasH);
    ctx.stroke();
  });
  ctx.restore();
}

function drawFairyScene(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  accentColor: string,
): void {
  // 30 twinkling stars at fixed positions
  const starPositions = [
    [0.08, 0.05], [0.25, 0.03], [0.60, 0.07], [0.80, 0.04], [0.95, 0.09],
    [0.15, 0.14], [0.40, 0.11], [0.70, 0.13], [0.90, 0.16], [0.05, 0.18],
    [0.50, 0.02], [0.35, 0.08], [0.75, 0.06], [0.20, 0.20], [0.85, 0.12],
    [0.55, 0.17], [0.10, 0.22], [0.45, 0.15], [0.65, 0.10], [0.30, 0.24],
    [0.92, 0.22], [0.03, 0.12], [0.77, 0.20], [0.22, 0.08], [0.48, 0.25],
    [0.68, 0.03], [0.88, 0.08], [0.12, 0.28], [0.58, 0.22], [0.38, 0.18],
  ];
  const starColors = ['#fff', '#fce7f3', '#fbbf24', '#ff80ab', '#e9d5ff'];

  ctx.save();
  for (let i = 0; i < starPositions.length; i++) {
    const [xp, yp] = starPositions[i];
    const twinkle = 0.3 + (Math.sin(elapsed * 0.004 + i * 1.3) + 1) / 2 * 0.7;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = starColors[i % starColors.length];
    const size = 1.5 + (i % 3) * 0.8;
    const sx = xp * canvasW;
    const sy = yp * canvasH;
    // Simple 4-point star
    ctx.beginPath();
    ctx.moveTo(sx, sy - size * 2);
    ctx.lineTo(sx + size * 0.5, sy - size * 0.5);
    ctx.lineTo(sx + size * 2, sy);
    ctx.lineTo(sx + size * 0.5, sy + size * 0.5);
    ctx.lineTo(sx, sy + size * 2);
    ctx.lineTo(sx - size * 0.5, sy + size * 0.5);
    ctx.lineTo(sx - size * 2, sy);
    ctx.lineTo(sx - size * 0.5, sy - size * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Shooting star: resets every 5 seconds
  ctx.save();
  const cycle = elapsed % 5000;
  if (cycle < 2000) {
    const t = cycle / 2000;
    const startX = canvasW * 0.8;
    const startY = canvasH * 0.05;
    const endX = canvasW * 0.1;
    const endY = canvasH * 0.25;
    const curX = startX + (endX - startX) * t;
    const curY = startY + (endY - startY) * t;
    const tailLen = 80;
    const tailX = curX + (startX - endX) / Math.hypot(endX - startX, endY - startY) * tailLen * (1 - t);
    const tailY = curY + (startY - endY) / Math.hypot(endX - startX, endY - startY) * tailLen * (1 - t);
    const shootGrad = ctx.createLinearGradient(tailX, tailY, curX, curY);
    shootGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shootGrad.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - t)})`);
    ctx.strokeStyle = shootGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
  }
  ctx.restore();

  // Rainbow arc at top
  ctx.save();
  const rainbowColors = ['#ff0000', '#ff7700', '#ffff00', '#00cc00', '#0000ff', '#8b00ff'];
  const arcCenterX = canvasW / 2;
  const arcCenterY = -canvasH * 0.05;
  const arcR = canvasW * 0.75;
  for (let i = 0; i < rainbowColors.length; i++) {
    ctx.strokeStyle = rainbowColors[i];
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(arcCenterX, arcCenterY, arcR - i * 18, 0, Math.PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Magic dust: 20 particles rising from bottom
  ctx.save();
  const dustColors = ['#ff80ab', '#fbbf24', '#c084fc', '#67e8f9', '#fff'];
  for (let i = 0; i < 20; i++) {
    const baseX = ((i * 0.0517 + 0.03) % 1) * canvasW;
    const speed = 0.015 + (i % 5) * 0.008;
    const rawY = canvasH - ((elapsed * speed + i * 70) % (canvasH * 0.8));
    const dx = Math.sin(elapsed * 0.001 + i * 0.9) * 25;
    const alpha = 0.3 + Math.sin(elapsed * 0.004 + i * 1.1) * 0.25;
    ctx.globalAlpha = Math.max(0.05, alpha);
    ctx.fillStyle = dustColors[i % dustColors.length];
    ctx.beginPath();
    ctx.arc(baseX + dx, rawY, 2.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
    // Sparkle cross
    ctx.globalAlpha = Math.max(0.03, alpha * 0.5);
    ctx.fillRect(baseX + dx - 1, rawY - 6, 2, 12);
    ctx.fillRect(baseX + dx - 6, rawY - 1, 12, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Mascot drawer
// ---------------------------------------------------------------------------

function drawMascot(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  elapsed: number,
): void {
  const floatY = Math.sin(elapsed * 0.002) * 6;
  const finalY = y + floatY;

  // Glow behind mascot
  const glow = ctx.createRadialGradient(x, finalY, 0, x, finalY, size * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.20)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, finalY, size * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Emoji
  ctx.save();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, finalY);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Lower-third overlay
// ---------------------------------------------------------------------------

function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  name: string,
  title: string,
  color: string,
  alpha: number,
): void {
  const barY = canvasH * 0.78;
  const barH = 52;
  const barX = 24;
  const barW = 280;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background bar
  rrPath(ctx, barX, barY, barW, barH, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fill();

  // Accent left stripe
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, 4, barH);

  // Name
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, barX + 12, barY + 8);

  // Title
  ctx.fillStyle = '#93c5fd';
  ctx.font = '13px sans-serif';
  ctx.fillText(title, barX + 12, barY + 30);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Inline BGM generator
// ---------------------------------------------------------------------------

interface SimpleBGMHandle {
  stop: () => void;
}

function createSimpleBGM(
  audioCtx: AudioContext,
  spec: BgmSpec,
  dest: AudioNode,
): SimpleBGMHandle {
  const { genre, bpm, volume } = spec;
  if (genre === 'none') return { stop: () => {} };

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(dest);

  const beatInterval = 60 / bpm;
  let stopped = false;
  let nextBeat = audioCtx.currentTime + 0.05;
  const nodes: AudioNode[] = [masterGain];

  function playTone(
    freq: number,
    startTime: number,
    duration: number,
    gainVal: number,
    type: OscillatorType = 'sine',
  ) {
    if (stopped) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    nodes.push(osc, g);
  }

  function playNoiseBurst(startTime: number, duration: number, gainVal: number) {
    if (stopped) return;
    const bufLen = Math.ceil(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * gainVal;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hpf = audioCtx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 6000;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(hpf);
    hpf.connect(g);
    g.connect(masterGain);
    src.start(startTime);
    nodes.push(src, hpf, g);
  }

  function scheduleGenre(beatStart: number, beatNum: number) {
    const b = beatNum % 4; // 4/4 time

    if (genre === 'lofi') {
      // Mellow chord tones
      const chords = [[196, 247, 294], [220, 277, 330], [175, 220, 262], [196, 247, 294]];
      const chord = chords[beatNum % chords.length];
      chord.forEach((freq) => playTone(freq, beatStart, beatInterval * 0.9, 0.15, 'triangle'));
      // Soft kick on 1 & 3
      if (b === 0 || b === 2) playTone(60, beatStart, 0.18, 0.3, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.12, 0.2);
      // Hi-hat every 8th
      playNoiseBurst(beatStart, 0.04, 0.08);
      playNoiseBurst(beatStart + beatInterval / 2, 0.04, 0.06);
    } else if (genre === 'news') {
      // Punchy staccato tones
      const newsMelody = [261, 293, 329, 349, 293, 261, 220, 261];
      const freq = newsMelody[beatNum % newsMelody.length];
      if (b === 0) playTone(freq, beatStart, 0.25, 0.18, 'square');
      // Kick on 1
      if (b === 0) playTone(80, beatStart, 0.2, 0.35, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.1, 0.25);
      // Closed hi-hat
      playNoiseBurst(beatStart, 0.03, 0.1);
    } else if (genre === 'kpop') {
      // Energetic synth
      const kpopMelody = [330, 392, 440, 494, 440, 392, 349, 330];
      const freq = kpopMelody[beatNum % kpopMelody.length];
      playTone(freq, beatStart, beatInterval * 0.5, 0.16, 'sawtooth');
      // Bass on 1 & 3
      if (b === 0 || b === 2) playTone(65, beatStart, 0.15, 0.3, 'sine');
      if (b === 0 || b === 2) playTone(98, beatStart + 0.02, 0.12, 0.2, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.12, 0.3);
      // Open hi-hat
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.18, 0.12);
      // 8th hi-hats
      playNoiseBurst(beatStart + beatInterval / 2, 0.04, 0.08);
    } else if (genre === 'bright') {
      // Upbeat major scale
      const brightMelody = [261, 294, 330, 349, 392, 440, 494, 523];
      const freq = brightMelody[beatNum % brightMelody.length];
      playTone(freq, beatStart, beatInterval * 0.7, 0.14, 'sine');
      // Kick on 1 & 3
      if (b === 0 || b === 2) playTone(70, beatStart, 0.18, 0.28, 'sine');
      // Snare on 2 & 4
      if (b === 1 || b === 3) playNoiseBurst(beatStart, 0.1, 0.22);
      // Bright hi-hat
      playNoiseBurst(beatStart, 0.03, 0.1);
      playNoiseBurst(beatStart + beatInterval / 2, 0.03, 0.07);
    } else if (genre === 'fairy') {
      // Delicate pentatonic
      const fairyScale = [523, 587, 659, 784, 880, 784, 659, 587];
      const freq = fairyScale[beatNum % fairyScale.length];
      playTone(freq, beatStart, beatInterval * 0.8, 0.10, 'triangle');
      playTone(freq * 2, beatStart, beatInterval * 0.4, 0.04, 'sine');
      // Soft kick
      if (b === 0) playTone(65, beatStart, 0.25, 0.18, 'sine');
      // Gentle snare
      if (b === 2) playNoiseBurst(beatStart, 0.08, 0.12);
      // Sparkle hi-hat
      playNoiseBurst(beatStart, 0.03, 0.06);
      if (beatNum % 2 === 0) playNoiseBurst(beatStart + beatInterval * 0.75, 0.02, 0.05);
    }
  }

  // Lookahead scheduler
  let beatCount = 0;
  const lookahead = 0.25; // seconds
  function schedule() {
    if (stopped) return;
    while (nextBeat < audioCtx.currentTime + lookahead) {
      scheduleGenre(nextBeat, beatCount);
      beatCount++;
      nextBeat += beatInterval;
    }
    if (!stopped) {
      setTimeout(schedule, 50);
    }
  }
  schedule();

  return {
    stop: () => {
      stopped = true;
      try { masterGain.disconnect(); } catch (_) {}
    },
  };
}

// ---------------------------------------------------------------------------
// INTRO phase (elapsed 0 → INTRO_MS):  countdown 3-2-1-GO! + branding
// ---------------------------------------------------------------------------

function drawIntroFrame(
  ctx: CanvasRenderingContext2D,
  template: VideoTemplate,
  elapsed: number,
  canvasW: number,
  canvasH: number,
): void {
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  const ca       = template.clipArea;
  const cx       = ca.xPct * canvasW;
  const cy       = ca.yPct * canvasH;
  const cw       = ca.wPct * canvasW;
  const ch       = ca.hPct * canvasH;

  // Dark overlay over the clip area placeholder
  ctx.save();
  rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  ctx.fill();
  ctx.restore();

  // Countdown label: 3 → 2 → 1 → GO!
  const secIdx     = Math.min(3, Math.floor(elapsed / 1000)); // 0,1,2,3
  const secProg    = (elapsed % 1000) / 1000;                 // 0→1 within each second
  const labels     = ['3', '2', '1', 'GO!'];
  const label      = labels[secIdx];
  const isGo       = secIdx === 3;
  const countScale = isGo ? (0.8 + secProg * 0.4) : (1.5 - secProg * 0.5);
  const alpha      = isGo ? Math.max(0, 1 - secProg * 0.5) : 1;

  // Pulsing glow ring
  const ringR = 88;
  ctx.save();
  ctx.globalAlpha = 0.45 * (1 - secProg);
  ctx.strokeStyle = template.accentColor;
  ctx.lineWidth   = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * secProg);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Radial glow
  const glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, ringR + 30);
  glowGrad.addColorStop(0, template.accentColor + '55');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringR + 30, 0, Math.PI * 2);
  ctx.fill();

  // Big countdown number
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(countScale, countScale);
  ctx.globalAlpha = alpha;
  ctx.font        = `bold ${isGo ? 68 : 100}px sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth   = 6;
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle   = isGo ? '#FFD700' : '#ffffff';
  ctx.fillText(label, 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Template name + subtitle (fade in during first second)
  const nameAlpha = Math.min(1, elapsed / 800);
  ctx.save();
  ctx.globalAlpha = nameAlpha;
  ctx.font        = 'bold 24px sans-serif';
  ctx.fillStyle   = '#fff';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor  = template.accentColor;
  ctx.shadowBlur   = 10;
  ctx.fillText(template.name, centerX, centerY + ringR + 20);
  ctx.shadowBlur   = 0;
  ctx.font         = '16px sans-serif';
  ctx.fillStyle    = 'rgba(255,255,255,0.70)';
  ctx.fillText('준비하세요! 곧 시작합니다 ▶', centerX, centerY + ringR + 52);
  ctx.globalAlpha  = 1;
  ctx.restore();

  // Clip area border
  if (ca.borderColor && ca.borderWidth) {
    ctx.save();
    rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
    ctx.strokeStyle = ca.borderColor;
    ctx.lineWidth   = ca.borderWidth;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// OUTRO phase (elapsed MAIN_END → END):  trophy celebration + hashtags + CTA
// ---------------------------------------------------------------------------

function drawOutroFrame(
  ctx: CanvasRenderingContext2D,
  template: VideoTemplate,
  outroElapsed: number,
  canvasW: number,
  canvasH: number,
): void {
  const progress  = Math.min(1, outroElapsed / OUTRO_MS);
  const centerX   = canvasW / 2;
  const centerY   = canvasH * 0.40;

  // Darkening overlay
  ctx.fillStyle = `rgba(0,0,0,${0.35 * progress})`;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Radiating gold spikes
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + outroElapsed * 0.0025;
    const len   = 220 * progress;
    ctx.globalAlpha   = 0.10 * progress;
    ctx.strokeStyle   = '#FFD700';
    ctx.lineWidth     = 10;
    ctx.lineCap       = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Trophy emoji (animate scale-in)
  const trophyScale = 0.2 + progress * 0.8;
  ctx.save();
  ctx.translate(centerX, centerY - 25);
  ctx.scale(trophyScale, trophyScale);
  ctx.globalAlpha = progress;
  ctx.font        = '88px sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏆', 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  // "챌린지 완료!" with golden glow
  const textScale = 0.4 + progress * 0.6;
  ctx.save();
  ctx.translate(centerX, centerY + 70);
  ctx.scale(textScale, textScale);
  ctx.globalAlpha    = progress;
  ctx.font           = 'bold 52px sans-serif';
  ctx.fillStyle      = '#FFD700';
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';
  ctx.shadowColor    = template.accentColor;
  ctx.shadowBlur     = 20;
  ctx.strokeStyle    = 'rgba(0,0,0,0.55)';
  ctx.lineWidth      = 4;
  ctx.strokeText('챌린지 완료!', 0, 0);
  ctx.fillText('챌린지 완료!', 0, 0);
  ctx.shadowBlur     = 0;
  ctx.globalAlpha    = 1;
  ctx.restore();

  // Orbiting star emojis
  const numStars = 6;
  for (let i = 0; i < numStars; i++) {
    const angle  = (i / numStars) * Math.PI * 2 + outroElapsed * 0.005;
    const orbitR = 130 * Math.min(1, progress * 2);
    const sx     = centerX + Math.cos(angle) * orbitR;
    const sy     = centerY + Math.sin(angle) * orbitR;
    ctx.save();
    ctx.globalAlpha    = Math.min(1, progress * 2);
    ctx.font           = '26px sans-serif';
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'middle';
    ctx.fillText('⭐', sx, sy);
    ctx.globalAlpha    = 1;
    ctx.restore();
  }

  // Hashtags fade-in (second half of outro)
  if (progress > 0.45) {
    const hashAlpha = (progress - 0.45) / 0.55;
    const top5      = template.hashtags.slice(0, 5).map(h => '#' + h).join('  ');
    ctx.save();
    ctx.globalAlpha    = hashAlpha;
    ctx.font           = '18px sans-serif';
    ctx.fillStyle      = '#fff';
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'top';
    ctx.shadowColor    = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur     = 4;
    ctx.fillText(top5, canvasW / 2, canvasH * 0.63);
    ctx.shadowBlur     = 0;

    // Pulsing CTA
    const pulse = 0.85 + 0.15 * Math.sin(outroElapsed * 0.007);
    ctx.globalAlpha    = hashAlpha * pulse;
    ctx.font           = 'bold 22px sans-serif';
    ctx.fillStyle      = '#FFD700';
    ctx.fillText('❤️  좋아요 & 공유하기!', canvasW / 2, canvasH * 0.71);
    ctx.globalAlpha    = 1;
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Zone drawing helpers
// ---------------------------------------------------------------------------

// Scrolling text state per zone
const scrollOffsets: Map<string, number> = new Map();

function drawTopZone(
  ctx: CanvasRenderingContext2D,
  zone: TemplateZone,
  canvasW: number,
): void {
  const zoneH = 76;
  ctx.save();
  ctx.fillStyle = zone.bgColor;
  ctx.fillRect(0, 0, canvasW, zoneH);

  // Logo emoji on left
  if (zone.logoEmoji) {
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.logoEmoji, 12, zoneH * 0.38);
  }

  // Main text
  ctx.fillStyle = zone.textColor;
  ctx.font = `${zone.bold ? 'bold ' : ''}${zone.fontSize ?? 20}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(zone.text, canvasW / 2, zoneH * 0.36);

  // Subtext
  if (zone.subtext) {
    ctx.font = `13px sans-serif`;
    ctx.fillStyle = zone.textColor;
    ctx.globalAlpha = 0.85;
    ctx.fillText(zone.subtext, canvasW / 2, zoneH * 0.70);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBottomZone(
  ctx: CanvasRenderingContext2D,
  zone: TemplateZone,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  templateId: string,
): void {
  const zoneH = 52;
  const zoneY = canvasH - zoneH;
  ctx.save();
  ctx.fillStyle = zone.bgColor;
  ctx.fillRect(0, zoneY, canvasW, zoneH);

  ctx.fillStyle = zone.textColor;
  const fontSize = zone.fontSize ?? 15;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';

  if (zone.scrolling) {
    // Measure full text width
    const textW = ctx.measureText(zone.text).width;
    const key = `bottom_${templateId}`;
    let offset = scrollOffsets.get(key) ?? 0;
    // Scroll 60px/sec
    offset = (offset + (elapsed * 0.001 * 60) % (textW + canvasW)) % (textW + canvasW);
    scrollOffsets.set(key, offset);

    ctx.save();
    ctx.rect(0, zoneY, canvasW, zoneH);
    ctx.clip();
    ctx.textAlign = 'left';
    const drawX = canvasW - offset;
    ctx.fillText(zone.text, drawX, zoneY + zoneH / 2);
    // Repeat for seamless loop
    ctx.fillText(zone.text, drawX + textW + 40, zoneY + zoneH / 2);
    ctx.restore();
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(zone.text, canvasW / 2, zoneY + zoneH / 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Text overlay renderer
// ---------------------------------------------------------------------------

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  canvasW: number,
  canvasH: number,
  elapsed: number,
): void {
  const { start_ms, end_ms } = overlay;
  if (elapsed < start_ms || elapsed > end_ms) return;

  const duration = end_ms - start_ms;
  const localT = (elapsed - start_ms) / duration; // 0..1
  const localMs = elapsed - start_ms;

  let alpha = 1;
  let offsetY = 0;
  let offsetX = 0;
  let displayText = overlay.text;

  const ANIM_IN = 0.12;  // first 12% = animation in
  const ANIM_OUT = 0.88; // last 12% = animation out

  switch (overlay.animation) {
    case 'fade': {
      if (localT < ANIM_IN) alpha = localT / ANIM_IN;
      else if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'slide_up': {
      const slideProgress = Math.min(1, localT / ANIM_IN);
      offsetY = (1 - slideProgress) * 30;
      alpha = slideProgress;
      if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'slide_left': {
      const slideProgress = Math.min(1, localT / ANIM_IN);
      offsetX = (1 - slideProgress) * 60;
      alpha = slideProgress;
      if (localT > ANIM_OUT) alpha = (1 - localT) / (1 - ANIM_OUT);
      break;
    }
    case 'bounce': {
      const bounceProgress = Math.min(1, localT / ANIM_IN);
      const bounce = Math.sin(bounceProgress * Math.PI * 2.5) * (1 - bounceProgress) * 10;
      offsetY = -bounce;
      alpha = bounceProgress;
      if (localT > ANIM_OUT) alpha = Math.max(0, (1 - localT) / (1 - ANIM_OUT));
      break;
    }
    case 'typewriter': {
      // First 30% of duration = type in, rest = stay
      const typeProgress = Math.min(1, localT / 0.30);
      const charCount = Math.floor(typeProgress * overlay.text.length);
      displayText = overlay.text.slice(0, charCount);
      alpha = 1;
      break;
    }
    default:
      break;
  }

  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const x = overlay.xPct * canvasW + offsetX;
  const y = overlay.yPct * canvasH + offsetY;
  const fontSize = overlay.fontSize;
  const fontWeight = overlay.bold ? 'bold ' : '';
  ctx.font = `${fontWeight}${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';

  // Determine text align
  switch (overlay.align) {
    case 'left': ctx.textAlign = 'left'; break;
    case 'right': ctx.textAlign = 'right'; break;
    default: ctx.textAlign = 'center'; break;
  }

  // Background box
  if (overlay.bgColor && displayText.length > 0) {
    const metrics = ctx.measureText(displayText);
    const textW = metrics.width;
    const padX = 10;
    const padY = 5;
    let bgX = x - padX;
    if (overlay.align === 'center') bgX = x - textW / 2 - padX;
    if (overlay.align === 'right') bgX = x - textW - padX;
    rrPath(ctx, bgX, y - padY, textW + padX * 2, fontSize + padY * 2, 6);
    ctx.fillStyle = overlay.bgColor;
    ctx.fill();
  }

  // Outline
  if (overlay.outlineColor) {
    ctx.strokeStyle = overlay.outlineColor;
    ctx.lineWidth = 2;
    ctx.strokeText(displayText, x, y);
  }

  // Main text
  ctx.fillStyle = overlay.color;
  ctx.fillText(displayText, x, y);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Vignette
// ---------------------------------------------------------------------------

function drawVignette(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
  const grad = ctx.createRadialGradient(
    canvasW / 2, canvasH / 2, canvasH * 0.3,
    canvasW / 2, canvasH / 2, canvasH * 0.78,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

// ---------------------------------------------------------------------------
// Progress bar at bottom
// ---------------------------------------------------------------------------

function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  elapsed: number,
  duration: number,
  accentColor: string,
): void {
  const barH = 6;
  const barY = canvasH - barH;
  const progress = Math.min(1, elapsed / duration);
  // Track
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, barY, canvasW, barH);
  // Fill
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, barY, canvasW * progress, barH);
}

// ---------------------------------------------------------------------------
// Main compositor
// ---------------------------------------------------------------------------

export async function composeVideo(
  template: VideoTemplate,
  clips: RecordedClip[],
  onProgress: (p: CompositorProgress) => void,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (!clips || clips.length === 0) {
      reject(new Error('No clips provided'));
      return;
    }

    const clip = clips[0];
    const clipUrl = URL.createObjectURL(clip.blob);
    const video = document.createElement('video');
    video.src = clipUrl;
    video.muted = false;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // Reset scroll offsets for fresh render
    scrollOffsets.clear();

    // Safety timeout: 8 minutes
    const TIMEOUT_MS = 8 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Compositor timed out after 8 minutes'));
    }, TIMEOUT_MS);

    let audioCtx: AudioContext | null = null;
    let bgmHandle: SimpleBGMHandle | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let rafId = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    const chunks: Blob[] = [];
    let finished = false;
    let videoStarted = false;
    let videoStopped = false;

    function cleanup() {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      bgmHandle?.stop();
      try { audioCtx?.close(); } catch (_) {}
      URL.revokeObjectURL(clipUrl);
    }

    function renderFrame(now: DOMHighResTimeStamp) {
      if (finished) return;

      const elapsed = now - startTime;
      const duration = template.duration_ms;

      // 15fps throttle
      if (now - lastFrameTime < FRAME_MS - 1) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }
      lastFrameTime = now;

      // Phase boundaries
      const mainStart = INTRO_MS;
      const mainEnd   = duration - OUTRO_MS;

      // Progress reporting with phase labels
      const phaseLabel =
        elapsed < mainStart ? '🎬 인트로 애니메이션...' :
        elapsed >= mainEnd  ? '🎉 아웃트로 애니메이션...' :
        '🎥 영상 합성 중...';
      onProgress({
        phase:   phaseLabel,
        percent: Math.min(99, Math.round((elapsed / duration) * 100)),
      });

      // --- 1. Background gradient (all phases) ---
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, template.gradientColors[0]);
      bgGrad.addColorStop(1, template.gradientColors[1]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // --- 2. Scene-specific background (all phases) ---
      switch (template.bgStyle) {
        case 'vlog':
          drawVlogScene(ctx, W, H, elapsed, template.accentColor);
          break;
        case 'news':
          drawNewsScene(ctx, W, H, elapsed, template.accentColor);
          break;
        case 'kpop':
          drawKpopScene(ctx, W, H, elapsed, template.accentColor);
          break;
        case 'english':
          drawEnglishScene(ctx, W, H, elapsed, template.accentColor);
          break;
        case 'fairy':
          drawFairyScene(ctx, W, H, elapsed, template.accentColor);
          break;
      }

      // --- 3. Top zone (all phases) ---
      if (template.topZone) {
        drawTopZone(ctx, template.topZone, W);
      }

      // ── Phase split ──────────────────────────────────────────────────────────

      if (elapsed < mainStart) {
        // ═══ PHASE 0: INTRO ═══════════════════════════════════════════════════
        drawIntroFrame(ctx, template, elapsed, W, H);

      } else if (elapsed >= mainEnd) {
        // ═══ PHASE 2: OUTRO ═══════════════════════════════════════════════════
        const outroElapsed = elapsed - mainEnd;
        drawOutroFrame(ctx, template, outroElapsed, W, H);

      } else {
        // ═══ PHASE 1: MAIN (user clip) ════════════════════════════════════════

        // --- 4. User video in clipArea ---
        const ca = template.clipArea;
        const cx = ca.xPct * W;
        const cy = ca.yPct * H;
        const cw = ca.wPct * W;
        const ch = ca.hPct * H;

        // Glow effect behind video
        if (ca.glowColor) {
          ctx.save();
          ctx.shadowColor = ca.glowColor;
          ctx.shadowBlur  = 20;
          rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
          ctx.fillStyle   = ca.glowColor;
          ctx.fill();
          ctx.shadowBlur  = 0;
          ctx.restore();
        }

        // Clip and draw video frame
        ctx.save();
        rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
        ctx.clip();
        try {
          ctx.drawImage(video, cx, cy, cw, ch);
        } catch (_) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(cx, cy, cw, ch);
        }
        ctx.restore();

        // Border
        if (ca.borderColor && ca.borderWidth) {
          ctx.save();
          rrPath(ctx, cx, cy, cw, ch, ca.borderRadius);
          ctx.strokeStyle = ca.borderColor;
          ctx.lineWidth   = ca.borderWidth;
          ctx.stroke();
          ctx.restore();
        }

        // --- 5. Bottom zone ---
        if (template.bottomZone) {
          drawBottomZone(ctx, template.bottomZone, W, H, elapsed, template.id);
        }

        // --- 6. Text overlays ---
        for (const overlay of template.text_overlays) {
          drawTextOverlay(ctx, overlay, W, H, elapsed);
        }

        // --- 7. Mascot ---
        if (template.mascotEmoji) {
          const mascotX = cx + cw - 30;
          const mascotY = cy - 30;
          drawMascot(ctx, template.mascotEmoji, mascotX, mascotY, 36, elapsed);
        }
      }

      // ── Shared: vignette + progress bar (always) ─────────────────────────────
      drawVignette(ctx, W, H);
      drawProgressBar(ctx, W, H, elapsed, duration, template.accentColor);

      // ── Video playback control ──────────────────────────────────────────────
      if (elapsed >= mainStart && !videoStarted) {
        videoStarted = true;
        video.play().catch((e) => console.warn('[Compositor] video.play failed:', e));
      }
      if (elapsed >= mainEnd && !videoStopped) {
        videoStopped = true;
        video.pause();
      }

      rafId = requestAnimationFrame(renderFrame);
    }

    video.addEventListener('loadedmetadata', () => {
      onProgress({ phase: '비디오 로드 완료', percent: 5 });

      // Setup Audio
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        bgmHandle = createSimpleBGM(audioCtx, template.bgm, dest);

        // Canvas stream + audio
        const canvasStream = canvas.captureStream(FPS);
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

        // MediaRecorder codec preference
        const mimeTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4',
        ];
        let chosenMime = '';
        for (const mt of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mt)) {
            chosenMime = mt;
            break;
          }
        }

        mediaRecorder = chosenMime
          ? new MediaRecorder(canvasStream, { mimeType: chosenMime, videoBitsPerSecond: 4_000_000 })
          : new MediaRecorder(canvasStream, { videoBitsPerSecond: 4_000_000 });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          finished = true;
          cleanup();
          onProgress({ phase: '완료!', percent: 100 });
          const blob = new Blob(chunks, { type: chosenMime || 'video/webm' });
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          cleanup();
          reject(new Error(`MediaRecorder error: ${e}`));
        };

        mediaRecorder.start(100); // collect every 100ms
        onProgress({ phase: '녹화 시작', percent: 10 });

        // Start render loop (video.play() triggered inside renderFrame at INTRO_MS)
        startTime = performance.now();
        lastFrameTime = startTime;
        rafId = requestAnimationFrame(renderFrame);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    video.addEventListener('ended', () => {
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, 500);
    });

    video.addEventListener('error', (e) => {
      cleanup();
      reject(new Error(`Video load error: ${video.error?.message ?? String(e)}`));
    });

    // Also stop if template duration exceeded
    setTimeout(() => {
      if (!finished && mediaRecorder && mediaRecorder.state !== 'inactive') {
        video.pause();
        mediaRecorder.stop();
      }
    }, template.duration_ms + 1000);
  });
}
