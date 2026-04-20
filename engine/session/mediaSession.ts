/**
 * engine/session/mediaSession.ts
 *
 * Phase 0 — 앱 전체에서 **단일 getUserMedia 지점**.
 *
 * CLAUDE.md §3 FORBIDDEN #13: "getUserMedia 중복 호출 금지 — 앱 전체 1회만".
 * CLAUDE.md §4.5: "engine/session/mediaSession.ts에서만 getUserMedia 호출 (CI grep 강제)".
 *
 * 계약:
 *   - acquire(): 스트림 캐시 반환. 미보유 시 1회 getUserMedia 호출.
 *   - 이후 카메라/오디오 엔진·녹화기·프리뷰는 모두 getStream() 공유.
 *   - release(): 앱 종료 시에만. 촬영 완료 ≠ release (§PERFORMANCE 2.2).
 *   - stream 소유권은 이 모듈이 가진다 — 외부는 읽기만.
 *
 * 설계 특이점:
 *   - 동시 acquire() 호출 직렬화: 첫 번째 promise를 공유 (in-flight dedupe).
 *   - 스트림 트랙이 OS/브라우저 레벨에서 "ended" 되면 자동으로 stale로 표시,
 *     다음 acquire()가 신규 getUserMedia 호출. 이는 USB 웹캠 분리·
 *     브라우저 권한 철회 복구 경로. (docs/EDGE_CASES §1, §2)
 */

export interface MediaConstraintsOverride {
  video?: MediaTrackConstraints | boolean;
  audio?: MediaTrackConstraints | boolean;
}

export interface MediaSessionDeps {
  /** 테스트 주입용. 기본은 globalThis.navigator.mediaDevices.getUserMedia */
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
}

export class MediaSessionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly kind: 'denied' | 'notfound' | 'notreadable' | 'overconstrained' | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'MediaSessionError';
  }
}

function classifyError(err: unknown): MediaSessionError['kind'] {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'notfound';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'notreadable';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'overconstrained';
    default:
      return 'unknown';
  }
}

/** docs/COMPATIBILITY §3 의 기본 제약. 실패 시 폴백 체인이 차례로 시도된다. */
export const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 720, max: 1080 },
    height: { ideal: 1280, max: 1920 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
};

/** 제약이 강하면 OverconstrainedError. 단계적으로 완화해서 다시 시도한다. */
export const FALLBACK_CHAIN: MediaStreamConstraints[] = [
  DEFAULT_CONSTRAINTS,
  // 해상도만 낮춤
  {
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  },
  // facingMode만 유지
  { video: { facingMode: 'user' }, audio: true },
  // 최후 — 기본값
  { video: true, audio: true },
];

export class MediaSession {
  private stream: MediaStream | null = null;
  private acquiring: Promise<MediaStream> | null = null;
  private stale = false;
  private readonly getUserMediaImpl: (c: MediaStreamConstraints) => Promise<MediaStream>;
  private endedListeners: Array<(reason: 'track-ended' | 'explicit-release') => void> = [];

  constructor(deps: MediaSessionDeps = {}) {
    const fromGlobal = typeof navigator !== 'undefined'
      ? navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
      : undefined;
    const impl = deps.getUserMedia ?? fromGlobal;
    if (!impl) {
      throw new MediaSessionError(
        '이 환경에서 카메라/마이크에 접근할 수 없습니다.',
        undefined,
        'notfound',
      );
    }
    this.getUserMediaImpl = impl;
  }

  /**
   * 스트림을 반환. 이미 있으면 캐시, 없거나 stale이면 getUserMedia 호출.
   * 동시 호출은 단일 in-flight promise로 dedupe.
   */
  async acquire(override?: MediaConstraintsOverride): Promise<MediaStream> {
    if (this.stream && !this.stale && this.isHealthy(this.stream)) {
      return this.stream;
    }
    if (this.acquiring) return this.acquiring;

    this.acquiring = this.acquireInternal(override).finally(() => {
      this.acquiring = null;
    });
    return this.acquiring;
  }

