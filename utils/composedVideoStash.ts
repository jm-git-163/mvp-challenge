/**
 * utils/composedVideoStash.ts
 *
 * Persists the last composed video blob to IndexedDB so the /debug/share page
 * can pick it up across tabs / reloads / route changes.
 *
 * Why not just window.__lastComposedVideo?
 *   - User completes /record → /result, then opens /debug/share in a NEW tab
 *     (or hard-refreshes) → the window global is gone → diag page says
 *     "합성된 영상이 없어요". IndexedDB survives this.
 *
 * 100% client-side, no network. Single-row store ('last').
 */
const DB_NAME = 'motiq-debug';
const STORE = 'composed';
const KEY = 'last';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function stashComposedVideo(blob: Blob, mime: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob, mime, at: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } finally {
    db.close();
  }
}

export async function loadComposedVideo(): Promise<{ blob: Blob; mime: string; at: number } | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const v = req.result as { blob: Blob; mime: string; at: number } | undefined;
        if (v && v.blob && typeof v.blob.size === 'number') resolve(v);
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}
