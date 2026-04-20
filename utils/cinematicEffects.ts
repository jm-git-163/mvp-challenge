// utils/cinematicEffects.ts
// CapCut/Reels-grade post-processing layers for the video compositor.
// Pure Canvas 2D — runs at 15fps on mid-range hardware.
//
// Each effect is a function you call inside the render loop AFTER base composition
// and BEFORE the progress bar / UI layer.

// ─── Deterministic PRNG (for stable noise across frames) ─────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── 1. Film grain ───────────────────────────────────────────────────────────
// Subtle monochrome noise overlay. Cheap via offscreen pre-rendered grain tile.

let _grainCache: HTMLCanvasElement | null = null;
let _grainSeed = 0;

function makeGrainTile(size = 128, intensity = 0.15): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = size; off.height = size;
  const g = off.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rand = mulberry32(_grainSeed++);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(intensity * 255);
  }
  g.putImageData(img, 0, 0);
  return off;
}

export function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  elapsed: number,
  intensity = 0.10,
): void {
  // Regenerate grain every ~200ms for authentic "moving grain" look
  if (!_grainCache || elapsed % 200 < 20) {
    _grainCache = makeGrainTile(128, intensity);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35;
  const pat = ctx.createPattern(_grainCache, 'repeat');
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// ─── 2. Light leak ───────────────────────────────────────────────────────────
// Warm orange/magenta radial streaks that drift across the frame (emotional).

export function drawLightLeak(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  elapsed: number,
  color = '#FFB27A',
): void {
  const t = elapsed / 1000;
  // Two leaks drifting
  const leaks = [
    {
      x: w * (0.9 + 0.2 * Math.sin(t * 0.23)),
      y: h * (0.15 + 0.1 * Math.cos(t * 0.17)),
      r: w * 0.85,
      alpha: 0.22 + 0.08 * Math.sin(t * 0.5),
    },
    {
      x: w * (-0.05 + 0.1 * Math.cos(t * 0.19)),
      y: h * (0.75 + 0.05 * Math.sin(t * 0.13)),
      r: w * 0.7,
      alpha: 0.14 + 0.05 * Math.cos(t * 0.4),
    },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const lk of leaks) {
    const g = ctx.createRadialGradient(lk.x, lk.y, 0, lk.x, lk.y, lk.r);
    g.addColorStop(0, hexA(color, lk.alpha));
    g.addColorStop(0.4, hexA(color, lk.alpha * 0.5));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// ─── 3. Beat flash ───────────────────────────────────────────────────────────
// White/color flash synced to BGM beat — instant energy lift.

export function drawBeatFlash(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  elapsed: number,
  bpm: number,
  color = '#FFFFFF',
  strength = 0.12,
): void {
  if (bpm <= 0) return;
  const beatMs = 60000 / bpm;
  const phase = (elapsed % beatMs) / beatMs;   // 0..1
  // Flash sharp at phase 0, decay to 0 over ~15% of the beat
  const flashCurve = phase < 0.15 ? (1 - phase / 0.15) ** 2 : 0;
  if (flashCurve < 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = hexA(color, strength * flashCurve);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ─── 4. Letterbox bars (cinematic 2.39:1) ────────────────────────────────────

export function drawLetterbox(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  progress = 1,   // 0..1 — animated reveal
): void {
  // 2.39:1 aspect on a 720×1280 canvas → letterbox height ≈ (1280 - 720/2.39)/2 = 489px each
  // That's too much. Use milder cinematic 16:9 inside 9:16 → bars ≈ (1280 - 720*9/16)/2 = 437.5. Still huge.
  // Use a "mood" bar — thin top/bottom bars 40px each for cinematic hint.
  const bar = 36 * progress;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
  ctx.restore();
}

// ─── 5. Chromatic aberration (cheap, on-demand) ──────────────────────────────
// Split R/B channels slightly — gives a VHS / energetic feel.
// Expensive: uses getImageData. Only call on beat pulses, not every frame.

export function drawChromaticAberration(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  offset = 3,
): void {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const src = img.data;
    const out = ctx.createImageData(w, h);
    const dst = out.data;
    const stride = w * 4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * stride + x * 4;
        const xR = Math.min(w - 1, x + offset);
        const xB = Math.max(0, x - offset);
        dst[i    ] = src[y * stride + xR * 4    ]; // R shifted right
        dst[i + 1] = src[i + 1];                    // G original
        dst[i + 2] = src[y * stride + xB * 4 + 2]; // B shifted left
        dst[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  } catch { /* CORS-tainted canvas — skip */ }
}

// ─── 5b. Teal-orange color grade (Hollywood film look) ──────────────────────
// Push shadows toward teal and highlights toward orange — classic blockbuster LUT.
// Implemented as dual radial overlays at low alpha, NOT getImageData (frame-rate safe).

export function drawTealOrangeGrade(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  strength = 0.12,
): void {
  ctx.save();
  // Teal wash over dark areas (multiply-ish via 'overlay' at low alpha)
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = strength;
  ctx.fillStyle = '#123F55';
  ctx.fillRect(0, 0, w, h);
  // Orange warm pop on mid-tones via soft-light
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = strength * 1.1;
  ctx.fillStyle = '#FFA15A';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ─── 6. Ken burns (slow zoom + pan) ──────────────────────────────────────────
// Apply as ctx transform BEFORE drawing a layer, restore after.

export function kenBurnsTransform(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  elapsed: number,
  durationMs: number,
  zoomFrom = 1.0,
  zoomTo = 1.15,
  panXPct = 0.05,
  panYPct = 0.03,
): void {
  const t = Math.min(1, elapsed / durationMs);
  const eased = t * t * (3 - 2 * t); // smoothstep
  const zoom = zoomFrom + (zoomTo - zoomFrom) * eased;
  const panX = panXPct * w * (eased - 0.5);
  const panY = panYPct * h * (eased - 0.5);
  ctx.translate(w / 2 + panX, h / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
}

// ─── 7. Kinetic text (word-by-word reveal) ───────────────────────────────────
// Call each frame for a given caption. Returns which words should render at what opacity/offset.

export interface KineticWord {
  text: string;
  opacity: number;
  translateY: number;   // px
  scale: number;
}

export function computeKineticReveal(
  fullText: string,
  startMs: number,
  elapsed: number,
  perWordMs = 120,
  fadeMs = 240,
): KineticWord[] {
  const words = fullText.split(/\s+/).filter(Boolean);
  const out: KineticWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const wordStart = startMs + i * perWordMs;
    const local = elapsed - wordStart;
    if (local < 0) {
      out.push({ text: words[i], opacity: 0, translateY: 14, scale: 0.94 });
    } else if (local < fadeMs) {
      const t = local / fadeMs;
      const eased = 1 - (1 - t) ** 3;
      out.push({
        text: words[i],
        opacity: eased,
        translateY: 14 * (1 - eased),
        scale: 0.94 + 0.06 * eased,
      });
    } else {
      out.push({ text: words[i], opacity: 1, translateY: 0, scale: 1 });
    }
  }
  return out;
}

// Draw kinetic words in a flow layout, center-aligned.
export function drawKineticText(
  ctx: CanvasRenderingContext2D,
  words: KineticWord[],
  centerX: number,
  centerY: number,
  fontSize: number,
  color = '#FFFFFF',
  bold = true,
  maxWidthPx = 620,
): void {
  ctx.save();
  ctx.font = `${bold ? '900 ' : ''}${fontSize}px "Pretendard Variable","Inter","Segoe UI",system-ui,sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // Measure total width at scale=1 for layout
  const spaceWidth = ctx.measureText(' ').width;
  const wordWidths = words.map(w => ctx.measureText(w.text).width);

  // Wrap into lines based on maxWidthPx
  const lines: Array<{ start: number; end: number; width: number }> = [];
  let curStart = 0, curWidth = 0;
  for (let i = 0; i < words.length; i++) {
    const ww = wordWidths[i];
    const addW = curWidth === 0 ? ww : curWidth + spaceWidth + ww;
    if (addW > maxWidthPx && i > curStart) {
      lines.push({ start: curStart, end: i, width: curWidth });
      curStart = i;
      curWidth = ww;
    } else {
      curWidth = addW;
    }
  }
  if (curStart < words.length) lines.push({ start: curStart, end: words.length, width: curWidth });

  const lineHeight = fontSize * 1.18;
  const totalHeight = lines.length * lineHeight;
  const startY = centerY - totalHeight / 2 + lineHeight / 2;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let x = centerX - line.width / 2;
    const y = startY + li * lineHeight;
    for (let i = line.start; i < line.end; i++) {
      const w = words[i];
      const ww = wordWidths[i];
      ctx.save();
      ctx.translate(x + ww / 2, y + w.translateY);
      ctx.scale(w.scale, w.scale);
      ctx.globalAlpha = w.opacity;
      // Drop shadow for legibility
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
      x += ww + spaceWidth;
    }
  }
  ctx.restore();
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexA(hex: string, alpha: number): string {
  // Handle #RGB, #RRGGBB
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length >= 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
