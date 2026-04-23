import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { classifyError } from '../../engine/studio/errorClassifier';

interface State { hasError: boolean; message: string; stack: string; category: string; userTitle: string; navigatingAway: boolean }

// FIX-NAV v7 (2026-04-23): 네비게이션 진행 중 플래그 — 전역 window 속성으로 부모/자식 공유.
//   location.href='/home?...' 이 실제 페이지 언로드까지 수십~수백 ms 소요되며, 그 사이
//   result 페이지 자식 트리가 unmount 되며 예외를 던질 수 있음 (blob revoke / hook 참조 등).
//   해당 구간에 boundary 가 발동하면 사용자는 ErrorBoundary UI 를 "플래시" 로 봄.
//   본 v7 은 (1) goHome 이 window.__navigatingHome=true 로 플래그 세팅 →
//   (2) ErrorBoundary 가 getDerivedStateFromError 에서 해당 플래그 감지 시 에러 화면을
//   렌더하지 않고 투명 skeleton 반환 → (3) pagehide/beforeunload 에서도 동일 처리.
declare global { interface Window { __navigatingHome?: boolean } }
function isNavigatingAway(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__navigatingHome;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '', stack: '', category: '', userTitle: '', navigatingAway: false };
  private _pagehideHandler?: () => void;
  private _beforeunloadHandler?: () => void;

  componentDidMount() {
    if (typeof window !== 'undefined') {
      const flag = () => this.setState({ navigatingAway: true });
      this._pagehideHandler    = flag;
      this._beforeunloadHandler = flag;
      window.addEventListener('pagehide',     this._pagehideHandler);
      window.addEventListener('beforeunload', this._beforeunloadHandler);
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      if (this._pagehideHandler)    window.removeEventListener('pagehide',     this._pagehideHandler);
      if (this._beforeunloadHandler) window.removeEventListener('beforeunload', this._beforeunloadHandler);
    }
  }

  static getDerivedStateFromError(e: Error): State {
    // FIX-NAV v7: 네비게이션 중엔 에러를 먹고 빈 화면. 어차피 곧 페이지가 바뀜.
    if (isNavigatingAway()) {
      return { hasError: false, message: '', stack: '', category: '', userTitle: '', navigatingAway: true };
    }
    const c = classifyError(e);
    return {
      hasError: true,
      message: e.message,
      stack: e.stack ?? '',
      category: c.category,
      userTitle: c.userTitle,
      navigatingAway: false,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log full details to console for debugging
    if (isNavigatingAway()) {
      console.warn('[ErrorBoundary] Suppressed during navigation:', error.message);
      return;
    }
    console.error('[ErrorBoundary] Caught error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  private _forceReload() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Cache-busting reload: use a fresh URL that bypasses browser cache
      try {
        const url = window.location.pathname + '?_r=' + Date.now();
        window.location.replace(url);
      } catch {
        window.location.reload();
      }
    } else {
      this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '', navigatingAway: false });
    }
  }

  /**
   * Focused Commit C-3: navigation-cleanup-failed 등 라우트 정리 실패 시
   * 세션·globals 강제 정리 후 홈 URL 로 하드 네비게이션.
   * `router.back()`/`replace` 가 실패한 상태에서도 무조건 복구 경로 제공.
   */
  private _forceHome() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const w = window as any;
        const pre = w.__permissionStream as MediaStream | undefined;
        if (pre?.getTracks) pre.getTracks().forEach((t: MediaStreamTrack) => { try { t.stop(); } catch {} });
        w.__poseVideoEl = undefined;
        w.__permissionStream = undefined;
        w.__compositorCanvas = undefined;
      } catch {}
      try { window.location.href = '/?_b=' + Date.now(); }
      catch { window.location.reload(); }
    } else {
      this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '', navigatingAway: false });
    }
  }

  render() {
    // FIX-NAV v7: 네비게이션 진행 중엔 자식을 끊고 투명 View — 깜빡임 완전 차단.
    if (this.state.navigatingAway || isNavigatingAway()) {
      return <View style={{ flex: 1, backgroundColor: '#0f0e17' }} />;
    }
    if (!this.state.hasError) return this.props.children;
    const isNavFailure = this.state.category === 'navigation-cleanup-failed';
    return (
      <View style={s.root}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>{this.state.userTitle || '렌더링 오류'}</Text>
        <Text style={s.msg}>{this.state.message}</Text>
        {isNavFailure ? (
          <TouchableOpacity style={s.btn} onPress={() => this._forceHome()}>
            <Text style={s.btnText}>홈으로</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.btn} onPress={() => this._forceReload()}>
            <Text style={s.btnText}>새로고침</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.btn2}
          onPress={() => this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '', navigatingAway: false })}
        >
          <Text style={s.btn2Text}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emoji:    { fontSize: 48 },
  title:    { color: '#fff', fontSize: 20, fontWeight: '800' },
  msg:      { color: '#ff6b6b', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' },
  btn:      { backgroundColor: '#e94560', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  btnText:  { color: '#fff', fontWeight: '700' },
  btn2:     { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginTop: 4 },
  btn2Text: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
});
