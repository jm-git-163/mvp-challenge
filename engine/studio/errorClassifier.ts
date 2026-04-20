/**
 * engine/studio/errorClassifier.ts
 *
 * Phase 7 — 에러 → 사용자 안내 분류.
 * docs/EDGE_CASES.md §1·§3·§4 전반에 걸친 매핑 단일 지점.
 *
 * Error Boundary / Toast 에서 공통 사용.
 */

export type ErrorCategory =
  | 'permission'     // 카메라/마이크 권한 거부
  | 'notfound'       // 장치 없음
  | 'busy'           // 다른 탭 점유
  | 'overconstrained'// 제약 조건 불만족
  | 'codec'          // MediaRecorder 코덱 미지원
  | 'network'        // 모델/BGM 로드 실패
  | 'storage'        // 저장소 부족
  | 'security'       // 보안 정책(HTTPS 아님 등)
  | 'timeout'        // 타임아웃
  | 'aborted'        // 사용자 취소
  | 'internal'       // 예상 밖
  | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  /** 사용자에게 보여줄 한국어 제목. */
  userTitle: string;
  /** 권장 액션 버튼 라벨 (없으면 null). */
  actionLabel: string | null;
  /** 복구 가능(재시도/재진입) 여부. */
  recoverable: boolean;
  /** 디버그 콘솔에 원본 메시지 기록용. */
  debugDetail: string;
}

export function classifyError(err: unknown): ClassifiedError {
  const name = getName(err);
  const msg = getMessage(err).toLowerCase();

  if (name === 'NotAllowedError' || msg.includes('permission')) {
    return cls('permission', '카메라 또는 마이크 권한이 필요합니다.', '권한 설정 열기', true, err);
  }
  if (name === 'SecurityError') {
    return cls('security', 'HTTPS 환경에서만 촬영할 수 있어요.', '확인', false, err);
  }
  if (name === 'NotFoundError' || msg.includes('no device')) {
    return cls('notfound', '사용 가능한 카메라가 없습니다.', '다시 확인', false, err);
  }
  if (name === 'NotReadableError' || msg.includes('in use')) {
    return cls('busy', '다른 앱에서 카메라를 사용 중입니다. 닫고 다시 시도해주세요.', '다시 시도', true, err);
  }
  if (name === 'OverconstrainedError') {
    return cls('overconstrained', '이 기기는 요청한 해상도를 지원하지 않아요. 자동으로 조정 후 재시도합니다.', '계속', true, err);
  }
  if (name === 'AbortError') {
    return cls('aborted', '요청이 취소됐습니다.', null, true, err);
  }
  if (msg.includes('quota') || msg.includes('storage')) {
    return cls('storage', '저장 공간이 부족합니다.', '공간 확보', true, err);
  }
  if (msg.includes('codec') || msg.includes('mimetype') || msg.includes('mediarecorder')) {
    return cls('codec', '이 브라우저는 녹화를 지원하지 않아요.', '지원 브라우저 안내', false, err);
  }
  if (msg.includes('timeout') || name === 'TimeoutError') {
    return cls('timeout', '응답이 너무 늦어요.', '다시 시도', true, err);
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || name === 'NetworkError') {
    return cls('network', '네트워크 연결을 확인해주세요.', '다시 시도', true, err);
  }
  if (err instanceof Error) {
    return cls('internal', '예상치 못한 오류가 발생했어요.', '다시 시작', true, err);
  }
  return cls('unknown', '알 수 없는 오류입니다.', '다시 시도', true, err);
}

function cls(
  category: ErrorCategory,
  userTitle: string,
  actionLabel: string | null,
  recoverable: boolean,
  err: unknown,
): ClassifiedError {
  return { category, userTitle, actionLabel, recoverable, debugDetail: stringifyForLog(err) };
}

function getName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    return String((err as { name?: unknown }).name ?? '');
  }
  return '';
}

function getMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  if (typeof err === 'string') return err;
  return '';
}

function stringifyForLog(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try { return JSON.stringify(err); } catch { return String(err); }
}
