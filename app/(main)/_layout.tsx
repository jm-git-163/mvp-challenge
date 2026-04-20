import { Tabs } from 'expo-router';
import { Claude } from '../../constants/claudeTheme';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Claude.paper,
          borderTopColor: Claude.hairline,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Claude.amber,
        tabBarInactiveTintColor: Claude.inkMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.4,
        },
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
        name="record/index"
        options={{
          title: '촬영',
          href: null,
        }}
      />
      <Tabs.Screen
        name="result/index"
        options={{
          title: '결과',
          href: null,
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
