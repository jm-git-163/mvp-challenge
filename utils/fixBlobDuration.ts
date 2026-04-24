/**
 * utils/fixBlobDuration.ts
 *
 * FIX-KAKAO-HANG (2026-04-24, v5): MediaRecorder output often has
 * `duration=Infinity` or missing duration metadata because the container's
 * duration field is written at start time (before recording length is known)
 * and never patched. Most video players tolerate this; KakaoTalk's uploader
 * does NOT — it hangs mid-send while trying to validate/transcode the blob.
 *
 * This module patches duration in-place for WebM (EBML) blobs without any
 * dependencies. For MP4 blobs we only probe + return diagnostic info: Chrome's
 * fragmented MP4 output would need a full MP4Box remux which is out of scope.
 * In practice Chrome 110+ writes a correct `mvhd` duration on MP4, so the
 * remaining problem surface is WebM only.
 *
 * Inspired by https://github.com/yusitnikov/fix-webm-duration (MIT) —
 * simplified to a single-file, no-dep implementation.
 *
 * Public API:
 *   fixBlobDuration(blob, durationMs?) → Promise<Blob>
 *   probeBlobDuration(blob)            → Promise<number | null>  (seconds)
 */

// ─── EBML IDs we care about ─────────────────────────────────────────────
const EBML_ID = {
  Segment:      0x18538067,
  Info:         0x1549a966,
  Duration:     0x4489,
  TimestampScale: 0x2ad7b1,
};

// ─── Helpers ────────────────────────────────────────────────────────────

function readVarInt(view: DataView, offset: number): { value: number; length: number } | null {
  if (offset >= view.byteLength) return null;
  const first = view.getUint8(offset);
  let length = 0;
  let mask = 0x80;
  while (length < 8 && !(first & mask)) { length++; mask >>= 1; }
  length += 1;
  if (length > 8 || offset + length > view.byteLength) return null;
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = value * 256 + view.getUint8(offset + i);
  }
  return { value, length };
}

function readEbmlId(view: DataView, offset: number): { id: number; length: number } | null {
  if (offset >= view.byteLength) return null;
  const first = view.getUint8(offset);
  let length = 0;
  let mask = 0x80;
  while (length < 4 && !(first & mask)) { length++; mask >>= 1; }
  length += 1;
  if (length > 4 || offset + length > view.byteLength) return null;
  let id = first;
  for (let i = 1; i < length; i++) {
    id = id * 256 + view.getUint8(offset + i);
  }
  return { id, length };
}

/**
 * Scan the EBML tree and return the byte offset + element size of the
 * Duration element inside Segment > Info. Returns null if not present or
 * if the structure is unrecognized (non-WebM blob).
 */
interface DurationSlot { offset: number; size: number; scale: number; }
function findDurationSlot(buf: ArrayBuffer): DurationSlot | null {
  const view = new DataView(buf);
  let offset = 0;

  // Walk top-level: [EBML header] [Segment]
  while (offset < view.byteLength) {
    const idInfo = readEbmlId(view, offset);
    if (!idInfo) return null;
    offset += idInfo.length;
    const sizeInfo = readVarInt(view, offset);
    if (!sizeInfo) return null;
    offset += sizeInfo.length;
    const elementSize = sizeInfo.value;
    if (idInfo.id !== EBML_ID.Segment) {
      offset += elementSize;
      continue;
    }
    // Inside Segment — walk children looking for Info.
    const segmentEnd = offset + elementSize;
    let segOffset = offset;
    while (segOffset < segmentEnd && segOffset < view.byteLength) {
      const childId = readEbmlId(view, segOffset);
      if (!childId) return null;
      segOffset += childId.length;
      const childSize = readVarInt(view, segOffset);
      if (!childSize) return null;
      segOffset += childSize.length;
      if (childId.id !== EBML_ID.Info) {
        segOffset += childSize.value;
        continue;
      }
      // Inside Info — walk to find Duration + TimestampScale.
      const infoEnd = segOffset + childSize.value;
      let infoOffset = segOffset;
      let scale = 1_000_000; // default: 1 ms in ns
      let durationSlot: { offset: number; size: number } | null = null;
      while (infoOffset < infoEnd && infoOffset < view.byteLength) {
        const elId = readEbmlId(view, infoOffset);
        if (!elId) return null;
        infoOffset += elId.length;
        const elSize = readVarInt(view, infoOffset);
        if (!elSize) return null;
        infoOffset += elSize.length;
        if (elId.id === EBML_ID.Duration) {
          durationSlot = { offset: infoOffset, size: elSize.value };
        } else if (elId.id === EBML_ID.TimestampScale) {
          let ts = 0;
          for (let i = 0; i < elSize.value; i++) {
            ts = ts * 256 + view.getUint8(infoOffset + i);
          }
          if (ts > 0) scale = ts;
        }
        infoOffset += elSize.value;
      }
      if (durationSlot) {
        return { offset: durationSlot.offset, size: durationSlot.size, scale };
      }
      return null;
    }
    return null;
  }
  return null;
}

