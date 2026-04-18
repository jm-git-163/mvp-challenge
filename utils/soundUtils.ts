// =============================================================================
// soundUtils.ts — Game-quality Web Audio BGM + sound effects
// No external dependencies beyond the Web Audio API and SpeechSynthesis API.
// =============================================================================

// ---------------------------------------------------------------------------
// AudioContext singleton
// ---------------------------------------------------------------------------
let _audioCtx: AudioContext | null = null;

export function initAudio(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

function getCtx(): AudioContext {
  return initAudio();
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function noteToHz(note: string): number {
  const notes: Record<string, number> = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0,  A3: 220.0,  B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,  A4: 440.0,  B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,  B5: 987.77,
    C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568.0,
    A2: 110.0,  Bb3: 233.08, Fs4: 369.99, Bb4: 466.16,
    Db4: 277.18, Eb4: 311.13, Ab4: 415.30, Gb4: 369.99,
  };
  return notes[note] ?? 440;
}

function makeGain(ctx: AudioContext, value: number, dest: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, ctx.currentTime);
  g.connect(dest);
  return g;
}

// Simple reverb: delay + feedback loop
function makeReverb(ctx: AudioContext, dest: AudioNode): GainNode {
  const input = ctx.createGain();
  const delayNode = ctx.createDelay(1.0);
  delayNode.delayTime.value = 0.3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  const dry = ctx.createGain();
  dry.gain.value = 0.75;

  input.connect(dry);
  dry.connect(dest);
  input.connect(delayNode);
  delayNode.connect(feedback);
  feedback.connect(delayNode);
  delayNode.connect(wet);
  wet.connect(dest);

  return input;
}

// Master compressor
function makeMasterCompressor(ctx: AudioContext): DynamicsCompressorNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  comp.connect(ctx.destination);
  return comp;
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------
export type SoundType =
  | 'perfect'
  | 'good'
  | 'fail'
  | 'tick'
  | 'countdown_end'
  | 'start'
  | 'combo'
  | 'amazing'
  | 'oops'
  | 'mission_clear';

