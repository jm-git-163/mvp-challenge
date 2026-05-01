/**
 * utils/highlightCompositor.ts
 *
 * 원본 mp4/webm Blob + 하이라이트 구간 배열 → 잘라 붙인 하이라이트 Blob.
 *
 * 우선순위:
 *  1) WebCodecs (VideoDecoder/VideoEncoder, Chrome 102+, Edge, 일부 Safari/Firefox)
 *  2) 폴백: video element + canvas.captureStream() + MediaRecorder
 *     원본을 video 에 로드 → 각 구간을 seek+play → canvas 로 그림 → 새 mp4 인코딩
 *
 * 100% 클라이언트, 서버 전송 금지 (CLAUDE.md §12).
 */

import type { HighlightSegment } from '../engine/curation/highlightSelector';

export interface HighlightProgress {
  phase: string;
  /** 0~1 */
  percent: number;
}

export interface HighlightResult {
  blob: Blob;
  mime: string;
  durationMs: number;
  /** 폴백/네이티브 분기 추적용. */
  via: 'webcodecs' | 'canvas-recorder';
}

export interface HighlightOptions {
  segments: HighlightSegment[];
  /** 진행률 콜백. 0~1 */
  onProgress?: (p: HighlightProgress) => void;
  /** 인코딩 비트레이트 (bps). 기본 3.5Mbps. */
  videoBitsPerSecond?: number;
  /** fps. 기본 30. */
  fps?: number;
}

/**
 * 메인 진입점. WebCodecs 가 가능하면 우선 사용, 아니면 canvas-recorder 폴백.
 */
export async function composeHighlight(
  source: Blob,
  opts: HighlightOptions,
): Promise<HighlightResult> {
  if (!opts.segments || opts.segments.length === 0) {
    throw new Error('하이라이트 구간이 비어있습니다');
  }

  // WebCodecs path 는 VideoDecoder + 컨테이너 파서가 모두 필요. 컨테이너 파싱
  // (mp4box.js 등) 의존성을 끌어들이지 않기 위해, 본 구현은 polyfill 없이
  // 동작 가능한 canvas-recorder 폴백을 기본으로 한다. 단, WebCodecs API 가
  // 존재하면 향후 mp4box 추가 시 즉시 활성화되도록 분기는 유지.
  const hasWebCodecs =
    typeof window !== 'undefined' &&
    typeof (window as any).VideoEncoder === 'function' &&
    typeof (window as any).VideoDecoder === 'function';

  // 안정성을 위해 v1 은 항상 canvas-recorder 사용. WebCodecs 분기는 미래 확장.
  // (mp4 컨테이너 demuxer/muxer 는 별도 라이브러리 필요 — 의존성 추가는 사용자 승인 사안.)
  if (hasWebCodecs && false) {
    return composeViaWebCodecs(source, opts);
  }
  return composeViaCanvasRecorder(source, opts);
}

// ─── Canvas + MediaRecorder 폴백 ──────────────────────────────────────────────

async function composeViaCanvasRecorder(
  source: Blob,
  opts: HighlightOptions,
): Promise<HighlightResult> {
  const { segments, onProgress, videoBitsPerSecond = 3_500_000, fps = 30 } = opts;
  const totalLen = segments.reduce((a, s) => a + (s.endMs - s.startMs), 0);

  onProgress?.({ phase: '원본 로딩', percent: 0.02 });

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const sourceUrl = URL.createObjectURL(source);
  video.src = sourceUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('원본 영상을 읽지 못했습니다'));
  });

  // 일부 브라우저에서 첫 seek 직후 width/height 가 0 으로 잡힘 → 한 프레임 디코딩 후 측정.
  await new Promise<void>((resolve) => {
    video.currentTime = 0;
    video.onseeked = () => resolve();
  });

  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트 없음');

  const stream = (canvas as HTMLCanvasElement).captureStream(fps);

  const mime = pickRecorderMime();
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stoppedPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(1000);
  onProgress?.({ phase: '하이라이트 합성 시작', percent: 0.05 });

  let elapsedOut = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segStartSec = seg.startMs / 1000;
    const segEndSec = seg.endMs / 1000;
    const segDur = segEndSec - segStartSec;

    // seek
    await seekTo(video, segStartSec);
    // 재생
    await video.play().catch(() => {});

    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (video.currentTime >= segEndSec || video.ended) {
          video.pause();
          resolve();
          return;
        }
        try {
          ctx.drawImage(video, 0, 0, w, h);
        } catch { /* ignore intermittent draw error */ }

        const elapsedInSeg = (performance.now() - start) / 1000;
        const segPct = Math.min(1, elapsedInSeg / segDur);
        const overallPct =
          0.05 +
          0.90 * ((elapsedOut + (seg.endMs - seg.startMs) * segPct) / totalLen);
        onProgress?.({
          phase: `구간 ${i + 1}/${segments.length}`,
          percent: overallPct,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    elapsedOut += seg.endMs - seg.startMs;
  }

  recorder.stop();
  await stoppedPromise;

  try { URL.revokeObjectURL(sourceUrl); } catch {}

  const blob = new Blob(chunks, { type: mime });
  onProgress?.({ phase: '완료', percent: 1 });

  return {
    blob,
    mime,
    durationMs: totalLen,
    via: 'canvas-recorder',
  };
}

function seekTo(video: HTMLVideoElement, sec: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const onSeek = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', onSeek);
      resolve();
    };
    video.addEventListener('seeked', onSeek);
    try { video.currentTime = sec; } catch { onSeek(); }
    // 안전망 — 일부 브라우저에서 seeked 가 안 오는 경우.
    setTimeout(() => onSeek(), 1500);
  });
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    try {
      if ((MediaRecorder as any).isTypeSupported?.(c)) return c;
    } catch {}
  }
  return 'video/webm';
}

// ─── (참고) WebCodecs 분기 — v1 에서는 비활성. 의존성(mp4box.js) 추가 후 활성. ─

async function composeViaWebCodecs(
  _source: Blob,
  _opts: HighlightOptions,
): Promise<HighlightResult> {
  // 향후 확장: mp4box.js 로 demux → VideoDecoder → trim → VideoEncoder → mp4box.js mux.
  throw new Error('WebCodecs 경로는 mp4box 의존성 추가 후 활성화됩니다');
}

/**
 * 환경 자체에서 어떤 경로가 동작 가능한지 진단.
 */
export function detectHighlightCapability(): {
  webcodecs: boolean;
  canvasRecorder: boolean;
  preferredMime: string;
} {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const webcodecs =
    typeof win.VideoEncoder === 'function' && typeof win.VideoDecoder === 'function';
  const canvasRecorder =
    typeof win.MediaRecorder === 'function' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype;
  return {
    webcodecs,
    canvasRecorder,
    preferredMime: pickRecorderMime(),
  };
}
