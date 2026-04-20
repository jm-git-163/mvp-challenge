import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { classifyError } from '../../engine/studio/errorClassifier';

interface State { hasError: boolean; message: string; stack: string; category: string; userTitle: string }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '', stack: '', category: '', userTitle: '' };

  static getDerivedStateFromError(e: Error): State {
    const c = classifyError(e);
    return {
      hasError: true,
      message: e.message,
      stack: e.stack ?? '',
      category: c.category,
      userTitle: c.userTitle,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log full details to console for debugging
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
      this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '' });
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
      this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '' });
    }
  }

  render() {
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
          onPress={() => this.setState({ hasError: false, message: '', stack: '', category: '', userTitle: '' })}
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
