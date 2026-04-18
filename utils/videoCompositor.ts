/**
 * videoCompositor.ts
 * 실시간 캔버스 합성기 — 영상 재생하면서 캔버스에 그려 MediaRecorder로 캡처
 * 영상 길이만큼 소요되므로 frame-by-frame CPU 렌더링보다 훨씬 빠름
 */

export interface RecordedClip {
  slot_id: string;
  blob: Blob;
  duration_ms: number;
}

export interface CompositorProgress {
  phase: string;
  percent: number;
}

// VideoTemplate is imported from videoTemplates.ts
export async function composeVideo(
  template: import('./videoTemplates').VideoTemplate,
  clips: RecordedClip[],
  onProgress: (p: CompositorProgress) => void,
): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('브라우저 환경 필요');
  }

  const primaryBlob = clips[0]?.blob;
  if (!primaryBlob) throw new Error('녹화된 클립이 없습니다');

  const videoUrl = URL.createObjectURL(primaryBlob);
  const W = 720, H = 1280;

  return new Promise((resolve, reject) => {
    // Hidden video element
    const videoEl = document.createElement('video');
    videoEl.src = videoUrl;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.crossOrigin = 'anonymous';
    videoEl.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(videoEl);

    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

    // MediaRecorder
    const stream = canvas.captureStream(15);
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
      '',
    ];
    const mimeType = mimeTypes.find((m) => !m || MediaRecorder.isTypeSupported(m)) ?? '';
    const mr = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined,
    );
    const chunks: BlobPart[] = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const origOnStop = () => {
      try {
        document.body.removeChild(videoEl);
      } catch {
        // ignore
      }
      URL.revokeObjectURL(videoUrl);
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      resolve(blob);
    };

    mr.onstop = origOnStop;

    let animId = 0;
    let recording = false;
    let lastFrameTime = 0;

    function renderFrame(ts: number) {
      if (!recording) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const now = ts;
      if (now - lastFrameTime < 66) {
        // cap at ~15fps
        animId = requestAnimationFrame(renderFrame);
        return;
      }
      lastFrameTime = now;

      const elapsed = videoEl.currentTime * 1000;
      const duration = (videoEl.duration || 1) * 1000;
      const pct = Math.min((elapsed / duration) * 100, 99);
      onProgress({ phase: `영상 합성 중... ${Math.round(pct)}%`, percent: Math.round(pct) });

      const colors = template.gradientColors || (['#1a1a2e', '#16213e'] as [string, string]);

      // 1. Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 2. User video frame (center slot, 65% height)
      const clipH = Math.round(H * 0.65);
      const clipY = Math.round((H - clipH) * 0.45); // slightly above center
      const clipX = 16;
      const clipW = W - 32;

      if (videoEl.readyState >= 2) {
        ctx.save();
        ctx.beginPath();
        const r = 16;
        ctx.moveTo(clipX + r, clipY);
        ctx.lineTo(clipX + clipW - r, clipY);
        ctx.quadraticCurveTo(clipX + clipW, clipY, clipX + clipW, clipY + r);
        ctx.lineTo(clipX + clipW, clipY + clipH - r);
        ctx.quadraticCurveTo(clipX + clipW, clipY + clipH, clipX + clipW - r, clipY + clipH);
        ctx.lineTo(clipX + r, clipY + clipH);
        ctx.quadraticCurveTo(clipX, clipY + clipH, clipX, clipY + clipH - r);
        ctx.lineTo(clipX, clipY + r);
        ctx.quadraticCurveTo(clipX, clipY, clipX + r, clipY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(videoEl, clipX, clipY, clipW, clipH);
        ctx.restore();

        // Border around clip
        ctx.save();
        ctx.strokeStyle = template.accentColor || 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(clipX + r, clipY);
        ctx.lineTo(clipX + clipW - r, clipY);
        ctx.quadraticCurveTo(clipX + clipW, clipY, clipX + clipW, clipY + r);
        ctx.lineTo(clipX + clipW, clipY + clipH - r);
        ctx.quadraticCurveTo(clipX + clipW, clipY + clipH, clipX + clipW - r, clipY + clipH);
        ctx.lineTo(clipX + r, clipY + clipH);
        ctx.quadraticCurveTo(clipX, clipY + clipH, clipX, clipY + clipH - r);
        ctx.lineTo(clipX, clipY + r);
        ctx.quadraticCurveTo(clipX, clipY, clipX + r, clipY);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // 3. Top bar
      if (template.topBar) {
        ctx.save();
        ctx.fillStyle = template.topBar.bg || 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, 60);
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillStyle = template.topBar.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.topBar.text, W / 2, 30);
        ctx.restore();
      }

      // 4. Text overlays
      for (const ov of template.text_overlays || []) {
        if (elapsed < ov.start_ms || elapsed > ov.end_ms) continue;
        const prog = (elapsed - ov.start_ms) / Math.max(ov.end_ms - ov.start_ms, 1);
        let alpha = 1;
        if (prog < 0.08) alpha = prog / 0.08;
        if (prog > 0.92) alpha = (1 - prog) / 0.08;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.font = `bold ${ov.fontSize || 36}px Arial, sans-serif`;
        ctx.fillStyle = ov.color || '#ffffff';
        ctx.textAlign = (ov.align as CanvasTextAlign) || 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;

        const x = ov.align === 'left' ? 40 : ov.align === 'right' ? W - 40 : W / 2;
        let y = H * (ov.yPct ?? 0.12);

        if (ov.animation === 'slide_up' && prog < 0.15) {
          y += 24 * (1 - prog / 0.15);
        }

        // Background pill for readability
        const metrics = ctx.measureText(ov.text);
        const tw = metrics.width;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.65;
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.beginPath();
        const ph = (ov.fontSize || 36) + 16;
        ctx.roundRect?.(x - tw / 2 - 12, y - ph / 2, tw + 24, ph, 8);
        ctx.fill();

        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = ov.color || '#ffffff';
        ctx.fillText(ov.text, x, y);
        ctx.restore();
      }

      // 5. Bottom bar / hashtag
      if (template.bottomBar) {
        ctx.save();
        ctx.fillStyle = template.bottomBar.bg || 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, H - 56, W, 56);
        ctx.font = '18px Arial, sans-serif';
        ctx.fillStyle = template.bottomBar.color || 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(template.bottomBar.text, W / 2, H - 28);
        ctx.restore();
      }

      // 6. Vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      if (!videoEl.ended && !videoEl.paused) {
        animId = requestAnimationFrame(renderFrame);
      }
    }

    videoEl.onloadedmetadata = () => {
      onProgress({ phase: '합성 준비 중...', percent: 0 });
      mr.start(200);
      recording = true;
      videoEl.play().then(() => {
        animId = requestAnimationFrame(renderFrame);
      }).catch(reject);
    };

    videoEl.onended = () => {
      cancelAnimationFrame(animId);
      onProgress({ phase: '마무리 중...', percent: 99 });
      setTimeout(() => {
        if (mr.state !== 'inactive') mr.stop();
      }, 600);
    };

    videoEl.onerror = () => {
      try {
        document.body.removeChild(videoEl);
      } catch {
        // ignore
      }
      URL.revokeObjectURL(videoUrl);
      reject(new Error('동영상을 불러올 수 없습니다. 다시 촬영해주세요.'));
    };

    // Safety timeout: 5 minutes
    const safetyTimer = setTimeout(() => {
      cancelAnimationFrame(animId);
      if (mr.state !== 'inactive') mr.stop();
    }, 5 * 60 * 1000);

    // Wrap onstop to clear safety timer
    mr.onstop = function () {
      clearTimeout(safetyTimer);
      origOnStop();
    };
  });
}