export function playSound(type: SoundType): void {
  try {
    const ctx = getCtx();
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    const t = ctx.currentTime;

    switch (type) {
      case 'perfect': {
        // Bright ascending fanfare C5→E5→G5→C6 with sparkle overtone, 0.5s total
        const melody = [
          { freq: noteToHz('C5'), start: 0,    dur: 0.1 },
          { freq: noteToHz('E5'), start: 0.1,  dur: 0.1 },
          { freq: noteToHz('G5'), start: 0.2,  dur: 0.1 },
          { freq: noteToHz('C6'), start: 0.3,  dur: 0.2 },
        ];
        melody.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(g);
          g.connect(master);
          g.gain.setValueAtTime(0, t + start);
          g.gain.linearRampToValueAtTime(0.5, t + start + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
          osc.start(t + start);
          osc.stop(t + start + dur + 0.02);
        });
        // Sparkle overtone (triangle, high)
        const sparkle = ctx.createOscillator();
        const sg = ctx.createGain();
        sparkle.type = 'triangle';
        sparkle.frequency.setValueAtTime(noteToHz('C6') * 2, t + 0.3);
        sparkle.connect(sg);
        sg.connect(master);
        sg.gain.setValueAtTime(0.2, t + 0.3);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        sparkle.start(t + 0.3);
        sparkle.stop(t + 0.52);
        break;
      }

      case 'good': {
        // Warm 2-note ping, 0.25s
        const notes = [noteToHz('E5'), noteToHz('G5')];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(g);
          g.connect(master);
          const s = t + i * 0.12;
          g.gain.setValueAtTime(0, s);
          g.gain.linearRampToValueAtTime(0.4, s + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.13);
          osc.start(s);
          osc.stop(s + 0.15);
        });
        break;
      }

      case 'fail': {
        // Descending sawtooth whoosh with wah filter, 0.4s
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.4);
        filter.Q.value = 3;
        osc.connect(filter);
        filter.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.42);
        break;
      }

      case 'tick': {
        // Crisp click: sine 880 Hz, 0.06s
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.start(t);
        osc.stop(t + 0.07);
        break;
      }

      case 'countdown_end': {
        // Powerful boom: layered low freqs + impact, 0.35s
        [60, 80, 100].forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.exponentialRampToValueAtTime(20, t + 0.35);
          osc.connect(g);
          g.connect(master);
          g.gain.setValueAtTime(0.6, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t);
          osc.stop(t + 0.37);
        });
        // Noise burst impact
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.8;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.8, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        src.connect(ng);
        ng.connect(master);
        src.start(t);
        break;
      }

      case 'start': {
        // Energetic 4-note ascending riff
        const seq = [
          { note: 'C4', start: 0,    dur: 0.08 },
          { note: 'E4', start: 0.09, dur: 0.08 },
          { note: 'G4', start: 0.18, dur: 0.08 },
          { note: 'C5', start: 0.27, dur: 0.18 },
        ];
        seq.forEach(({ note, start, dur }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = noteToHz(note);
          osc.connect(g);
          g.connect(master);
          const s = t + start;
          g.gain.setValueAtTime(0.35, s);
          g.gain.exponentialRampToValueAtTime(0.001, s + dur);
          osc.start(s);
          osc.stop(s + dur + 0.02);
        });
        break;
      }

      case 'combo': {
        // 8-note glissando upward
        const base = 261.63; // C4
        for (let i = 0; i < 8; i++) {
          const freq = base * Math.pow(2, i / 12);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.connect(g);
          g.connect(master);
          const s = t + i * 0.06;
          g.gain.setValueAtTime(0.4, s);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.1);
          osc.start(s);
          osc.stop(s + 0.12);
        }
        break;
      }

      case 'amazing': {
        // Triumphant full chord with shimmer (C major + high shimmer)
        const chordFreqs = [
          noteToHz('C4'), noteToHz('E4'), noteToHz('G4'), noteToHz('C5'),
        ];
        chordFreqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          osc.connect(g);
          g.connect(master);
          g.gain.setValueAtTime(0.3, t);
          g.gain.linearRampToValueAtTime(0.3, t + 0.3);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          osc.start(t);
          osc.stop(t + 0.82);
        });
        // Shimmer
        const shimmer = ctx.createOscillator();
        const sg = ctx.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(noteToHz('C6'), t);
        shimmer.frequency.linearRampToValueAtTime(noteToHz('G6'), t + 0.5);
        shimmer.connect(sg);
        sg.connect(master);
        sg.gain.setValueAtTime(0.15, t);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        shimmer.start(t);
        shimmer.stop(t + 0.62);
        break;
      }

      case 'oops': {
        // Wah-wah trombone effect: BiquadFilter bandpass swept
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = noteToHz('Bb3');
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, t);
        filter.frequency.linearRampToValueAtTime(200, t + 0.2);
        filter.frequency.linearRampToValueAtTime(400, t + 0.4);
        filter.Q.value = 5;
        osc.connect(filter);
        filter.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.52);
        break;
      }

      case 'mission_clear': {
        // Celebratory 5-note fanfare
        const fanfare = [
          { note: 'C5', start: 0,    dur: 0.1 },
          { note: 'E5', start: 0.1,  dur: 0.1 },
          { note: 'G5', start: 0.2,  dur: 0.1 },
          { note: 'E5', start: 0.3,  dur: 0.1 },
          { note: 'C6', start: 0.4,  dur: 0.3 },
        ];
        fanfare.forEach(({ note, start, dur }) => {
          ['sine', 'triangle'].forEach((type) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type as OscillatorType;
            osc.frequency.value = noteToHz(note);
            osc.connect(g);
            g.connect(master);
            const s = t + start;
            g.gain.setValueAtTime(0.25, s);
            g.gain.exponentialRampToValueAtTime(0.001, s + dur);
            osc.start(s);
            osc.stop(s + dur + 0.02);
          });
        });
        break;
      }
    }
  } catch (e) {
    console.warn('[soundUtils] playSound error:', e);
  }
}

// ---------------------------------------------------------------------------
// TTS utilities
// ---------------------------------------------------------------------------
let _lastJudgementSpeak = 0;

export function speakJudgement(type: SoundType): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const now = Date.now();
  if (now - _lastJudgementSpeak < 2000) return;
  _lastJudgementSpeak = now;

  const map: Partial<Record<SoundType, string>> = {
    perfect:       '퍼펙트!',
    good:          '좋아요!',
    fail:          '아쉬워요',
    amazing:       '어메이징!',
    combo:         '콤보!',
    mission_clear: '미션 클리어!',
    oops:          '이런!',
  };
  const text = map[type];
  if (!text) return;

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'ko-KR';
  utt.rate = 1.1;
  window.speechSynthesis.speak(utt);
}

