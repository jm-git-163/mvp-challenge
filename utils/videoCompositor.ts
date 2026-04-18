/**
 * videoCompositor.ts
 * Canvas API 기반 비디오 합성기 — CapCut 스타일 템플릿 + 사용자 클립 합성
 */

export interface ClipSlot {
  id: string;
  start_ms: number;         // 합성 영상에서 이 슬롯의 시작 시간
  end_ms: number;           // 합성 영상에서 이 슬롯의 종료 시간
  x: number;                // 0~1 (비율)
  y: number;
  width: number;            // 0~1 (비율)
  height: number;           // 0~1 (비율)
  border_radius?: number;
  border_color?: string;
  effect?: 'none' | 'zoom_in' | 'fade_in' | 'slide_left';
  label?: string;           // 미션 이름
}

export interface TextOverlay {
  start_ms: number;
  end_ms: number;
  text: string;
  x: number;               // 0~1
  y: number;               // 0~1
  font_size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  animation?: 'fade' | 'slide_up' | 'bounce';
  bg_color?: string;
  weight?: 'normal' | 'bold';
}

export interface VideoTemplate {
  id: string;
  name: string;
  duration_ms: number;
  aspect_ratio: '9:16' | '1:1' | '16:9';
  background: string;       // CSS gradient or color
  clip_slots: ClipSlot[];
  text_overlays: TextOverlay[];
  bgm_bpm?: number;
  hashtags: string[];
  caption_template: string;
}

export interface RecordedClip {
  slot_id: string;
  blob: Blob;
  duration_ms: number;
}

export type CompositorProgress = { phase: string; percent: number };

export async function composeVideo(
  template: VideoTemplate,
  clips: RecordedClip[],
  onProgress?: (p: CompositorProgress) => void,
): Promise<Blob> {
  const W = 720, H = 1280; // 9:16 vertical
  const FPS = 30;
  const totalFrames = Math.ceil((template.duration_ms / 1000) * FPS);

  // Load clips as HTMLVideoElements
  onProgress?.({ phase: '클립 불러오는 중...', percent: 5 });
  const videoEls: Map<string, HTMLVideoElement> = new Map();

  for (const clip of clips) {
    const url = URL.createObjectURL(clip.blob);
    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.preload = 'auto';
    vid.playsInline = true;
    await new Promise<void>((res) => {
      vid.onloadeddata = () => res();
      vid.onerror = () => res(); // continue even if error
      setTimeout(res, 3000);
    });
    videoEls.set(clip.slot_id, vid);
  }

  onProgress?.({ phase: '캔버스 합성 중...', percent: 15 });

  // Canvas setup
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // MediaRecorder setup
  const stream = canvas.captureStream(FPS);
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  await new Promise<void>((res) => {
    recorder.onstart = () => res();
    recorder.start(100);
  });

  // Parse background gradient colors (simple: pull first and last hex/rgb)
  function parseBgColors(bg: string): [string, string] {
    const matches = bg.match(/#[0-9a-fA-F]{3,6}|rgb[a]?\([^)]+\)/g);
    if (matches && matches.length >= 2) return [matches[0], matches[matches.length - 1]];
    if (matches && matches.length === 1) return [matches[0], matches[0]];
    return ['#1a1a2e', '#16213e'];
  }

  const [bgColor0, bgColor1] = parseBgColors(template.background);

  // Render frames
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeMs = (frame / FPS) * 1000;

    // 1. Background
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, bgColor0);
    grad.addColorStop(1, bgColor1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 2. Draw active clip slots
    for (const slot of template.clip_slots) {
      if (timeMs >= slot.start_ms && timeMs < slot.end_ms) {
        const vid = videoEls.get(slot.id);
        if (vid && vid.readyState >= 2) {
          const slotTimeMs = timeMs - slot.start_ms;
          try {
            vid.currentTime = Math.min(slotTimeMs / 1000, Math.max(0, vid.duration - 0.05));
          } catch {
            // ignore seek errors
          }

          const sx = slot.x * W;
          const sy = slot.y * H;
          const sw = slot.width * W;
          const sh = slot.height * H;

          ctx.save();

          let scale = 1;
          if (slot.effect === 'zoom_in') {
            const t = (timeMs - slot.start_ms) / (slot.end_ms - slot.start_ms);
            scale = 1 + t * 0.05;
          } else if (slot.effect === 'fade_in') {
            const t = Math.min(1, (timeMs - slot.start_ms) / 500);
            ctx.globalAlpha = t;
          } else if (slot.effect === 'slide_left') {
            const t = Math.min(1, (timeMs - slot.start_ms) / 400);
            ctx.translate((1 - t) * W, 0);
          }

          if (slot.border_radius) {
            ctx.beginPath();
            ctx.roundRect(sx, sy, sw, sh, slot.border_radius);
            ctx.clip();
          }

          const drawX = sx - (sw * (scale - 1)) / 2;
          const drawY = sy - (sh * (scale - 1)) / 2;
          ctx.drawImage(vid, drawX, drawY, sw * scale, sh * scale);

          if (slot.border_color) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = slot.border_color;
            ctx.lineWidth = 3;
            if (slot.border_radius) {
              ctx.beginPath();
              ctx.roundRect(sx, sy, sw, sh, slot.border_radius);
              ctx.stroke();
            } else {
              ctx.strokeRect(sx, sy, sw, sh);
            }
          }

          ctx.restore();
        }
      }
    }

    // 3. Text overlays
    for (const overlay of template.text_overlays) {
      if (timeMs >= overlay.start_ms && timeMs < overlay.end_ms) {
        const t = (timeMs - overlay.start_ms) / (overlay.end_ms - overlay.start_ms);
        ctx.save();

        let alpha = 1;
        let offsetY = 0;

        if (overlay.animation === 'fade') {
          alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
        } else if (overlay.animation === 'slide_up') {
          offsetY = t < 0.2 ? (1 - t / 0.2) * 30 : 0;
          alpha = t < 0.1 ? t / 0.1 : 1;
        } else if (overlay.animation === 'bounce') {
          offsetY = Math.sin(timeMs * 0.01) * 5;
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.font = `${overlay.weight ?? 'bold'} ${overlay.font_size}px sans-serif`;
        ctx.textAlign = overlay.align;
        const ox = overlay.x * W;
        const oy = overlay.y * H + offsetY;

        if (overlay.bg_color) {
          const metrics = ctx.measureText(overlay.text);
          const pad = 10;
          ctx.fillStyle = overlay.bg_color;
          ctx.fillRect(
            ox - metrics.width / 2 - pad,
            oy - overlay.font_size - pad,
            metrics.width + pad * 2,
            overlay.font_size + pad * 2,
          );
        }

        ctx.fillStyle = overlay.color;
        ctx.fillText(overlay.text, ox, oy);
        ctx.restore();
      }
    }

    // 4. Vignette overlay
    ctx.save();
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Yield to browser occasionally and report progress
    if (frame % 10 === 0) {
      onProgress?.({ phase: '합성 중...', percent: 15 + (frame / totalFrames) * 70 });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.({ phase: '영상 저장 중...', percent: 90 });
  recorder.stop();

  await new Promise<void>((res) => { recorder.onstop = () => res(); });

  // Clean up blob URLs
  for (const [, vid] of videoEls) {
    URL.revokeObjectURL(vid.src);
  }

  onProgress?.({ phase: '완성!', percent: 100 });
  return new Blob(chunks, { type: mimeType });
}
