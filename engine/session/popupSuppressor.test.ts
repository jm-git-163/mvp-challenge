import { describe, it, expect, vi } from 'vitest';
import { PopupSuppressor, type InstallPromptLike } from './popupSuppressor';

function makeTarget() {
  const listeners: Record<string, Array<(e: Event) => void>> = {};
  return {
    addEventListener(t: string, cb: (e: Event) => void) { (listeners[t] ??= []).push(cb); },
    removeEventListener(t: string, cb: (e: Event) => void) {
      const arr = listeners[t] ?? []; const i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1);
    },
    fire(t: string, e: Event) { for (const cb of [...(listeners[t] ?? [])]) cb(e); },
    has(t: string) { return (listeners[t]?.length ?? 0) > 0; },
  };
}

function makeEvent(): Event & { _default: boolean } {
  const e = {
    _default: false,
    preventDefault() { this._default = true; },
    returnValue: '',
  } as unknown as Event & { _default: boolean };
  return e;
}

function makeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): InstallPromptLike & { _default: boolean } {
  const e: InstallPromptLike & { _default: boolean } = {
    _default: false,
    preventDefault() { this._default = true; },
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  } as unknown as InstallPromptLike & { _default: boolean };
  return e;
}

describe('PopupSuppressor install/uninstall', () => {
  it('install()은 beforeinstallprompt/beforeunload/contextmenu/dragstart 리스너 등록', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();
    expect(win.has('beforeinstallprompt')).toBe(true);
    expect(win.has('beforeunload')).toBe(true);
    expect(doc.has('contextmenu')).toBe(true);
    expect(doc.has('dragstart')).toBe(true);
  });

  it('uninstall() 호출 시 모두 제거', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();
    s.uninstall();
    expect(win.has('beforeinstallprompt')).toBe(false);
    expect(doc.has('contextmenu')).toBe(false);
  });

  it('install() 재호출은 무시 (idempotent)', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install(); s.install();
    // 각 타입별 리스너가 1개만 있어야 함
    const ev = makeInstallPrompt();
    win.fire('beforeinstallprompt', ev);
    expect(ev._default).toBe(true);
  });
});

describe('PopupSuppressor beforeinstallprompt', () => {
  it('이벤트 preventDefault + deferred 저장 + listener 통지', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();
    const spy = vi.fn();
    s.onInstallAvailable(spy);

    const ev = makeInstallPrompt();
    win.fire('beforeinstallprompt', ev);

    expect(ev._default).toBe(true);
    expect(s.isInstallAvailable()).toBe(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('promptInstall() → prompt 트리거, outcome 반환, deferred clear', async () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();
    const ev = makeInstallPrompt('accepted');
    win.fire('beforeinstallprompt', ev);

    const result = await s.promptInstall();
    expect(result).toBe('accepted');
    expect(ev.prompt).toHaveBeenCalled();
    expect(s.isInstallAvailable()).toBe(false);
  });

  it('deferred 없으면 unavailable', async () => {
    const s = new PopupSuppressor({ window: makeTarget(), document: makeTarget() });
    expect(await s.promptInstall()).toBe('unavailable');
  });
});

describe('PopupSuppressor beforeunload / contextmenu', () => {
  it('녹화 중에만 beforeunload 가드', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();

    const e1 = makeEvent();
    win.fire('beforeunload', e1);
    expect(e1._default).toBe(false); // 녹화 아님

    s.setRecording(true);
    const e2 = makeEvent();
    win.fire('beforeunload', e2);
    expect(e2._default).toBe(true);
  });

  it('녹화 중에만 contextmenu/dragstart 차단', () => {
    const win = makeTarget(); const doc = makeTarget();
    const s = new PopupSuppressor({ window: win, document: doc });
    s.install();

    const e1 = makeEvent();
    doc.fire('contextmenu', e1);
    expect(e1._default).toBe(false);

    s.setRecording(true);
    const e2 = makeEvent();
    doc.fire('contextmenu', e2);
    expect(e2._default).toBe(true);

    const e3 = makeEvent();
    doc.fire('dragstart', e3);
    expect(e3._default).toBe(true);
  });
});
