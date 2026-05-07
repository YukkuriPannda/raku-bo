// ============================================================
// app/(tabs)/_layout.tsx
// タブナビゲーション（BottomTabNavigator）
// 4 タブ: ホーム・履歴・シフト・ポイント
// ============================================================

import { Tabs } from 'expo-router';
import { Text } from 'react-native';

// タブアイコン（絵文字で代替）
type TabIconProps = {
  emoji: string;
  focused: boolean;
};

function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

// ============================================================
// タブレイアウト
// ============================================================
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#1f2937',
        },
      }}
    >
      {/* ホーム */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          headerTitle: 'らく〜ぼ',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* 支出履歴 */}
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          headerTitle: '支出履歴',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />

      {/* シフト */}
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'シフト',
          headerTitle: 'シフト・収入見込み',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />

      {/* ポイント */}
      <Tabs.Screen
        name="points"
        options={{
          title: 'ポイント',
          headerTitle: 'ポイント管理',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💎" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
