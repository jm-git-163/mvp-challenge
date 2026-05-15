/**
 * components/record/StanceGuide.tsx
 *
 * FIX-T (2026-04-22): 스쿼트·피트니스 미션 촬영 시 스마트폰을 책상·식탁에 거치하고
 *   정면 또는 측면으로 서는 최적 자세를 사용자에게 안내하는 오버레이.
 *
 * 동작:
 *  - fitness 장르일 때만 표시.
 *  - state === 'countdown' 또는 state === 'recording' 의 첫 2.5 s 에 노출.
 *  - squatDebug.visibility / landmarkCount / squatLmOk 에 따라 메시지 동적 변경:
 *      * 아무 랜드마크도 없음       → "💡 온 몸이 화면에 들어오도록 폰에서 뒤로 가세요"
 *      * 얼굴 가시성 낮고 무릎 없음 → "📱 폰을 책상에 두고 측면으로 서주세요"
 *      * 무릎 감지 OK              → "✅ 좋아요! 그대로 촬영 시작"
 *  - 2.5s 후엔 하단 얇은 뱃지로 축소.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface StanceGuideInput {
  visibility: number;
  landmarkCount: number;
  squatLmOk: boolean;
  faceY: number;
}

interface Props {
  visible: boolean;
  debug?: StanceGuideInput;
}

function pickMessage(d?: StanceGuideInput): { tone: 'warn' | 'ok' | 'info'; text: string; sub: string } {
  if (!d || d.landmarkCount < 5) {
    return {
      tone: 'warn',
      text: '📱 폰을 책상·식탁 위에 두고 한 발짝 뒤로 가세요',
      sub: '온 몸이 화면에 담겨야 무릎 각도로 스쿼트를 정확히 셀 수 있어요',
    };
  }
  if (!d.squatLmOk) {
    if (d.visibility < 0.35) {
      return {
        tone: 'warn',
        text: '🙂 얼굴이 잘 안 보여요 — 폰 각도를 얼굴쪽으로',
        sub: '정면 또는 측면 모두 OK. 얼굴+무릎이 한 프레임에 들어와야 좋아요',
      };
    }
    return {
      tone: 'info',
      text: '🦵 무릎이 안 보여요 — 폰을 낮추거나 뒤로 가세요',
      sub: '측면 자세를 권장: 무릎 굽힘이 가장 잘 잡힙니다',
    };
  }
  return {
    tone: 'ok',
    text: '✅ 자세 OK — 이대로 촬영!',
    sub: '정면 또는 측면 중 편한 자세로 천천히 스쿼트',
  };
}

export function StanceGuide({ visible, debug }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!visible) { setCollapsed(false); return; }
    const t = setTimeout(() => setCollapsed(true), 2800);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  const { tone, text, sub } = pickMessage(debug);
  const tint = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : '#3b82f6';

  if (collapsed) {
    return (
      <Pressable
        onPress={() => setCollapsed(false)}
        style={[styles.chip, { borderColor: tint }]}
      >
        <Text style={[styles.chipText, { color: tint }]}>{text.slice(0, 22)}…</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { borderColor: tint }]}>
      <Text style={[styles.title, { color: tint }]}>{text}</Text>
      <Text style={styles.sub}>{sub}</Text>
      <Text style={styles.tip}>💡 스마트폰을 책상에 거치 → 2m 뒤로 → 정면 또는 측면</Text>
      <Pressable onPress={() => setCollapsed(true)} style={styles.dismiss}>
        <Text style={styles.dismissText}>숨기기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 56, left: 12, right: 12,
    backgroundColor: 'rgba(15,18,30,0.95)',
    borderRadius: 14, borderWidth: 2,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 10,
    zIndex: 9999, elevation: 20,
  },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sub:   { fontSize: 12, color: '#cbd5e1', lineHeight: 16, marginBottom: 6 },
  tip:   { fontSize: 11, color: '#94a3b8' },
  dismiss: { alignSelf: 'flex-end', marginTop: 6, paddingVertical: 2, paddingHorizontal: 8 },
  dismissText: { fontSize: 11, color: '#64748b' },
  chip: {
    position: 'absolute', top: 56, left: 12,
    backgroundColor: 'rgba(15,18,30,0.82)',
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 5, paddingHorizontal: 10,
    zIndex: 9999, elevation: 20,
  },
  chipText: { fontSize: 11, fontWeight: '600' },
});