export function speakMission(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'ko-KR';
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// BGM Spec
// ---------------------------------------------------------------------------
export interface BGMSpec {
  genre: 'lofi' | 'news' | 'kpop' | 'bright' | 'fairy' | 'none';
  bpm: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Drum helpers (shared across genres)
// ---------------------------------------------------------------------------
function scheduleKick(
  ctx: AudioContext, dest: AudioNode,
  time: number, baseFreq: number, endFreq: number, duration: number, vol: number
) {
  // Pitched oscillator pitch envelope
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, time);
  osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
  osc.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.start(time); osc.stop(time + duration + 0.01);

  // Noise punch transient
  const bufLen = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.5, time);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(ng); ng.connect(dest);
  src.start(time);
}

function scheduleSnare(
  ctx: AudioContext, dest: AudioNode,
  time: number, filterFreq: number, duration: number, vol: number
) {
  const bufLen = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;
  const g = ctx.createGain();
  src.connect(filter); filter.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  src.start(time);
}

function scheduleHihat(
  ctx: AudioContext, dest: AudioNode,
  time: number, filterFreq: number, duration: number, vol: number
) {
  const bufLen = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  src.connect(filter); filter.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  src.start(time);
}

function scheduleClap(
  ctx: AudioContext, dest: AudioNode,
  time: number, vol: number
) {
  const bufLen = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 2;
  const g = ctx.createGain();
  src.connect(filter); filter.connect(g); g.connect(dest);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  src.start(time);
}

function scheduleNote(
  ctx: AudioContext, dest: AudioNode,
  type: OscillatorType, freq: number, time: number,
  attack: number, duration: number, vol: number,
  filterFreq?: number, filterType?: BiquadFilterType
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  let node: AudioNode = osc;
  if (filterFreq !== undefined) {
    const f = ctx.createBiquadFilter();
    f.type = filterType ?? 'lowpass';
    f.frequency.value = filterFreq;
    osc.connect(f);
    node = f;
  }

  const g = ctx.createGain();
  node.connect(g); g.connect(dest);
  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(vol, time + attack);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.start(time);
  osc.stop(time + duration + 0.01);
}

// ---------------------------------------------------------------------------
// Genre sequencer builders
// ---------------------------------------------------------------------------

// Chord frequency arrays (root + chord tones)
const AM7  = [noteToHz('A3'), noteToHz('C4'), noteToHz('E4'), noteToHz('G4')];
const CM   = [noteToHz('C4'), noteToHz('E4'), noteToHz('G4')];
const GM   = [noteToHz('G3'), noteToHz('B3'), noteToHz('D4')];
const FM   = [noteToHz('F3'), noteToHz('A3'), noteToHz('C4')];
const EM   = [noteToHz('E3'), noteToHz('G3'), noteToHz('B3')];
const AM   = [noteToHz('A3'), noteToHz('C4'), noteToHz('E4')];
const B7   = [noteToHz('B3'), noteToHz('Fs4'), noteToHz('A4'), noteToHz('Db4')];
const CGAF = [CM, GM, AM, FM];
const pentatonic = [noteToHz('A4'), noteToHz('C5'), noteToHz('D5'), noteToHz('E5'), noteToHz('G5')];

