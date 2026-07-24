import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useQuickActionRouting } from 'expo-quick-actions/router';

type TabIconProps = {
  emoji: string;
  focused: boolean;
};

function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  // App Shortcuts（レシート撮影など）のタップ/起動をルーティングに反映
  useQuickActionRouting();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B7F4F',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 84,
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 17,
          color: '#1A1A1A',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          headerTitle: 'らく〜ぼ',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          headerTitle: '支出履歴',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'シフト',
          headerTitle: 'シフト・収入見込み',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="planned-expenditures"
        options={{
          title: '支出予定',
          headerTitle: '支出予定',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
