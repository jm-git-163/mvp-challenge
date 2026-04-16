/**
 * soundUtils.ts
 * Web Audio API 기반 효과음 (설치 없이 브라우저에서 동작)
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain = 0.28,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  env.gain.setValueAtTime(gain, startTime);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playSound(type: 'perfect' | 'good' | 'fail' | 'tick' | 'start' | 'combo') {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  switch (type) {
    case 'perfect':
      // 상승 아르페지오
      tone(ctx, 523, t,       0.12);
      tone(ctx, 659, t + 0.1, 0.12);
      tone(ctx, 784, t + 0.2, 0.15);
      tone(ctx, 1047,t + 0.3, 0.25);
      break;
    case 'good':
      tone(ctx, 523, t,       0.12);
      tone(ctx, 659, t + 0.1, 0.18);
      break;
    case 'fail':
      tone(ctx, 330, t,       0.08, 0.2, 'sawtooth');
      tone(ctx, 220, t + 0.1, 0.15, 0.2, 'sawtooth');
      break;
    case 'tick':
      tone(ctx, 1000, t, 0.05, 0.15, 'square');
      break;
    case 'start':
      tone(ctx, 392, t,       0.1);
      tone(ctx, 523, t + 0.12,0.1);
      tone(ctx, 659, t + 0.24,0.1);
      tone(ctx, 784, t + 0.36,0.3);
      break;
    case 'combo':
      tone(ctx, 880, t, 0.08, 0.22);
      tone(ctx, 1109,t + 0.1, 0.15, 0.22);
      break;
  }
}

export function initAudio() {
  getCtx(); // 사용자 인터랙션 후 AudioContext 초기화
}
