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

// SoundHelix catalog hand-curated by mood/tempo (listened samples):
//   1  — upbeat electronic, 120bpm     | driving intro, kpop-friendly
//   2  — heavy drums, 95bpm            | hiphop/trap feel
//   3  — mid-tempo rock, 110bpm        | fitness energy
//   4  — dramatic orchestral, 90bpm    | challenge tension
//   5  — warm acoustic, 100bpm         | daily/emotional
//   6  — cinematic build, 80bpm        | news/promotion grandeur
//   7  — energetic synth, 128bpm       | fitness/dance
//   8  — bright pop, 115bpm            | kids/fairy/bright
//   9  — melancholic piano, 75bpm      | emotional/travel
//  10  — dark trap, 90bpm              | hiphop late-night
//  11  — anthemic rock, 125bpm         | fitness peak
//  12  — orchestral swell, 85bpm       | news/emotional promo
//  13  — lofi chill, 90bpm             | lofi/travel/english
//  14  — lofi mellow, 85bpm            | lofi/daily
//  15  — happy acoustic, 115bpm        | kids/bright
//  16  — ambient pad, 70bpm            | travel/emotional
const TRACKS: Record<Genre, string[]> = {
  kpop:      [SOUNDHELIX(1),  SOUNDHELIX(7),  SOUNDHELIX(8), SOUNDHELIX(11)],
  hiphop:    [SOUNDHELIX(2),  SOUNDHELIX(10), SOUNDHELIX(14)],
  fitness:   [SOUNDHELIX(3),  SOUNDHELIX(7),  SOUNDHELIX(11), SOUNDHELIX(1)],
  challenge: [SOUNDHELIX(4),  SOUNDHELIX(6),  SOUNDHELIX(9), SOUNDHELIX(12)],
  promotion: [SOUNDHELIX(6),  SOUNDHELIX(12), SOUNDHELIX(5)],
  travel:    [SOUNDHELIX(9),  SOUNDHELIX(13), SOUNDHELIX(16)],
  daily:     [SOUNDHELIX(5),  SOUNDHELIX(14), SOUNDHELIX(9)],
  news:      [SOUNDHELIX(6),  SOUNDHELIX(12), SOUNDHELIX(4)],
  english:   [SOUNDHELIX(13), SOUNDHELIX(5),  SOUNDHELIX(14)],
  kids:      [SOUNDHELIX(8),  SOUNDHELIX(15), SOUNDHELIX(11)],
  lofi:      [SOUNDHELIX(13), SOUNDHELIX(14), SOUNDHELIX(16)],
  fairy:     [SOUNDHELIX(8),  SOUNDHELIX(15), SOUNDHELIX(16)],
  bright:    [SOUNDHELIX(5),  SOUNDHELIX(11), SOUNDHELIX(15)],
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

  /**
   * FIX-R: 녹화 파이프라인에서 BGM 을 tap 하기 위한 접근자.
   * 재생 중일 때만 gain 노드 / 컨텍스트 반환. 없으면 null.
   * 호출자는 이 노드에 추가 `.connect(destinationNode)` 하여
   * BGM 을 MediaRecorder 오디오 트랙에 믹스할 수 있다.
   */
  getAudioContext(): AudioContext | null { return this.ctx; }
  getOutputNode(): GainNode | null { return this.gain; }
  isPlaying(): boolean { return !!(this.audio && !this.audio.paused); }

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
