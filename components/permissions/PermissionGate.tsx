/**
 * components/permissions/PermissionGate.tsx
 *
 * 권한 거부·실패 시 사용자 친화적 한국어 안내 + 재시도.
 *
 *  - ensureMediaSession() reject 시 호출자가 이 모달을 띄움
 *  - "다시 시도" 버튼 → 권한 변경 후 즉시 재acquire
 *  - 5초 timeout 기반 무한 로딩 방지
 *  - accessibilityLiveRegion="assertive" + role="alert" 로 SR 즉시 알림
 *
 * WCAG 2.1 AA: 모든 인터랙티브 요소 minWidth/minHeight 44, 한국어 라벨.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ensureMediaSession, MediaSessionError } from '../../engine/session/mediaSession';

export interface PermissionGateProps {
  /** 권한 획득 성공 시 호출 — 부모가 다음 단계로 진행. */
  onGranted: (stream: MediaStream) => void;
  /** 사용자가 명시적으로 닫음 (선택적). */
  onCancel?: () => void;
  /** 권한 요청 timeout (ms). 기본 5000. */
  timeoutMs?: number;
  /** 자동 첫 시도 여부. 기본 true. */
  autoTry?: boolean;
}

type Stage = 'idle' | 'requesting' | 'denied' | 'notfound' | 'unknown' | 'timeout' | 'granted';

const MESSAGES: Record<Stage, { title: string; body: string }> = {
  idle: {
    title: '카메라·마이크 권한이 필요해요',
    body: '챌린지를 시작하려면 권한 허용이 필요합니다.',
  },
  requesting: {
    title: '권한 요청 중…',
    body: '브라우저 팝업에서 "허용"을 눌러주세요.',
  },
  denied: {
    title: '권한이 거부되었어요',
    body: '카메라·마이크 권한이 필요해요. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 허용으로 변경해주세요. 변경 후 "다시 시도" 버튼을 눌러주세요.',
  },
  notfound: {
    title: '카메라·마이크를 찾을 수 없어요',
    body: '기기에 카메라 또는 마이크가 연결되어 있는지 확인해주세요. USB 카메라라면 다시 연결한 뒤 "다시 시도"를 눌러주세요.',
  },
  unknown: {
    title: '권한 요청에 실패했어요',
    body: '잠시 후 다시 시도해주세요. 문제가 계속되면 다른 브라우저(Chrome / Safari)를 사용해주세요.',
  },
  timeout: {
    title: '응답이 없어요',
    body: '브라우저 권한 팝업이 5초 내에 응답하지 않았어요. 팝업이 가려져 있는지 확인하고 다시 시도해주세요.',
  },
  granted: {
    title: '권한 허용 완료',
    body: '곧 다음 단계로 이동합니다.',
  },
};

export default function PermissionGate({
  onGranted,
  onCancel,
  timeoutMs = 5000,
  autoTry = true,
}: PermissionGateProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const tryAcquire = useCallback(async () => {
    setStage('requesting');
    setErrorDetail(null);
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setStage('timeout');
    }, timeoutMs);

    try {
      const stream = await ensureMediaSession();
      clearTimeout(timeoutId);
      if (timedOut) return; // 이미 timeout 처리됨
      setStage('granted');
      onGranted(stream);
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOut) return;
      if (err instanceof MediaSessionError) {
        if (err.kind === 'denied') setStage('denied');
        else if (err.kind === 'notfound') setStage('notfound');
        else setStage('unknown');
        setErrorDetail(err.message);
      } else {
        setStage('unknown');
        setErrorDetail((err as Error)?.message ?? '알 수 없는 오류');
      }
    }
  }, [onGranted, timeoutMs]);

  useEffect(() => {
    if (autoTry && stage === 'idle') {
      void tryAcquire();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = stage === 'denied' || stage === 'notfound' || stage === 'unknown' || stage === 'timeout';
  const msg = MESSAGES[stage];

  return (
    <View style={styles.backdrop}>
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        // @ts-ignore — RN Web 매핑
        aria-live="assertive"
      >
        <Text style={styles.title} accessibilityRole="header">
          {msg.title}
        </Text>
        <Text style={styles.body}>{msg.body}</Text>
        {errorDetail && (
          <Text style={styles.detail} accessibilityLabel={`상세: ${errorDetail}`}>
            상세: {errorDetail}
          </Text>
        )}

        {stage === 'requesting' && (
          <View style={styles.loadingRow} accessible accessibilityLabel="권한 요청 진행 중">
            <ActivityIndicator size="small" color="#e94560" />
            <Text style={styles.loadingText}>권한 응답 대기 중…</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          {isError && (
            <Pressable
              onPress={tryAcquire}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="권한 다시 요청하기"
              accessibilityHint="브라우저 권한을 다시 요청합니다"
            >
              <Text style={styles.btnTextPrimary}>다시 시도</Text>
            </Pressable>
          )}
          {onCancel && (
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                pressed && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="권한 요청 취소하고 닫기"
            >
              <Text style={styles.btnTextSecondary}>취소</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 9, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100000,
  },
  card: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: '#16161e',
    borderRadius: 16,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  detail: {
    color: '#D1D5DB',
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  loadingText: {
    color: '#D1D5DB',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  btn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#e94560',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4a4a6a',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnTextPrimary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextSecondary: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '600',
  },
});
