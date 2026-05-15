/**
 * engine/recording/audioMixer.ts
 *
 * Phase 3 — 마이크 + BGM + SFX 오디오 믹서.
 *
 * CLAUDE.md §4.4 설명:
 *   - 녹화 시 오디오는 `AudioContext` 그래프로 합성해야 한다.
 *   - 마이크: 1.0 (기본)
 *   - BGM: 사용자 발화 구간에서 −8dB 덕킹 (간단한 고정 레벨 가능)
 *   - SFX: 이벤트 트리거 시 일회성 재생
 *
 * 출력: `MediaStreamAudioDestinationNode.stream` 을 `MediaRecorder` 입력으로 연결.
 *
 * 본 파일은 **그래프 빌더 + 레벨 제어 로직**. `AudioContext` 본체는 주입.
 * 실제 노드 연결/해제는 브라우저에서만 동작하지만, 그래프 빌드 로직과
 * 덕킹 상태머신은 node 환경에서 mock으로 검증 가능.
 */

export interface GainNodeLike {
  gain: { value: number; setTargetAtTime?: (v: number, t: number, c: number) => void };
  connect: (n: unknown) => unknown;
  disconnect: () => void;
}

export interface AudioContextLike {
  currentTime: number;
  createGain(): GainNodeLike;
  createMediaStreamSource?(stream: MediaStream): { connect: (n: unknown) => unknown; disconnect: () => void };
  createMediaStreamDestination?(): { stream: MediaStream; connect?: (n: unknown) => unknown };
  createBufferSource?(): { buffer: unknown; loop: boolean; start: (t?: number) => void; stop: (t?: number) => void; connect: (n: unknown) => unknown; onended: (() => void) | null };
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

export interface AudioMixerParams {
  /** BGM 기본 볼륨 (0..1). */
  bgmVolume?: number;
  /** 덕킹 볼륨 (발화 중 BGM). */
  bgmDuckedVolume?: number;
  /** 덕킹 attack 시간 (sec). */
  duckAttackSec?: number;
  /** 덕킹 release 시간 (sec). */
  duckReleaseSec?: number;
  /** 마이크 볼륨. */
  micVolume?: number;
  /** SFX 볼륨. */
  sfxVolume?: number;
}

const DEFAULTS: Required<AudioMixerParams> = {
  bgmVolume: 0.7,
  bgmDuckedVolume: 0.28,  // 약 −8dB
  duckAttackSec: 0.08,
  duckReleaseSec: 0.3,
  micVolume: 1.0,
  sfxVolume: 1.0,
};

export interface AudioMixerDeps {
  ctx: AudioContextLike;
}

export class AudioMixer {
  private readonly p: Required<AudioMixerParams>;
  private readonly ctx: AudioContextLike;
  private micGain: GainNodeLike;
  private bgmGain: GainNodeLike;
  private sfxGain: GainNodeLike;
  private dest: { stream: MediaStream; connect?: (n: unknown) => unknown } | null = null;
  private isDucked = false;

  constructor(deps: AudioMixerDeps, params: AudioMixerParams = {}) {
    this.p = { ...DEFAULTS, ...params };
    this.ctx = deps.ctx;
    this.micGain = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.micGain.gain.value = this.p.micVolume;
    this.bgmGain.gain.value = this.p.bgmVolume;
    this.sfxGain.gain.value = this.p.sfxVolume;

    if (this.ctx.createMediaStreamDestination) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.micGain.connect(this.dest);
      this.bgmGain.connect(this.dest);
      this.sfxGain.connect(this.dest);
    }
  }

  /** 녹화기에 넘길 오디오 스트림. */
  getStream(): MediaStream | null { return this.dest?.stream ?? null; }
  getMicGain(): GainNodeLike { return this.micGain; }
  getBgmGain(): GainNodeLike { return this.bgmGain; }
  getSfxGain(): GainNodeLike { return this.sfxGain; }
  isBgmDucked(): boolean { return this.isDucked; }

  /**
   * 마이크 스트림 연결. getUserMedia 스트림에서 오디오 트랙을
   * `createMediaStreamSource`로 감싸 mic 버스에 라우팅.
   */
  connectMicSource(stream: MediaStream): () => void {
    if (!this.ctx.createMediaStreamSource) return () => {};
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.micGain);
    return () => { try { src.disconnect(); } catch { /* ignore */ } };
  }

  /** 발화 시 덕킹 on/off. AudioAnalyser가 isLoud/isActive 변화 때 호출. */
  setVoiceActive(active: boolean): void {
    if (active === this.isDucked) return;
    this.isDucked = active;
    const target = active ? this.p.bgmDuckedVolume : this.p.bgmVolume;
    const timeConstant = active ? this.p.duckAttackSec : this.p.duckReleaseSec;
    const setTarget = this.bgmGain.gain.setTargetAtTime;
    if (typeof setTarget === 'function') {
      setTarget.call(this.bgmGain.gain, target, this.ctx.currentTime, timeConstant);
    } else {
      this.bgmGain.gain.value = target;
    }
  }

  /** BGM 소스 재생. buffer는 호출자가 디코딩한 AudioBuffer. */
  playBgm(buffer: unknown, loop = true): (() => void) | null {
    if (!this.ctx.createBufferSource) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.connect(this.bgmGain);
    src.start();
    return () => { try { src.stop(); } catch { /* ignore */ } };
  }

  /** 일회성 SFX. 호출자가 AudioBuffer 공급. */
  playSfx(buffer: unknown): void {
    if (!this.ctx.createBufferSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.sfxGain);
    src.start();
  }

  /** 볼륨 조절 API. */
  setMicVolume(v: number) { this.micGain.gain.value = v; }
  setBgmVolume(v: number) {
    this.bgmGain.gain.value = v;
    if (!this.isDucked) this.p.bgmVolume = v;
  }
  setSfxVolume(v: number) { this.sfxGain.gain.value = v; }
}
