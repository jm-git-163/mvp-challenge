/**
 * soundUtils.ts — Web Audio API 효과음 + 음성 판정 멘트 (강화판)
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (_ctx.state === 'suspended') { _ctx.resume().catch(() => {}); }
  return _ctx;
}

export type SoundType =
  | 'perfect'
  | 'good'
  | 'fail'
  | 'tick'
  | 'start'
  | 'combo'
  | 'amazing'
  | 'oops'
  | 'mission_clear'
  | 'countdown_end';

// Helper to play a single tone with smooth attack
function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain = 0.3,
  type: OscillatorType = 'sine',
): void {
  const osc      = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function playSound(type: SoundType): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  switch (type) {
    case 'perfect':
      // Bright ascending 3-note fanfare: C5→E5→G5→C6
      tone(ctx, 523,  t,       0.15, 0.25, 'triangle');
      tone(ctx, 659,  t + 0.12, 0.15, 0.25, 'triangle');
      tone(ctx, 784,  t + 0.24, 0.15, 0.25, 'triangle');
      tone(ctx, 1047, t + 0.36, 0.30, 0.30, 'triangle');
      // Sparkle layer
      tone(ctx, 2093, t + 0.38, 0.20, 0.10, 'sine');
      break;

    case 'good':
      // Warm 2-note ping: C5→E5
      tone(ctx, 523, t,        0.18, 0.22, 'sine');
      tone(ctx, 659, t + 0.14, 0.22, 0.22, 'sine');
      break;

    case 'fail': {
      // Descending whoosh: E4→C4
      const failOsc  = ctx.createOscillator();
      const failGain = ctx.createGain();
      failOsc.type = 'sawtooth';
      failOsc.frequency.setValueAtTime(330, t);
      failOsc.frequency.linearRampToValueAtTime(180, t + 0.35);
      failGain.gain.setValueAtTime(0.15, t);
      failGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      failOsc.connect(failGain);
      failGain.connect(ctx.destination);
      failOsc.start(t);
      failOsc.stop(t + 0.45);
      break;
    }

    case 'tick':
      // Crisp click
      tone(ctx, 880, t, 0.06, 0.15, 'square');
      break;

    case 'countdown_end':
      // Powerful impact boom
      tone(ctx, 110, t,        0.30, 0.35, 'sawtooth');
      tone(ctx, 220, t + 0.05, 0.25, 0.28, 'square');
      tone(ctx, 440, t + 0.08, 0.15, 0.22, 'triangle');
      break;

    case 'start':
      // Energetic 4-note riff
      tone(ctx, 392, t,        0.12, 0.20, 'square');
      tone(ctx, 523, t + 0.10, 0.12, 0.20, 'square');
      tone(ctx, 659, t + 0.20, 0.12, 0.20, 'square');
      tone(ctx, 784, t + 0.30, 0.20, 0.30, 'square');
      break;

    case 'combo':
      // Exciting glissando up
      [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => {
        tone(ctx, f, t + i * 0.06, 0.10, 0.18, 'triangle');
      });
      break;

    case 'amazing':
      // Triumphant full chord
      [523, 659, 784, 1047].forEach(f => tone(ctx, f, t, 0.50, 0.20, 'sine'));
      tone(ctx, 2093, t + 0.1, 0.30, 0.08, 'triangle');
      break;

    case 'oops': {
      // Wah-wah trombone effect
      const oopsOsc    = ctx.createOscillator();
      const oopsGain   = ctx.createGain();
      const oopsFilter = ctx.createBiquadFilter();
      oopsOsc.type = 'sawtooth';
      oopsOsc.frequency.value = 200;
      oopsFilter.type = 'bandpass';
      oopsFilter.frequency.setValueAtTime(800, t);
      oopsFilter.frequency.linearRampToValueAtTime(200, t + 0.4);
      oopsGain.gain.setValueAtTime(0.20, t);
      oopsGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      oopsOsc.connect(oopsFilter);
      oopsFilter.connect(oopsGain);
      oopsGain.connect(ctx.destination);
      oopsOsc.start(t);
      oopsOsc.stop(t + 0.5);
      break;
    }

    case 'mission_clear':
      // Celebratory fanfare
      [523, 659, 784, 880, 1047].forEach((f, i) => {
        tone(ctx, f, t + i * 0.09, 0.18, 0.22, 'triangle');
      });
      break;
  }
}

export function initAudio(): void {
  getCtx();
}

// ── 판정 음성 멘트 (SpeechSynthesis) ──

const SPEAK_PHRASES: Record<string, string[]> = {
  perfect: ['완벽해요!', '퍼펙트!', '대박이에요!', '최고예요!', '훌륭해요!'],
  good:    ['잘했어요!', '좋아요!', '굿!', '멋져요!'],
  fail:    ['아쉬워요!', '다시 해봐요!', '괜찮아요~'],
  combo:   ['콤보!', '연속 성공!', '대단해요!'],
};

let lastSpeakTime = 0;

export function speakJudgement(type: 'perfect' | 'good' | 'fail' | 'combo'): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastSpeakTime < 2000) return;
  lastSpeakTime = now;

  try {
    const phrases = SPEAK_PHRASES[type] ?? [];
    if (!phrases.length) return;
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang   = 'ko-KR';
    u.rate   = 1.1;
    u.pitch  = 1.2;
    u.volume = 0.8;
    const koVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function speakMission(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang   = 'ko-KR';
    u.rate   = 1.0;
    u.pitch  = 1.0;
    u.volume = 0.85;
    const koVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
