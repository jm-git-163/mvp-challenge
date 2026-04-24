/**
 * engine/session/popupSuppressor.ts
 *
 * Phase 0 — 녹화/미션 중 브라우저 모달·설치 프롬프트 억제.
 *
 * docs/EDGE_CASES §5 "촬영 중 팝업 차단":
 *   - beforeinstallprompt: 촬영 중엔 preventDefault로 억제, 완료 후 재발행 가능.
 *   - beforeunload: 녹화 중엔 confirm 다이얼로그 띄워 이탈 방지.
 *   - contextmenu / dragstart: 촬영 UI 에서 억제 (모바일 길게 누르기 메뉴 방지).
 *   - pointercancel on TouchEnd 재표시 지연: 위임해 스와이프 제스처 정리.
 *
 * CLAUDE.md §3 FORBIDDEN #17: "촬영 중 alert/confirm/prompt 호출 금지".
 *
 * 계약:
 *   - install(target): 리스너 등록 (기본 window/document)
 *   - setRecording(flag): 녹화 상태 동기화. true면 beforeunload 가드 on.
 *   - uninstall(): 전부 해제.
 *   - 억제된 beforeinstallprompt 이벤트는 deferredPrompt로 보관 → 상위에서 나중에 .prompt() 트리거 가능.
 */

export interface InstallPromptLike extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PopupSuppressorDeps {
  window?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  document?: Pick<Document, 'addEventListener' | 'removeEventListener'>;
}

type Handler = (e: Event) => void;
interface Binding { target: 'window' | 'document'; type: string; handler: Handler; }

export class PopupSuppressor {
  private bindings: Binding[] = [];
  private deferredInstall: InstallPromptLike | null = null;
  private recording = false;
  private readonly win?: PopupSuppressorDeps['window'];
  private readonly doc?: PopupSuppressorDeps['document'];
  private installListeners: Array<(available: boolean) => void> = [];

  constructor(deps: PopupSuppressorDeps = {}) {
    this.win = deps.window
      ?? (typeof window !== 'undefined' ? window : undefined);
    this.doc = deps.document
      ?? (typeof document !== 'undefined' ? document : undefined);
  }

  install(): void {
    if (this.bindings.length > 0) return;
    this.bindWin('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstall = e as InstallPromptLike;
      this.notifyInstall(true);
    });
    this.bindWin('beforeunload', (e) => {
      if (!this.recording) return;
      // 녹화 중 이탈 가드
      (e as BeforeUnloadEvent).preventDefault();
      (e as BeforeUnloadEvent).returnValue = '';
    });
    this.bindDoc('contextmenu', (e) => {
      // 녹화 중엔 길게 누르기/우클릭 컨텍스트 메뉴 차단
      if (this.recording) e.preventDefault();
    });
    this.bindDoc('dragstart', (e) => {
      if (this.recording) e.preventDefault();
    });
  }

  uninstall(): void {
    for (const b of this.bindings) {
      const t = b.target === 'window' ? this.win : this.doc;
      t?.removeEventListener(b.type, b.handler as EventListener);
    }
    this.bindings = [];
    this.deferredInstall = null;
    this.recording = false;
  }

  setRecording(flag: boolean): void {
    this.recording = flag;
  }
  isRecording(): boolean { return this.recording; }

  /** 상위 UI가 "앱 설치" 버튼 눌렀을 때 호출. */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredInstall) return 'unavailable';
    try {
      await this.deferredInstall.prompt();
      const choice = await this.deferredInstall.userChoice;
      this.deferredInstall = null;
      this.notifyInstall(false);
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }

  /** 설치 프롬프트 가용성 변화 구독. */
  onInstallAvailable(cb: (available: boolean) => void): () => void {
    this.installListeners.push(cb);
    return () => {
      const i = this.installListeners.indexOf(cb);
      if (i >= 0) this.installListeners.splice(i, 1);
    };
  }

  isInstallAvailable(): boolean { return !!this.deferredInstall; }

  private bindWin(type: string, handler: Handler) {
    if (!this.win) return;
    this.win.addEventListener(type, handler as EventListener);
    this.bindings.push({ target: 'window', type, handler });
  }
  private bindDoc(type: string, handler: Handler) {
    if (!this.doc) return;
    this.doc.addEventListener(type, handler as EventListener);
    this.bindings.push({ target: 'document', type, handler });
  }
  private notifyInstall(available: boolean) {
    for (const cb of [...this.installListeners]) {
      try { cb(available); } catch { /* ignore */ }
    }
  }
}

// ─── 싱글톤 ─────────────────────────────────────────────────────────────────

let _singleton: PopupSuppressor | null = null;

export function getPopupSuppressor(): PopupSuppressor {
  if (!_singleton) _singleton = new PopupSuppressor();
  return _singleton;
}

export function __resetPopupSuppressorForTests(deps?: PopupSuppressorDeps): PopupSuppressor {
  _singleton?.uninstall();
  _singleton = new PopupSuppressor(deps);
  return _singleton;
}
