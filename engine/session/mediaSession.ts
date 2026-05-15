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
    // FIX-CAMERA-ZOOM (2026-04-24, v3): aspectRatio 9/16 "ideal" 이 데스크탑/노트북
    //   웹캠(물리적으로 landscape 센서) 에서는 만족 불가 → 브라우저가 조용히
    //   센서의 "중앙 세로 스트립" 을 software crop 해서 제공한다. 결과: 얼굴이
    //   센서 FOV 의 중앙 9:16 영역만 꽉 채워 과도하게 확대돼 보임 (사용자 불만
    //   "엄청 사람이 크게 잡혀서 챌린지 안되고 스쿼트 카운트도 안됨").
    //   정답: aspectRatio 제거. width/height 는 힌트로만 전달하고, 네이티브
    //   센서 비율 그대로 받은 뒤 drawCamera 에서 캔버스(9:16) 에 CONTAIN 으로
    //   fit + 블러 복사본으로 여백 채움. 전체 FOV 가 보이므로 얼굴이 정상
    //   크기로 작아지고 스쿼트 등 전신 동작도 프레임 안에 들어감.
    width:  { ideal: 1280 },
    height: { ideal: 720 },
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

  /**
   * CAMERA-SWAP (2026-04-23): 녹화 중 facing 전환을 위한 on-demand swap.
   *
   * iOS Safari 가 동일 origin 에서 카메라 두 개를 동시 acquire 할 수 없으므로
   * 듀얼 acquire 대신 stop → 재acquire 패턴을 사용한다.
   *
   * 동작:
   *  1. 현재 stream 트랙 stop + stale 마킹
   *  2. 새 facing 으로 acquire (override 사용 → 폴백 체인은 기존 것 그대로)
   *  3. 실패 시 원본 facing 으로 원복 시도
   *  4. 두 번 다 실패 → MediaSessionError throw
   *
   * 호출자는 반환된 새 stream 을 video element 에 부착해야 한다.
   * 캔버스 합성 파이프라인이 video → canvas → captureStream 구조이므로
   * MediaRecorder 자체는 끊기지 않는다 (캔버스 출력 트랙은 동일).
   */
  async swapFacing(target: 'user' | 'environment'): Promise<MediaStream> {
    // 동시 swap 직렬화 — in-flight 가 있으면 그것을 대기
    if (this.acquiring) {
      try { await this.acquiring; } catch { /* 이전 실패는 무시하고 새로 시도 */ }
    }

    // 원복 대비: 현재 facing 추출. video track settings 에서 facingMode 우선.
    const prevFacing: 'user' | 'environment' = this.detectCurrentFacing() ?? (target === 'user' ? 'environment' : 'user');

    // 1) 기존 stream 정리 (stop) — 일부 Android 에서 즉시 재요청 시 NotReadable 회피용 80ms 지연
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try { track.stop(); } catch { /* ignore */ }
      }
      this.stream = null;
    }
    this.stale = true;
    await new Promise((r) => setTimeout(r, 80));

    // 2) 새 facing 으로 acquire
    const buildOverride = (facing: 'user' | 'environment'): MediaConstraintsOverride => ({
      video: {
        facingMode: { ideal: facing } as MediaTrackConstraints['facingMode'],
        width: { ideal: 720, max: 1080 },
        height: { ideal: 1280, max: 1920 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: DEFAULT_CONSTRAINTS.audio,
    });

    try {
      this.stale = false;
      const acquired = await this.acquire(buildOverride(target));
      return acquired;
    } catch (firstErr) {
      // 3) 원복 시도
      try {
        this.stale = false;
        const reverted = await this.acquire(buildOverride(prevFacing));
        // 원복 성공해도 swap 실패는 호출자에게 알림
        throw new MediaSessionError(
          `카메라 전환 실패 — 원본 facing(${prevFacing})으로 복귀했습니다.`,
          firstErr,
          classifyError(firstErr),
        );
      } catch (revertErr) {
        if (revertErr instanceof MediaSessionError) throw revertErr;
        throw new MediaSessionError(
          '카메라 전환 및 원복에 모두 실패했습니다.',
          revertErr,
          classifyError(revertErr),
        );
      }
    }
  }

  /** 현재 video track 의 facingMode 를 추출 (없으면 null). */
  private detectCurrentFacing(): 'user' | 'environment' | null {
    if (!this.stream) return null;
    try {
      const getVT = (this.stream as MediaStream).getVideoTracks;
      if (typeof getVT !== 'function') return null;
      const vt = getVT.call(this.stream)[0];
      if (!vt) return null;
      const settings = (vt as MediaStreamTrack).getSettings?.();
      const fm = (settings as { facingMode?: string } | undefined)?.facingMode;
      if (fm === 'user' || fm === 'environment') return fm;
    } catch { /* ignore */ }
    return null;
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
        // FIX-INVITE-EXHAUSTIVE (2026-04-24): 모든 getUserMedia 호출 지점에 스택 로깅.
        //   사용자 제보 시 콘솔에서 `[perm-src]` 로 grep 해 어떤 경로에서 권한
        //   프롬프트가 실제 발생했는지 정확히 추적 가능. 싱글톤 외부의 호출이
        //   발견되면 CLAUDE.md §3 #13 위반.
        try {
          const stack = new Error().stack?.split('\n').slice(2, 6).join(' | ') ?? '';
          console.info('[perm-src] getUserMedia called from mediaSession.acquireInternal', { constraints, stack });
        } catch {}
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

/**
 * FIX-MIC-SINGLETON (2026-04-23):
 * 앱 전역에서 스트림이 필요한 모든 지점의 단일 진입점.
 *
 * - 살아있는 스트림이 있으면 즉시 반환 (getUserMedia 미호출)
 * - stale(track ended) 또는 없을 때만 1회 getUserMedia 호출
 * - 동시 호출은 in-flight dedupe (mediaSession.acquire 가 처리)
 * - 검증 로그: [mediaSession] reused | new
 *
 * 챌린지 진입 / 녹화 컴포넌트 / Speech 인식기 / 프리워밍 모달 모두
 * 여기만 호출해야 한다. navigator.mediaDevices.getUserMedia 직접 호출 금지.
 */
export async function ensureMediaSession(
  override?: MediaConstraintsOverride,
): Promise<MediaStream> {
  const s = getMediaSession();
  const existing = s.getStream();
  if (existing) {
    if (typeof console !== 'undefined') console.info('[mediaSession] reused');
    return existing;
  }
  if (typeof console !== 'undefined') console.info('[mediaSession] new');
  return s.acquire(override);
}

/** 테스트 전용 — 싱글톤 리셋. */
export function __resetMediaSessionForTests(impl?: MediaSessionDeps['getUserMedia']): MediaSession {
  _singleton?.release();
  _singleton = new MediaSession({ getUserMedia: impl });
  return _singleton;
}
