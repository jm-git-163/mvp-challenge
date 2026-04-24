/**
 * engine/session/wakeLock.ts
 *
 * Phase 0 — 화면 잠금 방지.
 *
 * docs/COMPATIBILITY §4:
 *   - Native Screen Wake Lock API (Chrome/Edge 84+, Safari 16.4+)
 *   - 미지원 브라우저 (구 iOS Safari, Firefox) → NoSleep.js 폴백
 *   - 탭 백그라운드 진입 시 자동 해제됨 → visibilitychange로 재요청
 *   - 유저 제스처 안에서만 최초 취득 가능
 *
 * CLAUDE.md §3 FORBIDDEN #12: "Wake Lock 없이 녹화 시작 금지".
 *
 * 계약:
 *   - acquire(): 락 취득. 미지원 환경은 NoSleep 폴백을 동적 import.
 *   - release(): 명시적 해제.
 *   - 자동 복구: visibilitychange=visible이면 재취득 시도.
 */

export type WakeLockKind = 'native' | 'polyfill' | 'none';

export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

export interface WakeLockDeps {
  requestNative?: () => Promise<WakeLockSentinelLike>;
  /** 폴리필. 테스트에서 주입. */
  createPolyfill?: () => { enable: () => void; disable: () => void };
  documentRef?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
}

function defaultNativeRequest(): (() => Promise<WakeLockSentinelLike>) | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
  if (!wl?.request) return undefined;
  return () => wl.request('screen');
}

export class WakeLockManager {
  private sentinel: WakeLockSentinelLike | null = null;
  private polyfill: { enable: () => void; disable: () => void } | null = null;
  private kind: WakeLockKind = 'none';
  private desired = false;
  private readonly requestNative?: () => Promise<WakeLockSentinelLike>;
  private readonly createPolyfill?: () => { enable: () => void; disable: () => void };
  private readonly doc?: WakeLockDeps['documentRef'];
  private visibilityHandler?: () => void;

  constructor(deps: WakeLockDeps = {}) {
    this.requestNative = deps.requestNative ?? defaultNativeRequest();
    this.createPolyfill = deps.createPolyfill;
    this.doc = deps.documentRef
      ?? (typeof document !== 'undefined' ? document : undefined);
  }

  getKind(): WakeLockKind { return this.kind; }
  isActive(): boolean {
    if (this.kind === 'native') return !!this.sentinel && !this.sentinel.released;
    if (this.kind === 'polyfill') return !!this.polyfill;
    return false;
  }

  /** 유저 제스처 안에서 호출. */
  async acquire(): Promise<WakeLockKind> {
    this.desired = true;
    this.ensureVisibilityListener();

    if (this.requestNative) {
      try {
        const s = await this.requestNative();
        this.sentinel = s;
        this.kind = 'native';
        s.addEventListener('release', () => {
          // 브라우저가 백그라운드 등에서 해제. desired면 visibility 핸들러가 재시도.
          this.sentinel = null;
        });
        return 'native';
      } catch {
        // native 실패 → 폴리필 경로
      }
    }

    if (this.createPolyfill) {
      const p = this.createPolyfill();
      p.enable();
      this.polyfill = p;
      this.kind = 'polyfill';
      return 'polyfill';
    }

    this.kind = 'none';
    return 'none';
  }

  async release(): Promise<void> {
    this.desired = false;
    this.removeVisibilityListener();
    if (this.sentinel && !this.sentinel.released) {
      try { await this.sentinel.release(); } catch { /* ignore */ }
    }
    this.sentinel = null;
    if (this.polyfill) {
      try { this.polyfill.disable(); } catch { /* ignore */ }
    }
    this.polyfill = null;
    this.kind = 'none';
  }

  private ensureVisibilityListener() {
    if (!this.doc || this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (!this.desired) return;
      if (this.doc?.visibilityState !== 'visible') return;
      if (this.isActive()) return;
      // 재취득 — 실패해도 조용히
      void this.acquire().catch(() => {});
    };
    this.doc.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityListener() {
    if (!this.doc || !this.visibilityHandler) return;
    this.doc.removeEventListener('visibilitychange', this.visibilityHandler);
    this.visibilityHandler = undefined;
  }
}

// ─── 싱글톤 ─────────────────────────────────────────────────────────────────

let _singleton: WakeLockManager | null = null;

export function getWakeLock(): WakeLockManager {
  if (!_singleton) _singleton = new WakeLockManager();
  return _singleton;
}

export function __resetWakeLockForTests(deps?: WakeLockDeps): WakeLockManager {
  _singleton = new WakeLockManager(deps);
  return _singleton;
}
