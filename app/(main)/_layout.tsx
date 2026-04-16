import { Tabs } from 'expo-router';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#333' },
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#888',
        headerStyle: { backgroundColor: '#0f0e17' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: '홈', tabBarLabel: '홈' }}
      />
      <Tabs.Screen
        name="record"
        options={{ title: '촬영', tabBarLabel: '촬영', href: null }}
      />
      <Tabs.Screen
        name="result"
        options={{ title: '결과', tabBarLabel: '결과', href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: '프로필', tabBarLabel: '프로필' }}
      />
    </Tabs>
  );
}
