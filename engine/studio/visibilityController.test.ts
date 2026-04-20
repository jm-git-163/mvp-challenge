import { describe, it, expect, vi } from 'vitest';
import { VisibilityController, type VisibilityHost, type TrackLike, type VisibilityEvent } from './visibilityController';

function makeMockHost() {
  let hidden = false;
  const listeners = new Map<string, () => void>();
  const host: VisibilityHost = {
    documentHidden: () => hidden,
    addDocListener: (t, fn) => { listeners.set(t, fn); },
    removeDocListener: (t, fn) => { if (listeners.get(t) === fn) listeners.delete(t); },
  };
  return {
    host,
    setHidden(v: boolean) {
      hidden = v;
      listeners.get('visibilitychange')?.();
    },
    hasListener: () => listeners.has('visibilitychange'),
  };
}

function makeMockTrack(kind: 'video' | 'audio' = 'video', state: 'live' | 'ended' = 'live'): TrackLike & { end: () => void } {
  const ls = new Set<() => void>();
  return {
    kind,
    readyState: state,
    addEventListener: (_t, fn) => { ls.add(fn); },
    removeEventListener: (_t, fn) => { ls.delete(fn); },
    end() {
      this.readyState = 'ended';
      for (const f of ls) f();
    },
  };
}

describe('VisibilityController', () => {
  it('hidden → visible 이벤트', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    const events: VisibilityEvent[] = [];
    c.on((e) => events.push(e));
    c.start();
    m.setHidden(true);
    m.setHidden(false);
    expect(events).toEqual([{ kind: 'hidden', reason: 'tab_hidden' }, { kind: 'visible' }]);
  });

  it('중복 상태 변경 무시', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    const fn = vi.fn();
    c.on(fn);
    c.start();
    m.setHidden(true);
    m.setHidden(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('track ended 이벤트', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    const events: VisibilityEvent[] = [];
    c.on((e) => events.push(e));
    c.start();
    const tr = makeMockTrack('video');
    c.bindTrack(tr);
    tr.end();
    expect(events).toEqual([{ kind: 'track_ended', trackKind: 'video' }]);
  });

  it('이미 ended 인 트랙 바인딩 시 즉시 통지', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    const events: VisibilityEvent[] = [];
    c.on((e) => events.push(e));
    c.start();
    c.bindTrack(makeMockTrack('audio', 'ended'));
    expect(events).toEqual([{ kind: 'track_ended', trackKind: 'audio' }]);
  });

  it('stop 이후 리스너 제거됨', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    c.start();
    expect(m.hasListener()).toBe(true);
    c.stop();
    expect(m.hasListener()).toBe(false);
  });

  it('isHidden 초기값은 host 상태 반영', () => {
    const m = makeMockHost();
    m.setHidden(true);
    const c = new VisibilityController(m.host);
    c.start();
    expect(c.isHidden()).toBe(true);
  });

  it('unsubscribe 시 이벤트 수신 중단', () => {
    const m = makeMockHost();
    const c = new VisibilityController(m.host);
    const fn = vi.fn();
    const off = c.on(fn);
    c.start();
    m.setHidden(true);
    off();
    m.setHidden(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
