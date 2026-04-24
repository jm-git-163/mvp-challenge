/**
 * cameraSwap.test.ts — 전/후면 카메라 on-demand swap 단위 테스트.
 */
import { describe, it, expect, vi } from 'vitest';
import { swapCameraStream } from './cameraSwap';

type FakeTrackState = 'live' | 'ended';
class FakeTrack {
  public readyState: FakeTrackState = 'live';
  constructor(public kind: 'video' | 'audio') {}
  stop() { this.readyState = 'ended'; }
}
class FakeStream {
  private tracks: FakeTrack[];
  constructor() { this.tracks = [new FakeTrack('video'), new FakeTrack('audio')]; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
}
const makeStream = () => new FakeStream() as unknown as MediaStream;

function notReadable() { const e = new Error('nr'); e.name = 'NotReadableError'; return e; }
function overconstrained() { const e = new Error('oc'); e.name = 'OverconstrainedError'; return e; }

describe('swapCameraStream', () => {
  it('정상: 이전 stream stop + 새 facing 획득', async () => {
    const prev = makeStream();
    const next = makeStream();
    const gum = vi.fn().mockResolvedValue(next);

    const r = await swapCameraStream({
      prevStream: prev,
      target: 'back',
      getUserMedia: gum,
      intermediateDelayMs: 0,
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stream).toBe(next);
      expect(r.facing).toBe('back');
    }
    // 이전 트랙 전부 stop
    for (const t of prev.getTracks()) {
      expect((t as unknown as FakeTrack).readyState).toBe('ended');
    }
    // facingMode: environment 로 요청
    const firstArg = gum.mock.calls[0][0] as MediaStreamConstraints;
    expect(firstArg.video).toMatchObject({ facingMode: { ideal: 'environment' } });
  });

  it('1차 실패(OverconstrainedError) → video:true 폴백으로 성공', async () => {
    const prev = makeStream();
    const next = makeStream();
    const gum = vi.fn()
      .mockRejectedValueOnce(overconstrained())
      .mockResolvedValueOnce(next);

    const r = await swapCameraStream({
      prevStream: prev,
      target: 'front',
      getUserMedia: gum,
      intermediateDelayMs: 0,
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stream).toBe(next);
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it('새 facing + 폴백 둘 다 실패 → 원복 시도 → 원복 성공', async () => {
    const prev = makeStream();
    const reverted = makeStream();
    const gum = vi.fn()
      .mockRejectedValueOnce(notReadable())    // back (ideal)
      .mockRejectedValueOnce(notReadable())    // back (video:true)
      .mockResolvedValueOnce(reverted);        // front 원복 (ideal)

    const r = await swapCameraStream({
      prevStream: prev,
      target: 'back',
      getUserMedia: gum,
      intermediateDelayMs: 0,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.stage).toBe('swap');
      expect(r.revertedStream).toBe(reverted);
      expect(r.revertedFacing).toBe('front');
    }
  });

  it('새 facing + 원복 전부 실패 → revert stage 실패', async () => {
    const prev = makeStream();
    const gum = vi.fn()
      .mockRejectedValue(notReadable());

    const r = await swapCameraStream({
      prevStream: prev,
      target: 'back',
      getUserMedia: gum,
      intermediateDelayMs: 0,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.stage).toBe('revert');
      expect(r.revertedStream).toBeUndefined();
    }
  });

  it('prevStream=null 이어도 동작 (첫 세션 전환)', async () => {
    const next = makeStream();
    const gum = vi.fn().mockResolvedValue(next);
    const r = await swapCameraStream({
      prevStream: null,
      target: 'front',
      getUserMedia: gum,
      intermediateDelayMs: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stream).toBe(next);
  });

  it('onPrevStop 콜백 호출됨', async () => {
    const prev = makeStream();
    const next = makeStream();
    const gum = vi.fn().mockResolvedValue(next);
    const onPrevStop = vi.fn();
    await swapCameraStream({
      prevStream: prev,
      target: 'back',
      getUserMedia: gum,
      onPrevStop,
      intermediateDelayMs: 0,
    });
    expect(onPrevStop).toHaveBeenCalledTimes(1);
  });
});
