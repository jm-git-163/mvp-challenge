/**
 * engine/session/permissionGate.ts
 *
 * Phase 0 — 권한 게이트 상태 머신 (UI 프레임워크 무관).
 *
 * CLAUDE.md §2 Phase 0:
 *   - 앱 진입 전 호환성 체크 → 카메라/마이크 권한 요청 → WakeLock 취득 → 팝업 억제 설치.
 *   - 어느 단계라도 실패하면 사용자에게 이유를 보여주고 진입 차단.
 *
 * 이 모듈은 순수 로직 코어. React(Native/Next) 컴포넌트가
 * `PermissionGate` 인스턴스를 구독(subscribe)해 UI를 렌더링한다.
 *
 * 상태 머신:
 *   idle
 *     → checking_compat → compat_failed(blockers)
 *                     ↘ requesting_media → media_denied / media_failed
 *                                      ↘ acquiring_wake → wake_failed(warning, 진행은 가능)
 *                                                     ↘ ready
 *
 * wake_failed는 경고만, ready로 강제 이행 (폴리필 없는 저가 단말 대응).
 * compat_failed / media_denied / media_failed는 진입 차단.
 */

import { runCompatibilityCheck, getBlockers, getWarnings, type CompatReport, type CompatCheckDeps } from './compatibilityCheck';
import type { MediaSession } from './mediaSession';
import type { WakeLockManager } from './wakeLock';
import type { PopupSuppressor } from './popupSuppressor';

export type GatePhase =
  | 'idle'
  | 'checking_compat'
  | 'compat_failed'
  | 'requesting_media'
  | 'media_denied'
  | 'media_failed'
  | 'acquiring_wake'
  | 'ready';

export interface GateState {
  phase: GatePhase;
  compat: CompatReport | null;
  blockers: string[];
  warnings: string[];
  error: string | null;
  /** wakeLock 폴백 여부 — 진입 후 UI에 표시하기 위함. */
  wakeLockKind: 'native' | 'polyfill' | 'none' | null;
}

export interface PermissionGateDeps {
  media: MediaSession;
  wakeLock: WakeLockManager;
  popupSuppressor: PopupSuppressor;
  compatDeps?: CompatCheckDeps;
}

export class PermissionGate {
  private state: GateState = {
    phase: 'idle',
    compat: null,
    blockers: [],
    warnings: [],
    error: null,
    wakeLockKind: null,
  };
  private listeners: Array<(s: GateState) => void> = [];

  constructor(private deps: PermissionGateDeps) {}

  getState(): GateState { return this.state; }

  subscribe(cb: (s: GateState) => void): () => void {
    this.listeners.push(cb);
    cb(this.state);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /**
   * 전체 시퀀스 실행. 유저 제스처 핸들러 안에서 호출되어야 한다
   * (getUserMedia / WakeLock 모두 제스처 필요).
   */
  async run(): Promise<GateState> {
    // 1. 호환성 체크
    this.transition({ phase: 'checking_compat' });
    const compat = runCompatibilityCheck(this.deps.compatDeps);
    const blockers = getBlockers(compat);
    const warnings = getWarnings(compat);

    if (blockers.length > 0) {
      this.transition({ phase: 'compat_failed', compat, blockers, warnings });
      return this.state;
    }

    // 2. 미디어 권한
    this.transition({ phase: 'requesting_media', compat, warnings });
    try {
      await this.deps.media.acquire();
    } catch (err) {
      const kind = (err as { kind?: string })?.kind;
      const message = (err as Error)?.message ?? '카메라/마이크 획득 실패';
      this.transition({
        phase: kind === 'denied' ? 'media_denied' : 'media_failed',
        error: message,
      });
      return this.state;
    }

    // 3. Wake Lock
    this.transition({ phase: 'acquiring_wake' });
    let wakeLockKind: GateState['wakeLockKind'] = 'none';
    try {
      wakeLockKind = await this.deps.wakeLock.acquire();
    } catch {
      // wake 실패는 진입 차단 아님 — 경고만
    }

    // 4. 팝업 억제 설치
    this.deps.popupSuppressor.install();

    this.transition({ phase: 'ready', wakeLockKind });
    return this.state;
  }

  /** 거부 후 재시도 — 유저 제스처 안에서. */
  async retry(): Promise<GateState> {
    this.state = { phase: 'idle', compat: null, blockers: [], warnings: [], error: null, wakeLockKind: null };
    return this.run();
  }

  /** 앱 종료 시. */
  async teardown(): Promise<void> {
    this.deps.popupSuppressor.uninstall();
    await this.deps.wakeLock.release();
    this.deps.media.release();
  }

  private transition(patch: Partial<GateState>): void {
    this.state = { ...this.state, ...patch };
    for (const cb of [...this.listeners]) {
      try { cb(this.state); } catch { /* ignore */ }
    }
  }
}

/** 블로커/거부 상태 사용자 문구 매핑. UI 프레임워크 무관. */
export function describeFailure(state: GateState): { title: string; detail: string; retryable: boolean } {
  switch (state.phase) {
    case 'compat_failed':
      return {
        title: '이 기기/브라우저에서는 실행할 수 없어요',
        detail: state.blockers.join('\n'),
        retryable: false,
      };
    case 'media_denied':
      return {
        title: '카메라·마이크 권한이 필요해요',
        detail: '브라우저 주소창 옆 아이콘에서 권한을 허용으로 바꾼 뒤 다시 시도해주세요.',
        retryable: true,
      };
    case 'media_failed':
      return {
        title: '카메라·마이크 연결에 실패했어요',
        detail: state.error ?? '다른 앱이 카메라를 사용 중이거나 장치가 분리되었을 수 있어요.',
        retryable: true,
      };
    default:
      return { title: '', detail: '', retryable: false };
  }
}
