/**
 * engine/studio/deviceProbe.ts
 *
 * Phase 6 — 촬영 시작 전 기기 여건 점검.
 * docs/EDGE_CASES.md §2: 배터리, 스토리지, §5: 사이즈/회전.
 *
 * 모두 DI-safe. 실제 브라우저 API 는 래퍼로 감싸 mock 주입 가능.
 */

export interface StorageEstimateLike {
  quota?: number;
  usage?: number;
}

export interface BatteryLike {
  level: number;      // 0~1
  charging: boolean;
}

export interface DeviceReport {
  /** 가용 여유 바이트 (quota - usage). null 이면 알 수 없음. */
  freeBytes: number | null;
  /** 예상 녹화 용량 대비 부족 여부. threshold 미만이면 true. */
  storageLow: boolean;
  /** 배터리 % (0~100). null 이면 알 수 없음. */
  batteryPct: number | null;
  batteryCharging: boolean | null;
  /** 5% 미만이면서 충전 아님. */
  batteryCritical: boolean;
  /** 가로 모드 (landscape) 여부. */
  landscape: boolean;
  /** screen.width < minWidth. */
  tooSmall: boolean;
  /** blockers: 진입 차단 사유. */
  blockers: string[];
  /** warnings: 진입 가능하지만 경고. */
  warnings: string[];
}

export interface DeviceProbeDeps {
  /** navigator.storage.estimate() 래퍼. null 반환 = 미지원. */
  estimateStorage?: () => Promise<StorageEstimateLike | null>;
  /** navigator.getBattery() 래퍼. null 반환 = 미지원. */
  getBattery?: () => Promise<BatteryLike | null>;
  /** window.innerWidth. */
  innerWidth?: () => number;
  /** window.innerHeight. */
  innerHeight?: () => number;
}

export interface ProbeOptions {
  /** 예상 녹화 용량 바이트. 기본 60MB (15초 720p). */
  expectedRecordingBytes: number;
  /** 여유 스토리지 최소 배수. freeBytes < expected*safetyFactor 면 low. 기본 3. */
  storageSafetyFactor: number;
  /** 배터리 critical 임계. 기본 0.05. */
  batteryCriticalLevel: number;
  /** 최소 화면 너비 px. 기본 320. */
  minInnerWidth: number;
}

export const DEFAULT_PROBE: ProbeOptions = {
  expectedRecordingBytes: 60 * 1024 * 1024,
  storageSafetyFactor: 3,
  batteryCriticalLevel: 0.05,
  minInnerWidth: 320,
};

export async function probeDevice(
  opts: Partial<ProbeOptions> = {},
  deps: DeviceProbeDeps = {},
): Promise<DeviceReport> {
  const o: ProbeOptions = { ...DEFAULT_PROBE, ...opts };
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 스토리지
  let freeBytes: number | null = null;
  let storageLow = false;
  try {
    const est = deps.estimateStorage ? await deps.estimateStorage() : null;
    if (est && typeof est.quota === 'number' && typeof est.usage === 'number') {
      freeBytes = est.quota - est.usage;
      if (freeBytes < o.expectedRecordingBytes * o.storageSafetyFactor) {
        storageLow = true;
        warnings.push(`저장 공간이 부족할 수 있습니다 (여유 ${Math.round(freeBytes / 1024 / 1024)}MB).`);
      }
    }
  } catch {
    /* ignore */
  }

  // 배터리
  let batteryPct: number | null = null;
  let batteryCharging: boolean | null = null;
  let batteryCritical = false;
  try {
    const bat = deps.getBattery ? await deps.getBattery() : null;
    if (bat) {
      batteryPct = Math.round(bat.level * 100);
      batteryCharging = bat.charging;
      if (!bat.charging && bat.level < o.batteryCriticalLevel) {
        batteryCritical = true;
        warnings.push(`배터리가 ${batteryPct}% 입니다. 충전기를 연결해주세요.`);
      }
    }
  } catch {
    /* ignore */
  }

  // 방향 / 크기
  const iw = deps.innerWidth?.() ?? (typeof window !== 'undefined' ? window.innerWidth : 360);
  const ih = deps.innerHeight?.() ?? (typeof window !== 'undefined' ? window.innerHeight : 640);
  const landscape = iw > ih;
  const tooSmall = iw < o.minInnerWidth;
  if (landscape) blockers.push('세로 모드로 돌려주세요.');
  if (tooSmall) blockers.push(`화면이 너무 작습니다 (${iw}px). ${o.minInnerWidth}px 이상 필요합니다.`);

  return {
    freeBytes,
    storageLow,
    batteryPct,
    batteryCharging,
    batteryCritical,
    landscape,
    tooSmall,
    blockers,
    warnings,
  };
}

/** Battery API 래퍼 — SSR/미지원 환경에서 안전. */
export function browserBatteryProbe(): () => Promise<BatteryLike | null> {
  return async () => {
    if (typeof navigator === 'undefined') return null;
    const n = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (typeof n.getBattery !== 'function') return null;
    try {
      const bat = await n.getBattery();
      return { level: bat.level, charging: bat.charging };
    } catch {
      return null;
    }
  };
}

export function browserStorageProbe(): () => Promise<StorageEstimateLike | null> {
  return async () => {
    if (typeof navigator === 'undefined') return null;
    const s = navigator.storage;
    if (!s || typeof s.estimate !== 'function') return null;
    try {
      return await s.estimate();
    } catch {
      return null;
    }
  };
}
