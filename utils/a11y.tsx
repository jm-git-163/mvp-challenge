/**
 * utils/a11y.tsx
 *
 * 글로벌 접근성(WCAG 2.1 AA) 헬퍼.
 *  - SrOnly: 화면에 안 보이지만 스크린리더가 읽는 Text 컴포넌트
 *  - srOnly(text): JSX 없이 SrOnly 엘리먼트 생성
 *  - announcePolite(text) / announceAssertive(text):
 *      명령형 announce — DOM 에 임시 aria-live 노드를 만들어 텍스트 주입.
 *      RN 컴포넌트 트리 밖에서 즉시 알림이 필요할 때 사용.
 *
 * RN Web 환경 우선. 네이티브에선 announce 함수가 no-op 으로 폴백.
 */

import React from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';

const SR_ONLY_STYLE = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -9999,
    top: 0,
  },
});

export interface SrOnlyProps extends TextProps {
  text: string;
  /** assertive: 즉시 끊고 읽기. polite: 현재 발화 끝나면 읽기. */
  live?: 'polite' | 'assertive' | 'off';
}

/**
 * 보이지 않는 Text — 스크린리더 전용. accessibilityLiveRegion 으로 자동 announce.
 *
 * 사용 예:
 *   <SrOnly text={`현재 ${count}회, 점수 ${score}`} live="polite" />
 */
export function SrOnly({ text, live = 'polite', style, ...rest }: SrOnlyProps) {
  // RN 의 accessibilityLiveRegion 은 'none' | 'polite' | 'assertive'.
  // 우리는 'off' 도 허용하지만 내부에선 'none' 으로 매핑.
  const rnLive: 'none' | 'polite' | 'assertive' = live === 'off' ? 'none' : live;
  return (
    <Text
      accessibilityLiveRegion={rnLive}
      // @ts-ignore — RN Web 가 aria-live 로 변환
      aria-live={live}
      accessible
      style={[SR_ONLY_STYLE.hidden, style as object]}
      importantForAccessibility="yes"
      {...rest}
    >
      {text}
    </Text>
  );
}

/** JSX 없이 SrOnly 엘리먼트 생성. */
export function srOnly(text: string, live: 'polite' | 'assertive' = 'polite') {
  return <SrOnly text={text} live={live} />;
}

// ─── Imperative announce ─────────────────────────────────────────────────────

function ensureLiveNode(level: 'polite' | 'assertive'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const id = level === 'polite' ? '__motiq_a11y_polite' : '__motiq_a11y_assertive';
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement('div');
    node.id = id;
    node.setAttribute('aria-live', level);
    node.setAttribute('aria-atomic', 'true');
    node.setAttribute('role', level === 'assertive' ? 'alert' : 'status');
    Object.assign(node.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      left: '-9999px',
      top: '0',
    });
    document.body.appendChild(node);
  }
  return node;
}

function announce(text: string, level: 'polite' | 'assertive'): void {
  const node = ensureLiveNode(level);
  if (!node) return;
  // 같은 텍스트라도 다시 읽히도록 강제 변경
  node.textContent = '';
  setTimeout(() => {
    if (node) node.textContent = text;
  }, 50);
}

/** 현재 발화가 끝난 뒤 읽힘 — 일반 상태 변화용 (점수, 카운트). */
export function announcePolite(text: string): void {
  announce(text, 'polite');
}

/** 즉시 끊고 읽힘 — 에러·권한 거부·카운트다운 등 긴급한 안내용. */
export function announceAssertive(text: string): void {
  announce(text, 'assertive');
}

export default {
  SrOnly,
  srOnly,
  announcePolite,
  announceAssertive,
};
