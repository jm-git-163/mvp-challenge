/**
 * engine/studio/unloadGuard.ts
 *
 * Phase 6 — 촬영 중 새로고침 / 뒤로가기 확인 다이얼로그.
 * docs/EDGE_CASES.md §6.
 */

export interface UnloadHost {
  addBeforeUnload: (fn: (e: BeforeUnloadEvent) => void) => void;
  removeBeforeUnload: (fn: (e: BeforeUnloadEvent) => void) => void;
}

export function browserUnloadHost(): UnloadHost {
  return {
    addBeforeUnload: (fn) => window.addEventListener('beforeunload', fn),
    removeBeforeUnload: (fn) => window.removeEventListener('beforeunload', fn),
  };
}

/**
 * arm() 호출 후에만 beforeunload 확인 다이얼로그 노출.
 * disarm() 으로 안전하게 떠날 수 있음.
 */
export class UnloadGuard {
  private armed = false;
  private fn?: (e: BeforeUnloadEvent) => void;

  constructor(private readonly host: UnloadHost = browserUnloadHost()) {}

  arm(): void {
    if (this.armed) return;
    this.armed = true;
    this.fn = (e: BeforeUnloadEvent) => {
      // 크롬 계열은 returnValue = '' 만 세팅해도 확인 다이얼로그 뜸.
      e.preventDefault();
      e.returnValue = '';
    };
    this.host.addBeforeUnload(this.fn);
  }

  disarm(): void {
    if (!this.armed) return;
    if (this.fn) this.host.removeBeforeUnload(this.fn);
    this.armed = false;
    this.fn = undefined;
  }

  isArmed(): boolean { return this.armed; }
}
