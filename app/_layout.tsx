import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';
import { signInAnonymously, fetchUserProfile, getMockUserId } from '../services/supabase';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Claude } from '../constants/claudeTheme';

// FIX-G (2026-04-21): _layout useEffect 에서 getUserMedia 호출 제거.
//   최신 Chrome/Android 는 user gesture 밖의 호출을 조용히 거부 → 팝업 자체가 뜨지 않음.
//   권한 요청은 app/(main)/home 의 템플릿 카드 onPress 에서 수행 (user gesture 스택 안).

// FIX-I2 (2026-04-21): URL `?stt=whisper|webkit` 를 앱 루트에서 즉시 localStorage 에
//   저장. record 페이지에서만 읽던 기존 로직은 activeTemplate=null 로 bail 하면
//   플래그가 저장되지 않아, 홈 경로에서 템플릿을 눌러도 여전히 webkit 이었음.
function persistSttFlagFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const m = window.location.search.match(/[?&]stt=(whisper|webkit)\b/);
    if (m) window.localStorage.setItem('motiq_stt', m[1]);
  } catch {}
}
persistSttFlagFromUrl();

export default function RootLayout() {
  const { setUserId, setProfile } = useUserStore();

  useEffect(() => {
    // 목 모드: 즉시 로컬 유저 세팅
    const mockId = getMockUserId();
    if (mockId) {
      setUserId(mockId);
      fetchUserProfile(mockId).then((p) => { if (p) setProfile(p); });
      return;
    }
    // 실 Supabase: 익명 로그인 시도
    signInAnonymously()
      .then(async (uid) => {
        if (!uid) return;
        setUserId(uid);
        const profile = await fetchUserProfile(uid);
        if (profile) setProfile(profile);
      })
      .catch(() => {
        // Auth 실패해도 앱은 동작 — 목 유저로 대체
        const fallback = getMockUserId() ?? 'guest';
        setUserId(fallback);
      });
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Claude.shell },
          headerTintColor:  Claude.paper,
          headerTitleStyle: {
            fontWeight: '700',
            // @ts-ignore web
            fontFamily: '"Tiempos Headline",Georgia,serif',
          },
          contentStyle:     { backgroundColor: Claude.shell },
        }}
      >
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="record" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="result" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </ErrorBoundary>
  );
}
