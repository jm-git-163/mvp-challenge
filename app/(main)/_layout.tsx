import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

const T = {
  bg:       '#FAFAFA',
  surface:  '#FFFFFF',
  ink:      '#0A0A0A',
  inkMuted: '#71717A',
  border:   '#E5E5E5',
  fontSans: Platform.select({
    web: '"Pretendard Variable",Pretendard,"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif',
    default: 'System',
  }) as string,
};

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // TEAM-UX (2026-04-23): 다크모드 토글을 html/body 배경에 걸었는데
        //   Tabs sceneContainer 가 기본 불투명 배경으로 덮고 있어서 보이지 않음 → transparent.
        sceneStyle: { backgroundColor: 'transparent' },
        // @ts-ignore — 구버전 expo-router 의 prop 이름
        sceneContainerStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor: T.border,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 6,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: T.ink,
        tabBarInactiveTintColor: T.inkMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: -0.1,
          fontFamily: T.fontSans,
        },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: '홈',
          tabBarLabel: '홈',
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: '프로필',
          tabBarLabel: '프로필',
        }}
      />
    </Tabs>
  );
}