function buildLofi(ctx: AudioContext, dest: AudioNode, bpm: number, vol: number): () => void {
  const reverb = makeReverb(ctx, dest);
  const secPerBeat = 60 / bpm;
  const bar = secPerBeat * 4; // 4/4 time
  let startTime = ctx.currentTime + 0.1;
  let stopped = false;
  const chordProg = [AM7, CM, GM, FM];

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    while (startTime < now + 0.4) {
      // 2-bar loop
      for (let b = 0; b < 8; b++) {
        const beatTime = startTime + b * secPerBeat;
        const barIdx = Math.floor(b / 4);

        // Kick: beats 1, 3 (beat indices 0, 2, 4, 6)
        if (b % 2 === 0) scheduleKick(ctx, dest, beatTime, 100, 30, 0.2, vol * 0.7);

        // Snare: beats 2, 4 (beat indices 1, 3, 5, 7)
        if (b % 2 === 1) scheduleSnare(ctx, dest, beatTime, 3000, 0.15, vol * 0.5);

        // Hi-hat: 8th notes (every half-beat)
        [0, 0.5].forEach((eighth) => {
          scheduleHihat(ctx, dest, beatTime + eighth * secPerBeat, 10000, 0.04, vol * 0.3);
        });

        // E-piano chords: one per bar
        if (b % 4 === 0) {
          const chord = chordProg[barIdx % chordProg.length];
          chord.forEach((freq) => {
            // Sine with slight detune for warmth
            [-5, 0, 5].forEach((cents) => {
              const detunedFreq = freq * Math.pow(2, cents / 1200);
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              // Vibrato LFO 4 Hz
              const lfo = ctx.createOscillator();
              const lfoGain = ctx.createGain();
              lfo.frequency.value = 4;
              lfoGain.gain.value = 3;
              lfo.connect(lfoGain);
              lfoGain.connect(osc.frequency);
              lfo.start(beatTime);
              lfo.stop(beatTime + bar);

              osc.type = 'sine';
              osc.frequency.value = detunedFreq;
              osc.connect(g); g.connect(reverb);
              g.gain.setValueAtTime(0, beatTime);
              g.gain.linearRampToValueAtTime(vol * 0.18, beatTime + 0.04);
              g.gain.exponentialRampToValueAtTime(0.001, beatTime + bar * 0.9);
              osc.start(beatTime);
              osc.stop(beatTime + bar);
            });
          });
        }

        // Bass line: square, lower octave, 0.3 note lengths
        if (b % 4 === 0) {
          const root = chordProg[barIdx % chordProg.length][0] / 2; // one octave down
          scheduleNote(ctx, dest, 'square', root, beatTime, 0.02, secPerBeat * 0.3, vol * 0.4);
        }
        if (b % 4 === 2) {
          const root = chordProg[barIdx % chordProg.length][0] / 2;
          scheduleNote(ctx, dest, 'square', root, beatTime, 0.02, secPerBeat * 0.3, vol * 0.35);
        }
      }
      startTime += bar * 2;
    }
  };

  const id = setInterval(tick, 50);
  tick();
  return () => { stopped = true; clearInterval(id); };
}

function buildNews(ctx: AudioContext, dest: AudioNode, bpm: number, vol: number): () => void {
  const reverb = makeReverb(ctx, dest);
  const secPerBeat = 60 / bpm;
  const bar = secPerBeat * 4;
  let startTime = ctx.currentTime + 0.1;
  let stopped = false;
  const chordProg = [EM, AM, B7];

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    while (startTime < now + 0.4) {
      for (let b = 0; b < 12; b++) { // 3-bar loop
        const beatTime = startTime + b * secPerBeat;
        const barIdx = Math.floor(b / 4);
        const chord = chordProg[barIdx % chordProg.length];

        // Kick on 1 and 3
        if (b % 4 === 0 || b % 4 === 2) scheduleKick(ctx, dest, beatTime, 90, 25, 0.18, vol * 0.75);

        // Crisp snare on 2 and 4 (NO hi-hat for news)
        if (b % 4 === 1 || b % 4 === 3) scheduleSnare(ctx, dest, beatTime, 4000, 0.12, vol * 0.6);

        // Brass stab on bar start (sawtooth, quick attack, bright filter)
        if (b % 4 === 0) {
          const root = chord[0];
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = root;
          filter.type = 'lowpass';
          filter.frequency.value = 3000;
          osc.connect(filter); filter.connect(g); g.connect(dest);
          g.gain.setValueAtTime(0, beatTime);
          g.gain.linearRampToValueAtTime(vol * 0.55, beatTime + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.15);
          osc.start(beatTime); osc.stop(beatTime + 0.17);
        }

        // Staccato strings: staggered sawtooth + lowpass every beat
        chord.forEach((freq, ci) => {
          const offset = ci * 0.02;
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          filter.type = 'lowpass';
          filter.frequency.value = 1800;
          osc.connect(filter); filter.connect(g); g.connect(reverb);
          g.gain.setValueAtTime(0, beatTime + offset);
          g.gain.linearRampToValueAtTime(vol * 0.2, beatTime + offset + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, beatTime + offset + secPerBeat * 0.5);
          osc.start(beatTime + offset);
          osc.stop(beatTime + offset + secPerBeat * 0.5 + 0.02);
        });

        // Bass: square wave, firm attack
        if (b % 4 === 0) {
          scheduleNote(ctx, dest, 'square', chord[0] / 2, beatTime, 0.015, secPerBeat * 0.4, vol * 0.5);
        }
      }
      startTime += bar * 3;
    }
  };

  const id = setInterval(tick, 50);
  tick();
  return () => { stopped = true; clearInterval(id); };
}

