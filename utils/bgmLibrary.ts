// utils/bgmLibrary.ts
// Real MP3 BGM tracks per genre — replaces Web Audio oscillator synthesis.
// Primary source: SoundHelix royalty-free demo tracks (reliable public CDN).
// Fallback: Web Audio generator (kept for offline / CDN-blocked scenarios).
//
// Upgrading to premium: replace the URLs below with Pixabay/Uppbeat/Artlist tracks.

export type Genre =
  | 'kpop' | 'hiphop' | 'fitness' | 'challenge' | 'promotion'
  | 'travel' | 'daily' | 'news' | 'english' | 'kids' | 'lofi' | 'fairy' | 'bright';

// SoundHelix public demo tracks — CC licensed, direct MP3, stable.
const SOUNDHELIX = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

// Per-genre curation. Each genre has multiple candidates → random pick per session.
const TRACKS: Record<Genre, string[]> = {
  kpop:      [SOUNDHELIX(1),  SOUNDHELIX(5),  SOUNDHELIX(8)],
  hiphop:    [SOUNDHELIX(2),  SOUNDHELIX(10), SOUNDHELIX(14)],
  fitness:   [SOUNDHELIX(3),  SOUNDHELIX(7),  SOUNDHELIX(11)],
  challenge: [SOUNDHELIX(4),  SOUNDHELIX(9),  SOUNDHELIX(15)],
  promotion: [SOUNDHELIX(6),  SOUNDHELIX(12)],
  travel:    [SOUNDHELIX(13), SOUNDHELIX(16)],
  daily:     [SOUNDHELIX(5),  SOUNDHELIX(14)],
  news:      [SOUNDHELIX(6),  SOUNDHELIX(12)],
  english:   [SOUNDHELIX(7),  SOUNDHELIX(13)],
  kids:      [SOUNDHELIX(8),  SOUNDHELIX(15)],
  lofi:      [SOUNDHELIX(1),  SOUNDHELIX(14)],
  fairy:     [SOUNDHELIX(8),  SOUNDHELIX(15)],
  bright:    [SOUNDHELIX(5),  SOUNDHELIX(11)],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getBgmTrackUrl(genre: string): string {
  const g = (genre in TRACKS ? genre : 'daily') as Genre;
  return pickRandom(TRACKS[g]);
}

// ─── Audio player with ducking support ─────────────────────────────────────────
// Allows the app to lower BGM volume automatically when the user speaks (voice_read).

interface BgmPlayerOptions {
  url: string;
  volume?: number;       // 0..1 (default 0.35 — music under voice)
  loop?: boolean;        // default true
  fadeInMs?: number;     // default 1200
}

export class BgmPlayer {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private baseVolume = 0.35;
  private duckLevel = 1.0;    // 1 = full, 0.2 = ducked
  private fadeTimer: any = null;

  async play(opts: BgmPlayerOptions): Promise<void> {
    this.stop();
    const { url, volume = 0.35, loop = true, fadeInMs = 1200 } = opts;
    this.baseVolume = volume;

    const a = new Audio(url);
    a.crossOrigin = 'anonymous';
    a.loop = loop;
    a.preload = 'auto';
    this.audio = a;

    // Web Audio routing for smooth volume + ducking
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new Ctx();
      const src = this.ctx.createMediaElementSource(a);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.ctx.destination);
      this.gain = gain;
    } catch (e) {
      // Fallback: use element volume directly
      a.volume = 0;
    }

    try {
      await a.play();
    } catch (e) {
      console.warn('[bgm] autoplay blocked:', e);
      return;
    }

    // Fade in
    const startAt = performance.now();
    const fade = () => {
      const t = Math.min(1, (performance.now() - startAt) / fadeInMs);
      const v = this.baseVolume * this.duckLevel * t;
      if (this.gain) this.gain.gain.value = v;
      else if (this.audio) this.audio.volume = v;
      if (t < 1) this.fadeTimer = requestAnimationFrame(fade);
    };
    fade();
  }

  duck(level: number = 0.25): void {
    this.duckLevel = Math.max(0, Math.min(1, level));
    this.applyVolume();
  }

  unduck(): void {
    this.duckLevel = 1.0;
    this.applyVolume();
  }

  setVolume(v: number): void {
    this.baseVolume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume(): void {
    const v = this.baseVolume * this.duckLevel;
    if (this.gain) {
      // Smooth 200ms ramp for ducking
      const now = this.ctx?.currentTime ?? 0;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(v, now + 0.2);
    } else if (this.audio) {
      this.audio.volume = v;
    }
  }

  stop(): void {
    if (this.fadeTimer) {
      cancelAnimationFrame(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {}
      this.audio = null;
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
    this.gain = null;
    this.duckLevel = 1.0;
  }
}

// Singleton convenience (one BGM at a time is the norm)
let _singleton: BgmPlayer | null = null;
export function getBgmPlayer(): BgmPlayer {
  if (!_singleton) _singleton = new BgmPlayer();
  return _singleton;
}
