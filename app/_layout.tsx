import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';
import { signInAnonymously, fetchUserProfile, getMockUserId } from '../services/supabase';

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

    // 실 Supabase: 익명 로그인
    signInAnonymously().then(async (uid) => {
      if (!uid) return;
      setUserId(uid);
      const profile = await fetchUserProfile(uid);
      if (profile) setProfile(profile);
    });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0e17' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f0e17' },
        }}
      >
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
