/**
 * FIX-Z25 (2026-04-22): drawFrame 안의 play-kick 휴리스틱 단위 검증.
 *
 * 실제 컴포넌트(RN Web + DOM 의존) 를 로드하지 않고, 로직을 그대로 옮긴
 * 참조 함수 `maybeKickPlay` 로 재현한다. 조건:
 *   - video.paused 가 true
 *   - now - lastPlayKick > 100ms
 * 만족 시 play() 호출 + lastPlayKick 갱신.
 */
import { describe, it, expect, vi } from 'vitest';

type FakeVideo = { paused: boolean; play: ReturnType<typeof vi.fn> };

function maybeKickPlay(
  video: FakeVideo,
  now: number,
  state: { lastPlayKick: number },
): boolean {
  if (video.paused && now - state.lastPlayKick > 100) {
    state.lastPlayKick = now;
    try { video.play(); } catch {}
    return true;
  }
  return false;
}

describe('play-kick heuristic', () => {
  it('paused 면 play() 호출하고 lastPlayKick 갱신', () => {
    const video: FakeVideo = { paused: true, play: vi.fn().mockResolvedValue(undefined) };
    const state = { lastPlayKick: -Infinity };

    const kicked = maybeKickPlay(video, 500, state);
    expect(kicked).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(state.lastPlayKick).toBe(500);
  });

  it('100ms 이내 중복 호출은 억제, 경과 후에는 재호출', () => {
    const video: FakeVideo = { paused: true, play: vi.fn().mockResolvedValue(undefined) };
    // lastPlayKick = -Infinity 로 두어 첫 호출은 확실히 발화.
    const state = { lastPlayKick: -Infinity };

    maybeKickPlay(video, 200, state);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(state.lastPlayKick).toBe(200);

    // 50ms 뒤 → throttle
    maybeKickPlay(video, 250, state);
    expect(video.play).toHaveBeenCalledTimes(1);

    // 150ms 뒤 → 재호출
    maybeKickPlay(video, 350, state);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(state.lastPlayKick).toBe(350);
  });

  it('paused=false 면 호출 안 함 (이미 재생 중)', () => {
    const video: FakeVideo = { paused: false, play: vi.fn() };
    const state = { lastPlayKick: 0 };

    maybeKickPlay(video, 1000, state);
    expect(video.play).not.toHaveBeenCalled();
  });
});
