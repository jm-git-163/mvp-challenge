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
      <Tabs.Screen
        name="record/index"
        options={{
          title: '촬영',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
        }}
      />
      <Tabs.Screen
        name="result/index"
        options={{
          title: '결과',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
