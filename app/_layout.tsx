import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';
import { signInAnonymously, fetchUserProfile, getMockUserId } from '../services/supabase';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Claude } from '../constants/claudeTheme';

// ── 사이트 최초 진입 시 카메라+마이크 권한 1회 확보 ──────────────────────────────
// 이후 챌린지/미션별로 팝업이 뜨지 않도록 미리 요청
async function requestPermissionsOnce(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    // 스트림을 전역 캐시에 저장 (RecordingCamera.web.tsx의 _streamCache 로 이전)
    // 트랙을 멈추지 않음 → 이후 챌린지에서 재사용
    (window as any).__permissionStream = stream;
  } catch {
    // 거부돼도 앱은 동작 — 챌린지 진입 시 다시 요청됨
  }
}

export default function RootLayout() {
  const { setUserId, setProfile } = useUserStore();

  useEffect(() => {
    // 권한 미리 확보
    requestPermissionsOnce();

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
