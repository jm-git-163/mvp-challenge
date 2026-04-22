/**
 * PermissionWelcomeModal.tsx — Team RELIABILITY (2026-04-22)
 *
 * 홈 최초 진입 시 1회 표시되는 권한 안내 모달.
 * 사용자 피드백 #5: "홈페이지 초입에서 마이크, 스피커 허용만 눌러주면
 * 노트북처럼 인식하고 자막 나오도록"
 *
 * 동작:
 *   - localStorage `motiq_perm_asked=1` 이 없으면 표시.
 *   - "허용하기" 클릭 → getUserMedia({video,audio}) → 즉시 트랙 stop
 *     → 권한은 origin 단위로 브라우저에 캐싱.
 *   - 거부됐을 땐 브라우저 설정 안내.
 *   - "나중에" 는 모달만 닫고 카드 클릭 때 다시 요청.
 *   - localStorage 플래그는 결과와 무관하게 기록 (재표시 방지).
 *
 * 내부에서 window.__permissionGranted 를 set 해, home/index.tsx 의
 * handleSelect 가 카드 클릭 시 getUserMedia 를 다시 부르지 않게 함.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';

const STORAGE_KEY = 'motiq_perm_asked';

/** Export for tests — window 검사 + localStorage 읽기 */
export function shouldShowPermissionModal(): boolean {
  if (typeof window === 'undefined') return false;
  // Non-web platforms: 웹 외에서는 getUserMedia 가 없음.
  if (Platform.OS !== 'web') return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return false;
  } catch {
    // localStorage 차단 (privacy mode 등) — 모달을 띄워도 다음 방문에 또 뜸,
    //  하지만 사용자 피해는 없으므로 그대로 진행.
  }
  return true;
}

export interface PermissionWelcomeModalProps {
  /** 모달을 강제 표시. 지정 안 되면 내부에서 localStorage 판정. */
  forceOpen?: boolean;
  /** 허용·거부·나중에 어떤 경로로든 닫혔을 때 호출. */
  onDismiss?: () => void;
}

export default function PermissionWelcomeModal(
  props: PermissionWelcomeModalProps,
) {
  const [visible, setVisible] = useState(false);
  const [denied, setDenied]   = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (props.forceOpen) { setVisible(true); return; }
    if (shouldShowPermissionModal()) setVisible(true);
  }, [props.forceOpen]);

  const markAsked = useCallback(() => {
    try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    props.onDismiss?.();
  }, [props]);

  const onAllow = useCallback(async () => {
    if (typeof window === 'undefined') { close(); return; }
    setLoading(true);
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      // 권한만 획득, 트랙 즉시 정지 — origin 캐시됨.
      stream.getTracks().forEach((t) => t.stop());
      (window as any).__permissionGranted = true;
      markAsked();
      setLoading(false);
      close();
    } catch (err) {
      console.warn('[PermissionWelcomeModal] getUserMedia denied:', err);
      setDenied(true);
      setLoading(false);
      markAsked();
      // 거부 시엔 모달을 닫지 않고 안내 + 재시도 버튼 표시.
    }
  }, [close, markAsked]);

  const onLater = useCallback(() => {
    // "나중에" 는 localStorage 기록을 하지 않아 다음 방문에도 한번 더 물음.
    //  대신 이번 세션 내에서만 __permissionGranted=false 플래그를 유지하지 않음 —
    //  home/index.tsx 의 handleSelect 가 카드 클릭 시 다시 요청하도록 둔다.
    close();
  }, [close]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>MotiQ 를 제대로 쓰려면</Text>
          <Text style={s.subtitle}>
            카메라·마이크 권한이 필요해요
          </Text>

          <View style={s.bulletList}>
            <Text style={s.bullet}>• 노트북처럼 바로 인식 · 자막 표시</Text>
            <Text style={s.bullet}>• 영상·음성은 서버로 전송되지 않아요</Text>
            <Text style={s.bullet}>• 한 번만 허용하면 다음부터 자동</Text>
          </View>

          {denied ? (
            <View style={s.warnBox}>
              <Text style={s.warnTitle}>권한이 차단되었어요</Text>
              <Text style={s.warnBody}>
                브라우저 주소창 왼쪽 자물쇠 버튼 → 카메라/마이크 → 허용 으로 바꿔주세요.
              </Text>
            </View>
          ) : null}

          <View style={s.btnRow}>
            <Pressable
              onPress={onLater}
              style={s.btnSecondary}
              disabled={loading}
            >
              <Text style={s.btnSecondaryText}>나중에</Text>
            </Pressable>
            <Pressable
              onPress={onAllow}
              style={[s.btnPrimary, loading && s.btnPrimaryDisabled]}
              disabled={loading}
            >
              <Text style={s.btnPrimaryText}>
                {loading ? '허용 요청 중…' : denied ? '다시 시도' : '허용하기'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#3F3F46',
    fontWeight: '500',
  },
  bulletList: {
    marginTop: 16,
    gap: 6,
  },
  bullet: {
    fontSize: 13,
    color: '#52525B',
    lineHeight: 20,
  },
  warnBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  warnBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  btnRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btnSecondary: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3F3F46',
  },
  btnPrimary: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