  /** 현재 스트림 (없으면 null). acquire() 호출하지 않음. */
  getStream(): MediaStream | null {
    if (this.stream && !this.stale && this.isHealthy(this.stream)) return this.stream;
    return null;
  }

  /** 앱 종료 시만 호출. 촬영 종료 시엔 호출 금지. */
  release(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try { track.stop(); } catch { /* ignore */ }
      }
    }
    this.stream = null;
    this.stale = false;
    this.notifyEnded('explicit-release');
  }

  /** 스트림이 종료됐을 때 알림 구독 (권한 철회·USB 분리 대응). */
  onEnded(cb: (reason: 'track-ended' | 'explicit-release') => void): () => void {
    this.endedListeners.push(cb);
    return () => {
      const i = this.endedListeners.indexOf(cb);
      if (i >= 0) this.endedListeners.splice(i, 1);
    };
  }

  /** 내부: 테스트 가시성을 위해 public하게. stale 마킹 강제. */
  markStale(): void {
    this.stale = true;
  }

  private async acquireInternal(override?: MediaConstraintsOverride): Promise<MediaStream> {
    // 기존 스트림이 stale이면 정리하고 신규 요청
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try { track.stop(); } catch { /* ignore */ }
      }
      this.stream = null;
    }

    const chain = this.buildChain(override);
    let lastErr: unknown = null;
    for (const constraints of chain) {
      try {
        const stream = await this.getUserMediaImpl(constraints);
        this.attachTrackWatchers(stream);
        this.stream = stream;
        this.stale = false;
        return stream;
      } catch (err) {
        lastErr = err;
        const kind = classifyError(err);
        // 유저가 거부했거나 장치가 없으면 폴백 계속해도 의미 없음
        if (kind === 'denied' || kind === 'notfound') {
          throw new MediaSessionError(
            kind === 'denied'
              ? '카메라/마이크 권한이 거부되었습니다.'
              : '카메라/마이크 장치를 찾을 수 없습니다.',
            err,
            kind,
          );
        }
        // NotReadable/Overconstrained: 다음 제약으로 계속
      }
    }
    throw new MediaSessionError(
      '카메라/마이크 초기화에 실패했습니다.',
      lastErr,
      classifyError(lastErr),
    );
  }

  private buildChain(override?: MediaConstraintsOverride): MediaStreamConstraints[] {
    if (!override) return FALLBACK_CHAIN;
    // override가 있으면 첫 시도는 override, 이후 기본 폴백 체인 이어감
    return [
      {
        video: override.video ?? DEFAULT_CONSTRAINTS.video,
        audio: override.audio ?? DEFAULT_CONSTRAINTS.audio,
      },
      ...FALLBACK_CHAIN,
    ];
  }

  private attachTrackWatchers(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', () => {
        this.stale = true;
        this.notifyEnded('track-ended');
      });
    }
  }

  private isHealthy(stream: MediaStream): boolean {
    const tracks = stream.getTracks();
    if (tracks.length === 0) return false;
    return tracks.every(t => t.readyState === 'live');
  }

  private notifyEnded(reason: 'track-ended' | 'explicit-release'): void {
    for (const cb of [...this.endedListeners]) {
      try { cb(reason); } catch { /* ignore */ }
    }
  }
}

// ─── 프로세스 전역 싱글톤 ────────────────────────────────────────────────────

let _singleton: MediaSession | null = null;

export function getMediaSession(): MediaSession {
  if (!_singleton) _singleton = new MediaSession();
  return _singleton;
}

/** 테스트 전용 — 싱글톤 리셋. */
export function __resetMediaSessionForTests(impl?: MediaSessionDeps['getUserMedia']): MediaSession {
  _singleton?.release();
  _singleton = new MediaSession({ getUserMedia: impl });
  return _singleton;
}
