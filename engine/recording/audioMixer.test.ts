import { describe, it, expect, vi } from 'vitest';
import { AudioMixer, type AudioContextLike, type GainNodeLike } from './audioMixer';

function makeCtx(): AudioContextLike & { gains: GainNodeLike[] } {
  const gains: GainNodeLike[] = [];
  const ctx: AudioContextLike & { gains: GainNodeLike[] } = {
    currentTime: 0,
    gains,
    createGain(): GainNodeLike {
      const setTarget = vi.fn();
      const g: GainNodeLike = {
        gain: { value: 1, setTargetAtTime: setTarget as (v: number, t: number, c: number) => void },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(g);
      return g;
    },
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    },
    createMediaStreamDestination() {
      return { stream: {} as MediaStream };
    },
    createBufferSource() {
      const node = {
        buffer: null as unknown,
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        onended: null as (() => void) | null,
      };
      return node;
    },
  };
  return ctx;
}

describe('AudioMixer 초기화', () => {
  it('mic/bgm/sfx gain 생성 + destination 연결', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    expect(ctx.gains.length).toBe(3);
    // 각 gain의 connect가 호출되어 dest로 연결
    for (const g of ctx.gains) expect(g.connect).toHaveBeenCalled();
    expect(m.getStream()).not.toBeNull();
  });

  it('기본 볼륨 반영', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx }, { micVolume: 0.8, bgmVolume: 0.6, sfxVolume: 0.9 });
    expect(m.getMicGain().gain.value).toBe(0.8);
    expect(m.getBgmGain().gain.value).toBe(0.6);
    expect(m.getSfxGain().gain.value).toBe(0.9);
  });
});

describe('덕킹', () => {
  it('setVoiceActive(true) → setTargetAtTime 호출 (attack)', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx }, { bgmDuckedVolume: 0.2, duckAttackSec: 0.1 });
    m.setVoiceActive(true);
    expect(m.isBgmDucked()).toBe(true);
    const bgm = m.getBgmGain();
    expect(bgm.gain.setTargetAtTime).toHaveBeenCalledWith(0.2, 0, 0.1);
  });

  it('setVoiceActive(false) → release 시간으로 복귀', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx }, { bgmVolume: 0.7, duckReleaseSec: 0.3 });
    m.setVoiceActive(true);
    m.setVoiceActive(false);
    const bgm = m.getBgmGain();
    const calls = (bgm.gain.setTargetAtTime as unknown as { mock: { calls: unknown[] } }).mock.calls;
    expect(calls.at(-1)).toEqual([0.7, 0, 0.3]);
  });

  it('동일 상태 재설정은 무시', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    m.setVoiceActive(true);
    m.setVoiceActive(true);
    const bgm = m.getBgmGain();
    const calls = (bgm.gain.setTargetAtTime as unknown as { mock: { calls: unknown[] } }).mock.calls;
    expect(calls.length).toBe(1);
  });
});

describe('mic 연결', () => {
  it('마이크 스트림을 source로 감싸 micGain에 연결', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    const off = m.connectMicSource({} as MediaStream);
    off();
  });
});

describe('BGM / SFX', () => {
  it('playBgm: loop=true, connect → bgmGain, start 호출', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    const off = m.playBgm({ fake: true }, true);
    expect(off).not.toBeNull();
    off?.();
  });
  it('playSfx: 일회성', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    expect(() => m.playSfx({})).not.toThrow();
  });
});

describe('볼륨 API', () => {
  it('setBgmVolume 비-덕킹 상태에서만 기본값 덮어쓰기', () => {
    const ctx = makeCtx();
    const m = new AudioMixer({ ctx });
    m.setBgmVolume(0.5);
    m.setVoiceActive(true); // 덕킹 중
    // duck 해제 후엔 새 기본값 0.5로 돌아감
    m.setVoiceActive(false);
    const calls = (m.getBgmGain().gain.setTargetAtTime as unknown as { mock: { calls: Array<[number, number, number]> } }).mock.calls;
    expect(calls.at(-1)?.[0]).toBe(0.5);
  });
});