/**
 * Probe the blob via a hidden <video> and return duration in seconds.
 * Returns null if the element fails to load metadata, or the duration is
 * Infinity/NaN/<=0 (the very state we're trying to fix).
 *
 * Uses the well-known "seek to large time" trick to force Chrome to
 * recalculate duration from frame index when the container lies.
 */
export function probeBlobDuration(blob: Blob, timeoutMs = 4500): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    let url: string;
    try { url = URL.createObjectURL(blob); } catch { resolve(null); return; }
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.style.position = 'fixed';
    v.style.left = '-99999px';
    let done = false;
    const cleanup = () => {
      try { v.remove(); } catch {}
      try { URL.revokeObjectURL(url); } catch {}
    };
    const finish = (val: number | null) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(val);
    };
    v.onloadedmetadata = () => {
      if (v.duration === Infinity || isNaN(v.duration) || v.duration <= 0) {
        // Force recalculation by seeking past end.
        v.currentTime = Number.MAX_SAFE_INTEGER;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          const d = v.duration;
          finish((isFinite(d) && d > 0) ? d : null);
        };
      } else {
        finish(v.duration);
      }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    document.body.appendChild(v);
    v.src = url;
  });
}

/**
 * Patch a WebM blob's Duration element in-place and return a new Blob.
 * If the blob is not WebM, or the structure can't be parsed, or the
 * Duration slot isn't the expected 4 or 8 bytes, returns the original blob.
 *
 * `durationMs` can be omitted — we'll probe it via a hidden <video> first.
 * If probing also fails, returns the original blob.
 */
export async function fixBlobDuration(blob: Blob, durationMs?: number): Promise<Blob> {
  const type = (blob.type || '').toLowerCase();
  if (!/webm/.test(type)) return blob;              // only WebM is patchable here

  let ms = durationMs;
  if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) {
    const seconds = await probeBlobDuration(blob);
    if (!seconds) return blob;
    ms = seconds * 1000;
  }

  let buf: ArrayBuffer;
  try { buf = await blob.arrayBuffer(); } catch { return blob; }
  const slot = findDurationSlot(buf);
  if (!slot) return blob;
  // scale is in nanoseconds-per-tick; Duration is a float in ticks.
  // We write a float64 (8-byte) Duration.
  const ticks = (ms * 1_000_000) / slot.scale;
  const out = new Uint8Array(buf.byteLength);
  out.set(new Uint8Array(buf));
  // If the existing slot is 8 bytes, overwrite as float64.
  // If it's 4 bytes, overwrite as float32 (precision loss acceptable for duration).
  const dv = new DataView(out.buffer);
  try {
    if (slot.size === 8) {
      dv.setFloat64(slot.offset, ticks, false);
    } else if (slot.size === 4) {
      dv.setFloat32(slot.offset, ticks, false);
    } else {
      return blob; // unexpected slot size — don't risk corrupting
    }
  } catch {
    return blob;
  }
  return new Blob([out], { type: blob.type });
}
