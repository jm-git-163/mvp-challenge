import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, message: e.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>렌더링 오류</Text>
        <Text style={s.msg}>{this.state.message}</Text>
        <TouchableOpacity
          style={s.btn}
          onPress={() => this.setState({ hasError: false, message: '' })}
        >
          <Text style={s.btnText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emoji:   { fontSize: 48 },
  title:   { color: '#fff', fontSize: 20, fontWeight: '800' },
  msg:     { color: '#ff6b6b', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' },
  btn:     { backgroundColor: '#e94560', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
});
