/**
 * engine/studio/visibilityController.ts
 *
 * Phase 6 — 탭 백그라운드 / 트랙 ended 중단 제어.
 * docs/EDGE_CASES.md §2.
 *
 * EventTarget 인터페이스만 의존 — test 용 mock 주입 가능.
 */

export type VisibilityEvent =
  | { kind: 'hidden'; reason: 'tab_hidden' }
  | { kind: 'visible' }
  | { kind: 'track_ended'; trackKind: 'video' | 'audio' };

export interface VisibilityHost {
  documentHidden: () => boolean;
  addDocListener: (type: 'visibilitychange', fn: () => void) => void;
  removeDocListener: (type: 'visibilitychange', fn: () => void) => void;
}

export interface TrackLike {
  kind: 'video' | 'audio';
  readyState: 'live' | 'ended';
  addEventListener: (type: 'ended', fn: () => void) => void;
  removeEventListener: (type: 'ended', fn: () => void) => void;
}

export function browserVisibilityHost(): VisibilityHost {
  return {
    documentHidden: () => typeof document !== 'undefined' && document.hidden,
    addDocListener: (t, fn) => document.addEventListener(t, fn),
    removeDocListener: (t, fn) => document.removeEventListener(t, fn),
  };
}

export class VisibilityController {
  private hidden = false;
  private listeners = new Set<(e: VisibilityEvent) => void>();
  private visibilityFn?: () => void;
  private trackBindings = new Map<TrackLike, () => void>();
  private started = false;

  constructor(private readonly host: VisibilityHost = browserVisibilityHost()) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.hidden = this.host.documentHidden();
    this.visibilityFn = () => {
      const now = this.host.documentHidden();
      if (now && !this.hidden) {
        this.hidden = true;
        this.emit({ kind: 'hidden', reason: 'tab_hidden' });
      } else if (!now && this.hidden) {
        this.hidden = false;
        this.emit({ kind: 'visible' });
      }
    };
    this.host.addDocListener('visibilitychange', this.visibilityFn);
  }

  stop(): void {
    if (!this.started) return;
    if (this.visibilityFn) this.host.removeDocListener('visibilitychange', this.visibilityFn);
    for (const [track, fn] of this.trackBindings) track.removeEventListener('ended', fn);
    this.trackBindings.clear();
    this.started = false;
  }

  bindTrack(track: TrackLike): void {
    if (track.readyState === 'ended') {
      this.emit({ kind: 'track_ended', trackKind: track.kind });
      return;
    }
    const fn = () => this.emit({ kind: 'track_ended', trackKind: track.kind });
    track.addEventListener('ended', fn);
    this.trackBindings.set(track, fn);
  }

  on(cb: (e: VisibilityEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  isHidden(): boolean { return this.hidden; }

  private emit(e: VisibilityEvent): void {
    for (const l of this.listeners) l(e);
  }
}