function buildKpop(ctx: AudioContext, dest: AudioNode, bpm: number, vol: number): () => void {
  const reverb = makeReverb(ctx, dest);
  const secPerBeat = 60 / bpm;
  const bar = secPerBeat * 4;
  let startTime = ctx.currentTime + 0.1;
  let stopped = false;
  let pentatonicIdx = 0;

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    while (startTime < now + 0.4) {
      for (let b = 0; b < 8; b++) { // 2-bar loop
        const beatTime = startTime + b * secPerBeat;

        // Hard kick four-on-the-floor
        scheduleKick(ctx, dest, beatTime, 120, 0.001, 0.15, vol * 0.85);

        // Clap on 2 and 4
        if (b % 4 === 1 || b % 4 === 3) scheduleClap(ctx, dest, beatTime, vol * 0.7);

        // Open hi-hat on off-beats (16th note offbeats)
        [0.5].forEach((eighth) => {
          scheduleHihat(ctx, dest, beatTime + eighth * secPerBeat, 12000, 0.15, vol * 0.35);
        });

        // Synth lead: sawtooth + lowpass sweep, pentatonic melody
        const leadFreq = pentatonic[pentatonicIdx % pentatonic.length];
        pentatonicIdx++;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = leadFreq;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, beatTime);
        filter.frequency.exponentialRampToValueAtTime(4000, beatTime + 0.1);
        filter.frequency.exponentialRampToValueAtTime(800, beatTime + secPerBeat * 0.7);
        osc.connect(filter); filter.connect(g); g.connect(reverb);
        g.gain.setValueAtTime(0, beatTime);
        g.gain.linearRampToValueAtTime(vol * 0.3, beatTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, beatTime + secPerBeat * 0.75);
        osc.start(beatTime); osc.stop(beatTime + secPerBeat * 0.75 + 0.02);

        // Bass drop: square wave subbase 55 Hz on bar downbeats
        if (b % 4 === 0) {
          scheduleNote(ctx, dest, 'square', 55, beatTime, 0.01, secPerBeat * 0.5, vol * 0.6);
        }

        // Distorted chord stab on offbeats (every 2nd 8th note)
        if (b % 2 === 1) {
          [CM[0], CM[1], CM[2]].forEach((freq) => {
            const osc2 = ctx.createOscillator();
            const waveShaper = ctx.createWaveShaper();
            const g2 = ctx.createGain();
            osc2.type = 'sawtooth';
            osc2.frequency.value = freq;
            // Simple soft-clipping distortion curve
            const n = 256;
            const curve = new Float32Array(n);
            const k = 8;
            for (let i = 0; i < n; i++) {
              const x = (i * 2) / n - 1;
              curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
            }
            waveShaper.curve = curve;
            osc2.connect(waveShaper); waveShaper.connect(g2); g2.connect(dest);
            g2.gain.setValueAtTime(0, beatTime);
            g2.gain.linearRampToValueAtTime(vol * 0.18, beatTime + 0.01);
            g2.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.12);
            osc2.start(beatTime); osc2.stop(beatTime + 0.14);
          });
        }
      }
      startTime += bar * 2;
    }
  };

  const id = setInterval(tick, 50);
  tick();
  return () => { stopped = true; clearInterval(id); };
}

function buildBright(ctx: AudioContext, dest: AudioNode, bpm: number, vol: number): () => void {
  const reverb = makeReverb(ctx, dest);
  const secPerBeat = 60 / bpm;
  const bar = secPerBeat * 4;
  let startTime = ctx.currentTime + 0.1;
  let stopped = false;
  const chordProg = CGAF; // C G Am F
  const glocNotes = [noteToHz('C6'), noteToHz('E6'), noteToHz('G6'), noteToHz('E6')];

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    while (startTime < now + 0.4) {
      for (let b = 0; b < 16; b++) { // 4-bar loop
        const beatTime = startTime + b * secPerBeat;
        const barIdx = Math.floor(b / 4);
        const chord = chordProg[barIdx % chordProg.length];

        // Kick on 1 and 3 (softer)
        if (b % 4 === 0 || b % 4 === 2) scheduleKick(ctx, dest, beatTime, 80, 20, 0.18, vol * 0.55);

        // Hi-hat 16th notes (light, very short)
        [0, 0.25, 0.5, 0.75].forEach((sixteenth) => {
          scheduleHihat(ctx, dest, beatTime + sixteenth * secPerBeat, 11000, 0.025, vol * 0.22);
        });

        // Piano chords: triangle wave, major key
        if (b % 4 === 0) {
          chord.forEach((freq) => {
            scheduleNote(ctx, reverb, 'triangle', freq, beatTime, 0.02, bar * 0.85, vol * 0.28);
          });
          // Bass: sine wave, smooth
          scheduleNote(ctx, dest, 'sine', chord[0] / 2, beatTime, 0.02, secPerBeat * 0.6, vol * 0.4);
        }

        // Glockenspiel melody: high-frequency triangle, sparkly, one per beat
        const gloc = glocNotes[b % glocNotes.length];
        scheduleNote(ctx, reverb, 'triangle', gloc, beatTime, 0.005, 0.15, vol * 0.2);
      }
      startTime += bar * 4;
    }
  };

  const id = setInterval(tick, 50);
  tick();
  return () => { stopped = true; clearInterval(id); };
}

