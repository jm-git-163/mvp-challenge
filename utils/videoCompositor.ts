/**
 * utils/videoCompositor.ts
 *
 * Real-time canvas compositor with full template support.
 * Draws on a 720×1280 canvas:
 *   1. Gradient background
 *   2. Decorative elements (sparkles/stars/circles/lines)
 *   3. TOP ZONE  — top 15% of canvas, template header
 *   4. USER VIDEO — placed precisely in template.clipArea
 *   5. BOTTOM ZONE — bottom 15%, scrolling ticker or hashtags
 *   6. TEXT OVERLAYS — timed, with animations
 *   7. Vignette
 *
 * BGM is synthesised via Web Audio API and mixed into the output stream.
 */

import type { VideoTemplate, BgmSpec } from './videoTemplates';

export interface RecordedClip {
  slot_id: string;
  blob: Blob;
  duration_ms: number;
}

export interface CompositorProgress {
  phase: string;
  percent: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Draw a rounded-rectangle path without relying on the roundRect() API. */
function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw subtle animated decorative elements in the background. */
function drawDecorative(
  ctx: CanvasRenderingContext2D,
  type: string,
  accentColor: string,
  W: number,
  H: number,
  elapsed: number,
): void {
  ctx.save();
  const t = elapsed / 1000;

  if (type === 'sparkles') {
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.06 + Math.abs(Math.sin(t * 1.5 + i)) * 0.06;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      const x = (Math.sin(t * 0.3 + i * 2.1) * 0.4 + 0.5) * W;
      const y = (Math.cos(t * 0.2 + i * 1.7) * 0.4 + 0.5) * H;
      ctx.arc(x, y, 2 + Math.sin(t + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'stars') {
    for (let i = 0; i < 22; i++) {
      const x = ((Math.sin(i * 3.1) + 1) / 2) * W;
      const y = ((Math.cos(i * 2.7) + 1) / 2) * H;
      ctx.globalAlpha = 0.04 + Math.abs(Math.sin(t * 2.2 + i)) * 0.10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + Math.sin(i) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'circles') {
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const cx = (i % 3) * W * 0.5 + Math.sin(t * 0.4 + i) * 25;
      const cy = Math.floor(i / 3) * H * 0.6 + Math.cos(t * 0.3 + i) * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, 70 + i * 45, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (type === 'lines') {
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    for (let i = -5; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 55, 0);
      ctx.lineTo(i * 55 + H * 0.28, H);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─── BGM Synthesiser ─────────────────────────────────────────────────────────

/**
 * Creates a simple chord-based synthesiser connected to `dest`.
 * Returns a stop function that silences and halts the scheduler.
 */
function createBGM(
  audioCtx: AudioContext,
  spec: BgmSpec,
  dest: MediaStreamAudioDestinationNode,
): () => void {
  if (spec.genre === 'none' || spec.volume === 0) return () => {};

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = spec.volume;
  masterGain.connect(dest);

  const patterns: Record<string, number[][]> = {
    lofi:   [[261, 329, 392], [220, 277, 370], [261, 329, 392], [246, 311, 392]],
    news:   [[440, 554], [494, 622], [440, 554], [392, 494]],
    kpop:   [[440], [494], [523], [494], [440], [392], [349], [392]],
    bright: [[523, 659, 784], [587, 740, 880], [523, 659, 784], [440, 554, 698]],
    fairy:  [[392, 523, 659], [349, 440, 587], [392, 523, 659], [330, 415, 523]],
  };

  const chords = patterns[spec.genre] ?? patterns.lofi;
  const beatDur = 60 / spec.bpm;
  const bpc = 4; // beats per chord
  let beatIdx = 0;
  let nextNote = audioCtx.currentTime + 0.1;
  let stopped = false;

  function sched(): void {
    if (stopped) return;
    while (nextNote < audioCtx.currentTime + 0.35) {
      const ci = Math.floor(beatIdx / bpc) % chords.length;
      if (beatIdx % bpc === 0) {
        chords[ci].forEach((freq) => {
          const osc = audioCtx.createOscillator();
          const env = audioCtx.createGain();
          osc.type = spec.genre === 'kpop' ? 'triangle' : 'sine';
          osc.frequency.value = freq * (spec.genre === 'news' ? 0.5 : 1);
          const nd = beatDur * bpc * 0.82;
          env.gain.setValueAtTime(0, nextNote);
          env.gain.linearRampToValueAtTime(0.28, nextNote + 0.04);
          env.gain.exponentialRampToValueAtTime(0.001, nextNote + nd);
          osc.connect(env);
          env.connect(masterGain);
          osc.start(nextNote);
          osc.stop(nextNote + nd + 0.05);
        });
      }

      // Kick-like low thud on beat 1 for kpop/news
      if ((spec.genre === 'kpop' || spec.genre === 'news') && beatIdx % bpc === 0) {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.frequency.setValueAtTime(140, nextNote);
        osc.frequency.exponentialRampToValueAtTime(0.001, nextNote + 0.22);
        env.gain.setValueAtTime(0.28, nextNote);
        env.gain.exponentialRampToValueAtTime(0.001, nextNote + 0.18);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(nextNote);
        osc.stop(nextNote + 0.25);
      }

      nextNote += beatDur;
      beatIdx++;
    }
    if (!stopped) setTimeout(sched, 50);
  }

  sched();
  return () => {
    stopped = true;
    masterGain.gain.value = 0;
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function composeVideo(
  template: VideoTemplate,
  clips: RecordedClip[],
  onProgress: (p: CompositorProgress) => void,
): Promise<Blob> {
  if (typeof window === 'undefined') throw new Error('브라우저 환경 필요');

  const primaryBlob = clips[0]?.blob;
  if (!primaryBlob) throw new Error('녹화된 클립이 없습니다');

  const videoUrl = URL.createObjectURL(primaryBlob);
  const W = 720;
  const H = 1280;

  return new Promise((resolve, reject) => {
    // Hidden video element
    const videoEl = document.createElement('video');
    videoEl.src = videoUrl;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(videoEl);

    // Output canvas
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

    // BGM via AudioContext → MediaStreamDestination
    let stopBGM: (() => void) | null = null;
    let audioCtx: AudioContext | null = null;
    const canvasStream = canvas.captureStream(15);

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioDest = audioCtx.createMediaStreamDestination();
      stopBGM = createBGM(audioCtx, template.bgm, audioDest);
      audioDest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch {
      /* BGM unavailable in this environment */
    }

    // MediaRecorder setup
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
      '',
    ];
    const mimeType = mimeTypes.find((m) => !m || MediaRecorder.isTypeSupported(m)) ?? '';
    const mr = new MediaRecorder(
      canvasStream,
      mimeType ? { mimeType, videoBitsPerSecond: 3_000_000 } : undefined,
    );
    const chunks: BlobPart[] = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mr.onstop = () => {
      stopBGM?.();
      try { audioCtx?.close(); } catch { /* ignore */ }
      try { document.body.removeChild(videoEl); } catch { /* ignore */ }
      URL.revokeObjectURL(videoUrl);
      resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
    };

    let animId = 0;
    let lastFrameTs = 0;
    let tickerOffset = 0;

    function render(ts: number): void {
      // Cap render at ~15 fps
      if (ts - lastFrameTs < 66) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastFrameTs = ts;

      const elapsed = videoEl.currentTime * 1000;
      const duration = (videoEl.duration || 1) * 1000;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 99);
      onProgress({ phase: `영상 합성 중... ${pct}%`, percent: pct });

      // ── 1. Background gradient ──────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, template.gradientColors[0]);
      grad.addColorStop(1, template.gradientColors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── 2. Decorative elements ──────────────────────────────────────────
      if (template.decorativeElements) {
        drawDecorative(ctx, template.decorativeElements, template.accentColor, W, H, elapsed);
      }

      // ── 3. TOP ZONE (top 15%) ───────────────────────────────────────────
      const topH = H * 0.15;
      if (template.topZone) {
        const tz = template.topZone;
        ctx.fillStyle = tz.bgColor;
        ctx.fillRect(0, 0, W, topH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = tz.textColor;
        ctx.font = (tz.bold ? 'bold ' : '') + (tz.fontSize ?? 22) + 'px Arial, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 4;
        ctx.fillText(tz.text, W / 2, topH * (tz.subtext ? 0.40 : 0.50));

        if (tz.subtext) {
          ctx.font = '14px Arial, sans-serif';
          ctx.globalAlpha = 0.82;
          ctx.fillText(tz.subtext, W / 2, topH * 0.72);
          ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
      }

      // ── 4. USER VIDEO in clipArea ───────────────────────────────────────
      const ca = template.clipArea;
      const cx = ca.xPct * W;
      const cy = ca.yPct * H;
      const cw = ca.wPct * W;
      const ch = ca.hPct * H;
      const cr = ca.borderRadius;

      // Glow effect
      if (ca.glowColor) {
        ctx.save();
        ctx.shadowColor = ca.glowColor;
        ctx.shadowBlur = 28;
        ctx.strokeStyle = ca.glowColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        rrPath(ctx, cx, cy, cw, ch, cr);
        ctx.stroke();
        ctx.restore();
      }

      // Clip and draw video
      ctx.save();
      ctx.beginPath();
      rrPath(ctx, cx, cy, cw, ch, cr);
      ctx.clip();
      if (videoEl.readyState >= 2) {
        ctx.drawImage(videoEl, cx, cy, cw, ch);
      } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(cx, cy, cw, ch);
        ctx.fillStyle = '#666';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('로딩 중...', cx + cw / 2, cy + ch / 2);
      }
      ctx.restore();

      // Border
      if (ca.borderColor && ca.borderWidth) {
        ctx.strokeStyle = ca.borderColor;
        ctx.lineWidth = ca.borderWidth;
        ctx.beginPath();
        rrPath(ctx, cx, cy, cw, ch, cr);
        ctx.stroke();
      }

      // ── 5. BOTTOM ZONE (bottom 15%) ────────────────────────────────────
      const botY = H * 0.85;
      const botH = H * 0.15;
      if (template.bottomZone) {
        const bz = template.bottomZone;
        ctx.fillStyle = bz.bgColor;
        ctx.fillRect(0, botY, W, botH);

        if (bz.scrolling) {
          tickerOffset += 1.8;
          const tickerText = bz.text + '   ';
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, botY, W, botH);
          ctx.clip();
          ctx.font = (bz.fontSize ?? 14) + 'px Arial, sans-serif';
          ctx.fillStyle = bz.textColor ?? '#fff';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          const tw = ctx.measureText(tickerText).width;
          const x = W - (tickerOffset % tw);
          ctx.fillText(tickerText + tickerText, x, botY + botH / 2);
          ctx.restore();
        } else {
          ctx.font =
            (bz.bold ? 'bold ' : '') + (bz.fontSize ?? 14) + 'px Arial, sans-serif';
          ctx.fillStyle = bz.textColor ?? '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bz.text, W / 2, botY + botH / 2);
        }
      }

      // ── 6. TEXT OVERLAYS ────────────────────────────────────────────────
      for (const ov of template.text_overlays) {
        if (elapsed < ov.start_ms || elapsed > ov.end_ms) continue;
        const prog = (elapsed - ov.start_ms) / Math.max(1, ov.end_ms - ov.start_ms);
        let alpha = 1;
        if (prog < 0.08) alpha = prog / 0.08;
        if (prog > 0.92) alpha = (1 - prog) / 0.08;
        alpha = Math.max(0, Math.min(1, alpha));

        ctx.save();
        ctx.globalAlpha = alpha;

        const ox = ov.xPct * W;
        let oy = ov.yPct * H;

        // Animations
        if (ov.animation === 'slide_up' && prog < 0.15) {
          oy += 22 * (1 - prog / 0.15);
        }
        if (ov.animation === 'bounce') {
          oy += Math.sin(elapsed / 200) * 5;
        }
        if (ov.animation === 'slide_left' && prog < 0.15) {
          ctx.globalAlpha = alpha * (prog / 0.15);
        }

        ctx.font =
          (ov.bold ? 'bold ' : '') + ov.fontSize + 'px Arial, sans-serif';
        const tw = ctx.measureText(ov.text).width;
        const th = ov.fontSize + 6;

        // Optional background pill
        if (ov.bgColor) {
          ctx.fillStyle = ov.bgColor;
          const px = 16;
          const py = 8;
          const bx =
            ov.align === 'center'
              ? ox - tw / 2 - px
              : ov.align === 'right'
              ? ox - tw - px
              : ox - px;
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(bx, oy - th / 2 - py, tw + px * 2, th + py * 2, 8);
          } else {
            ctx.rect(bx, oy - th / 2 - py, tw + px * 2, th + py * 2);
          }
          ctx.fill();
        }

        ctx.fillStyle = ov.color;
        ctx.textAlign = (ov.align ?? 'center') as CanvasTextAlign;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 7;
        ctx.fillText(ov.text, ox, oy);
        ctx.restore();
      }

      // ── 7. Vignette ─────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(
        W / 2, H / 2, H * 0.23,
        W / 2, H / 2, H * 0.73,
      );
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      if (!videoEl.ended) {
        animId = requestAnimationFrame(render);
      }
    }

    videoEl.onloadedmetadata = () => {
      onProgress({ phase: '합성 준비 중...', percent: 0 });
      mr.start(200);
      videoEl.play().then(() => {
        animId = requestAnimationFrame(render);
      }).catch(reject);
    };

    videoEl.onended = () => {
      cancelAnimationFrame(animId);
      onProgress({ phase: '마무리 중...', percent: 99 });
      setTimeout(() => {
        if (mr.state !== 'inactive') mr.stop();
      }, 700);
    };

    videoEl.onerror = () => {
      try { document.body.removeChild(videoEl); } catch { /* ignore */ }
      URL.revokeObjectURL(videoUrl);
      reject(new Error('영상 로드 실패. 다시 촬영해주세요.'));
    };

    // Safety timeout: 7 minutes
    const safety = setTimeout(() => {
      cancelAnimationFrame(animId);
      if (mr.state !== 'inactive') mr.stop();
    }, 7 * 60 * 1000);

    mr.addEventListener('stop', () => clearTimeout(safety), { once: true });
  });
}
