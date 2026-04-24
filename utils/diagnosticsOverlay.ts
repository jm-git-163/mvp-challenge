/**
 * diagnosticsOverlay.ts — FIX-Z22 (2026-04-22)
 *
 * 녹화 캔버스 좌상단에 4줄짜리 "라이브 인식 상태" 오버레이를 그린다.
 * 이 오버레이는 captureStream 을 통과하므로 최종 mp4 에도 박힌다 →
 * 실기기에서 유저가 "인식 3종(음성/포즈/스쿼트) 이 진짜 작동하는지"
 * 눈으로 즉시 검증 가능.
 *
 * 순수 함수 (DOM/React Native 의존 없음) — 단위테스트 용이.
 */

export interface DiagOverlayState {
  show: boolean;
  vListen: boolean;
  vText: string;
  vErr: string | null;
  vPre: boolean | null;     // null=아직 체크 전, true=ok, false=실패
  vSup: boolean;            // false=iOS Safari 등 webkitSpeechRecognition 미지원
  pStat: string;            // pose status: 'ready-real'|'ready-mock'|'loading'|'error'|...
  pLm: number;              // landmark count
  pReal: boolean;           // isRealPose (not mock)
  sCnt: number;             // squat count
  sTgt: number;             // target reps
  sPh: string;              // squat phase
  sRdy: boolean;            // squat counter armed
  sFace: boolean;           // face visible
  sBody: boolean;           // full body (for full-mode squat)
}

export interface DiagOverlayOpts {
  elapsedSec: number;
  isRecording: boolean;
  y0?: number;
  x0?: number;
  width?: number;
}

type Ctx2D = {
  save: () => void;
  restore: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (t: string, x: number, y: number) => void;
  fillStyle: string;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

export function drawDiagnosticsOverlay(
  ctx: Ctx2D,
  d: DiagOverlayState,
  opts: DiagOverlayOpts,
): void {
  if (!d.show) return;
  const LINE_H = 30;
  const X = opts.x0 ?? 8;
  const Y0 = opts.y0 ?? 34;
  const W = opts.width ?? 704;

  const voiceStatus = !d.vSup
    ? 'iOS 미지원'
    : d.vPre === false
      ? '권한필요'
      : d.vErr
        ? `ERR:${d.vErr}`
        : d.vListen
          ? (d.vText ? '듣는중' : '말하세요')
          : '대기';
  const voiceColor = !d.vSup || d.vPre === false || d.vErr
    ? '#ff6b6b'
    : d.vListen && d.vText
      ? '#7fffd4'
      : '#ffcc00';

  const poseLabel = d.pStat === 'ready-real' && d.pReal ? 'ready-real' : d.pStat;
  const poseColor = d.pStat === 'ready-real' && d.pReal && d.pLm > 0
    ? '#7fffd4'
    : d.pStat === 'ready-mock'
      ? '#ffcc00'
      : '#ff6b6b';

  const sqGate = d.sBody ? 'body-ok' : d.sFace ? 'face-only' : 'no-pose';
  const squatColor = d.sRdy && d.sBody ? '#7fffd4' : d.sFace ? '#ffcc00' : '#ff6b6b';

  const rec = `${Math.floor(opts.elapsedSec)}s`;
  const recColor = opts.isRecording ? '#ff6b6b' : '#888';

  const lines: Array<{ text: string; color: string }> = [
    { text: `MIC  ${voiceStatus}  "${(d.vText || '').slice(0, 30)}"`, color: voiceColor },
    { text: `POSE ${poseLabel}  lm=${d.pLm}  real=${d.pReal ? 'Y' : 'N'}`, color: poseColor },
    { text: `SQT  ${d.sCnt}/${d.sTgt}  ph:${d.sPh}  ${sqGate}  ${d.sRdy ? 'armed' : 'idle'}`, color: squatColor },
    { text: `${opts.isRecording ? 'REC' : '---'}  ${rec}`, color: recColor },
  ];

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px monospace, system-ui';
  for (let i = 0; i < lines.length; i++) {
    const y = Y0 + i * LINE_H;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(X, y, W, LINE_H - 2);
    ctx.fillStyle = lines[i].color;
    ctx.fillRect(X, y, 4, LINE_H - 2);
    ctx.fillStyle = lines[i].color;
    ctx.fillText(lines[i].text, X + 10, y + (LINE_H - 2) / 2);
  }
  ctx.restore();
}