function buildFairy(ctx: AudioContext, dest: AudioNode, bpm: number, vol: number): () => void {
  const reverb = makeReverb(ctx, dest);
  const secPerBeat = 60 / bpm;
  const bar = secPerBeat * 4;
  let startTime = ctx.currentTime + 0.1;
  let stopped = false;
  const arpChords = [AM, CM, GM, EM];
  const bellMelody = [noteToHz('A5'), noteToHz('C6'), noteToHz('E6'), noteToHz('G6'), noteToHz('E6'), noteToHz('C6')];
  let bellIdx = 0;

  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    while (startTime < now + 0.4) {
      for (let b = 0; b < 16; b++) { // 4-bar loop, NO drum kit
        const beatTime = startTime + b * secPerBeat;
        const barIdx = Math.floor(b / 4);
        const chord = arpChords[barIdx % arpChords.length];

        // Harp arpeggio: fast upward arpeggio of current chord
        chord.forEach((freq, ci) => {
          const arpTime = beatTime + ci * (secPerBeat / chord.length);
          scheduleNote(ctx, reverb, 'triangle', freq, arpTime, 0.01, secPerBeat * 0.4, vol * 0.22);
          // Octave up for shimmer
          scheduleNote(ctx, reverb, 'triangle', freq * 2, arpTime + 0.01, 0.01, secPerBeat * 0.3, vol * 0.1);
        });

        // Pad chords: multiple detuned sine oscillators for richness
        if (b % 4 === 0) {
          chord.forEach((freq) => {
            [-8, 0, 8].forEach((cents) => {
              const df = freq * Math.pow(2, cents / 1200);
              scheduleNote(ctx, reverb, 'sine', df, beatTime, 0.1, bar * 0.95, vol * 0.12);
            });
          });
        }

        // Bell melody: high sine, very soft
        const bellFreq = bellMelody[bellIdx % bellMelody.length];
        bellIdx++;
        scheduleNote(ctx, reverb, 'sine', bellFreq, beatTime, 0.005, 0.25, vol * 0.15);

        // Light pizzicato bass: sine, very short
        if (b % 4 === 0) {
          scheduleNote(ctx, dest, 'sine', chord[0] / 2, beatTime, 0.01, 0.1, vol * 0.3);
        }
      }
      startTime += bar * 4;
    }
  };

  const id = setInterval(tick, 50);
  tick();
  return () => { stopped = true; clearInterval(id); };
}

// ---------------------------------------------------------------------------
// Public createGameBGM
// ---------------------------------------------------------------------------
export function createGameBGM(
  audioCtx: AudioContext,
  spec: BGMSpec,
  dest: AudioNode,
): () => void {
  if (spec.genre === 'none') return () => {};

  const ctx = audioCtx;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(dest);

  const masterGain = ctx.createGain();
  masterGain.gain.value = spec.volume;
  masterGain.connect(compressor);

  let stopFn: () => void;

  switch (spec.genre) {
    case 'lofi':   stopFn = buildLofi(ctx, masterGain, spec.bpm, 1); break;
    case 'news':   stopFn = buildNews(ctx, masterGain, spec.bpm, 1); break;
    case 'kpop':   stopFn = buildKpop(ctx, masterGain, spec.bpm, 1); break;
    case 'bright': stopFn = buildBright(ctx, masterGain, spec.bpm, 1); break;
    case 'fairy':  stopFn = buildFairy(ctx, masterGain, spec.bpm, 1); break;
    default:       stopFn = () => {};
  }

  return () => {
    stopFn();
    masterGain.disconnect();
    compressor.disconnect();
  };
}
