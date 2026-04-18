/**
 * soundUtils.ts — Web Audio API 효과음 + 음성 판정 멘트
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try { _ctx = new AudioContext(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(
  c: AudioContext,
  f: number,
  t: number,
  d: number,
  g = 0.3,
  type: OscillatorType = 'sine',
): void {
  const o = c.createOscillator();
  const e = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  e.gain.setValueAtTime(g, t);
  e.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(e);
  e.connect(c.destination);
  o.start(t);
  o.stop(t + d);
}

function chord(c: AudioContext, freqs: number[], t: number, d: number, g = 0.2): void {
  freqs.forEach((f) => tone(c, f, t, d, g));
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

export function playSound(type: SoundType): void {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  switch (type) {
    case 'perfect':
      chord(c, [523, 659, 784, 1047], t, 0.08, 0.15);
      chord(c, [659, 784, 1047, 1319], t + 0.12, 0.15, 0.2);
      tone(c, 1568, t + 0.28, 0.4, 0.25);
      break;

    case 'good':
      tone(c, 523, t, 0.1, 0.2);
      tone(c, 659, t + 0.1, 0.12, 0.2);
      tone(c, 784, t + 0.22, 0.2, 0.22);
      break;

    case 'fail':
    case 'oops':
      tone(c, 330, t, 0.1, 0.2, 'sawtooth');
      tone(c, 247, t + 0.12, 0.2, 0.2, 'sawtooth');
      break;

    case 'tick':
      tone(c, 1200, t, 0.04, 0.18, 'square');
      break;

    case 'start':
      [392, 523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.1, 0.12, 0.2));
      tone(c, 1047, t + 0.45, 0.5, 0.3);
      break;

    case 'combo':
      [880, 1109, 1319].forEach((f, i) => tone(c, f, t + i * 0.07, 0.1, 0.22));
      break;

    case 'amazing': {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
        tone(c, f, t + i * 0.06, 0.15, 0.2),
      );
      setTimeout(() => {
        const c2 = ctx();
        if (c2) chord(c2, [1047, 1319, 1568], c2.currentTime, 0.5, 0.3);
      }, 400);
      break;
    }

    case 'mission_clear':
      chord(c, [523, 659, 784], t, 0.1, 0.15);
      tone(c, 1047, t + 0.15, 0.4, 0.28);
      break;

    case 'countdown_end':
      chord(c, [784, 1047, 1319], t, 0.5, 0.35);
      break;
  }
}

// ── 판정 음성 멘트 (SpeechSynthesis) ──
const JUDGEMENT_PHRASES: Record<string, string[]> = {
  perfect: ['완벽해!', '퍼펙트!', '대박이에요!', '최고야!'],
  good:    ['굿!', '잘했어요!', '좋아요!', '훌륭해요!'],
  fail:    ['아쉬워~', '한번 더!', '다시 해봐요!'],
  amazing: ['어머나!', '믿을 수가 없어!', '완전 대박!'],
  combo:   ['콤보!', '연속 성공!', '멈추지 마!'],
};

let _lastSpeak = 0;

export function speakJudgement(type: keyof typeof JUDGEMENT_PHRASES): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - _lastSpeak < 2000) return; // 2초 쿨다운
  _lastSpeak = now;
  const phrases = JUDGEMENT_PHRASES[type];
  if (!phrases) return;
  const text = phrases[Math.floor(Math.random() * phrases.length)];
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 1.1;
  u.pitch = 1.2;
  u.volume = 0.9;
  // 한국어 목소리 우선
  const voices = window.speechSynthesis.getVoices();
  const koVoice = voices.find((v) => v.lang.startsWith('ko'));
  if (koVoice) u.voice = koVoice;
  window.speechSynthesis.speak(u);
}

export function initAudio(): void {
  ctx();
}

/**
 * speakMission — 미션 시작 시 안내 멘트 (SpeechSynthesis)
 * 판정 멘트와 달리 쿨다운 없음 (미션 전환마다 한 번씩 읽어줌)
 */
export function speakMission(text: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang   = 'ko-KR';
    u.rate   = 1.05;
    u.pitch  = 1.1;
    u.volume = 0.85;
    const voices  = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang.startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore — SpeechSynthesis not available
  }
}
