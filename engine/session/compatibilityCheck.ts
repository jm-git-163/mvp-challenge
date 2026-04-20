/**
 * engine/session/compatibilityCheck.ts
 *
 * Phase 0 — 브라우저/기기 호환성 감지.
 * docs/COMPATIBILITY.md §7 스키마 그대로 구현.
 *
 * PermissionGate 진입 시 1회 실행해 블로커를 분류한다.
 * 모든 결과는 동기적으로 계산 가능한 기능 탐지(feature detection) 기반이며,
 * 네트워크 호출이나 사용자 제스처를 요구하지 않는다.
 */

export interface CompatReport {
  mediaDevices: boolean;
  mediaRecorder: boolean;
  mediaRecorderMime: string | null;
  wakeLock: 'native' | 'polyfill' | 'none';
  speechRecognition: boolean;
  permissionsAPI: boolean;
  requestVideoFrameCallback: boolean;
  vibrate: boolean;
  isIOS: boolean;
  isMobileSafari: boolean;
  iOSVersion: number | null;
}

/** docs/COMPATIBILITY §2.1 — 폴백 체인. iOS Safari는 mp4 우선. */
export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

/** 블로커: 이 기능 중 하나라도 false면 앱 진입 불가. */
export const BLOCKER_KEYS: ReadonlyArray<keyof CompatReport> = [
  'mediaDevices',
  'mediaRecorder',
];

export interface UserAgentLike {
  userAgent: string;
  platform?: string;
  vendor?: string;
  maxTouchPoints?: number;
}

/**
 * navigator 객체가 주입 가능. 테스트에서 mock 주입을 위한 것.
 * 브라우저 런타임에서는 globalThis.navigator 가 기본값.
 */
export interface CompatCheckDeps {
  navigator?: UserAgentLike & {
    mediaDevices?: { getUserMedia?: unknown };
    permissions?: { query?: unknown };
    wakeLock?: { request?: unknown };
    vibrate?: unknown;
  };
  window?: {
    MediaRecorder?: { isTypeSupported?: (t: string) => boolean };
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
    HTMLVideoElement?: { prototype?: { requestVideoFrameCallback?: unknown } };
  };
}

/** iOS/Mobile Safari 판별 + 버전 파싱. */
export function detectIOS(ua: string): { isIOS: boolean; isMobileSafari: boolean; iOSVersion: number | null } {
  const iPadOrIPhoneOrIPod = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ 는 MacIntel로 자기소개함. touch support 보조 판별.
  const macPretendingIPad = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints > 1;
  const isIOS = iPadOrIPhoneOrIPod || macPretendingIPad;

  // Mobile Safari: iOS + Safari (Chrome/Firefox on iOS uses CriOS/FxiOS)
  const isMobileSafari = isIOS
    && /Safari/.test(ua)
    && !/CriOS|FxiOS|EdgiOS/.test(ua);

  let iOSVersion: number | null = null;
  if (isIOS) {
    const m = ua.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
    if (m) {
      const major = parseInt(m[1], 10);
      const minor = parseInt(m[2], 10);
      iOSVersion = major + minor / 100;
    } else if (macPretendingIPad) {
      // iPadOS 가 MacIntel로 숨기면 Version/NN.N 에서 추출
      const v = ua.match(/Version\/(\d+)\.(\d+)/);
      if (v) iOSVersion = parseInt(v[1], 10) + parseInt(v[2], 10) / 100;
    }
  }

  return { isIOS, isMobileSafari, iOSVersion };
}

/** 지원되는 MediaRecorder mime 타입 중 첫 번째 반환. 없으면 null. */
export function selectSupportedMime(
  isTypeSupported?: (t: string) => boolean,
): string | null {
  if (!isTypeSupported) return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // 일부 브라우저는 unsupported mime 던짐 — 무시하고 다음
    }
  }
  return null;
}

export function runCompatibilityCheck(deps: CompatCheckDeps = {}): CompatReport {
  const nav = deps.navigator
    ?? (typeof navigator !== 'undefined' ? (navigator as unknown as NonNullable<CompatCheckDeps['navigator']>) : undefined);
  const win = deps.window
    ?? (typeof window !== 'undefined' ? (window as unknown as NonNullable<CompatCheckDeps['window']>) : undefined);

  const ua = nav?.userAgent ?? '';
  const ios = detectIOS(ua);

  const mediaDevices = !!(nav?.mediaDevices?.getUserMedia);
  const mrCtor = win?.MediaRecorder;
  const mediaRecorder = !!mrCtor;
  const mediaRecorderMime = selectSupportedMime(mrCtor?.isTypeSupported);

  let wakeLock: CompatReport['wakeLock'] = 'none';
  if (nav?.wakeLock?.request) wakeLock = 'native';
  // 폴백 (NoSleep.js) 은 런타임에서 dynamic import — 기기가 polyfill 가능하다고 가정.
  // 명시적으로 네이티브가 없으면 'polyfill' 로 마킹해 상위 계층이 NoSleep 경로를 타게 한다.
  else wakeLock = 'polyfill';

  const speechRecognition = !!(win?.SpeechRecognition || win?.webkitSpeechRecognition);
  const permissionsAPI = !!(nav?.permissions?.query);
  const requestVideoFrameCallback = !!(win?.HTMLVideoElement?.prototype?.requestVideoFrameCallback);
  const vibrate = typeof nav?.vibrate === 'function';

  return {
    mediaDevices,
    mediaRecorder,
    mediaRecorderMime,
    wakeLock,
    speechRecognition,
    permissionsAPI,
    requestVideoFrameCallback,
    vibrate,
    isIOS: ios.isIOS,
    isMobileSafari: ios.isMobileSafari,
    iOSVersion: ios.iOSVersion,
  };
}

/** 블로커 발견 시 이유 목록 반환. 비어 있으면 통과. */
export function getBlockers(report: CompatReport): string[] {
  const blockers: string[] = [];
  if (!report.mediaDevices) blockers.push('이 브라우저에서 카메라/마이크에 접근할 수 없습니다.');
  if (!report.mediaRecorder) blockers.push('이 브라우저에서 녹화를 지원하지 않습니다.');
  if (report.mediaRecorder && !report.mediaRecorderMime) {
    blockers.push('지원되는 녹화 코덱이 없습니다. Chrome 또는 Safari 최신 버전을 사용해주세요.');
  }
  return blockers;
}

/** 경고(진행 가능하되 미션 일부 제한). */
export function getWarnings(report: CompatReport): string[] {
  const warnings: string[] = [];
  if (!report.speechRecognition) {
    warnings.push('이 브라우저는 음성 인식을 지원하지 않습니다. 음성 미션은 자동으로 비활성화됩니다.');
  }
  if (report.wakeLock === 'polyfill') {
    warnings.push('화면 잠금 방지를 폴백 방식으로 처리합니다.');
  }
  if (report.isIOS && report.iOSVersion !== null && report.iOSVersion < 16.4) {
    warnings.push('iOS 16.4 미만: 일부 AR·포스트프로세스가 제한될 수 있습니다.');
  }
  return warnings;
}
