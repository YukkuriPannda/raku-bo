import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View, Pressable, TouchableOpacity } from 'react-native';
import { useQuickActionRouting } from 'expo-quick-actions/router';

import { styles as fabStyles, TAB_BAR_HEIGHT, FAB_LIFT } from '@/styles/tabs.styles';

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

// ============================================================
// タブバー中央の追加ボタン
//
// タップすると「レシート撮影」と「手動入力」が左右に展開する。
// もとは app/(tabs)/index.tsx と history.tsx に同じものが二重に
// 実装されていて、シフトと支出予定の画面には無かった。ここへ移して
// 1箇所にまとめ、全タブで使えるようにしている。
//
// FAB本体をタブバーの中に描かず、タブバーの上に重ねる絶対配置の
// オーバーレイとして描いている理由:
//   - Android では tabBar の overflow がクリップされ、上へ飛び出した
//     円が切れてしまう
//   - 展開したボタンはどうせ画面コンテンツの上に出す必要があり、
//     オーバーレイが必要になる
// タブバー側には押せない空きスロット（Tabs.Screen name="add"）だけを
// 置いて、中央の場所を確保している。
// ============================================================
function AddButtonOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (path: '/screens/camera' | '/screens/manual-entry') => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      {open && (
        <Pressable
          style={fabStyles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="閉じる"
        />
      )}

      {/* 縦位置は tabBarStyle.height だけで決まる。
          セーフエリアの下インセットを足してはいけない。height を明示すると
          React Navigation はその高さの内側でインセットを吸収するため、
          足すと二重に持ち上がってタブバーの上に浮いてしまう
          （実測: FAB下端がタブバー上端の 8px 上、ずれ 23.8dp ≒ インセット値）。 */}
      <View
        pointerEvents="box-none"
        style={[fabStyles.overlay, { bottom: TAB_BAR_HEIGHT - FAB_LIFT }]}
      >
        <View pointerEvents="box-none" style={fabStyles.anchor}>
          {open && (
            <View style={[fabStyles.action, fabStyles.actionLeft]}>
              <View style={fabStyles.actionLabel}>
                <Text style={fabStyles.actionLabelText}>レシート撮影</Text>
              </View>
              <TouchableOpacity
                onPress={() => go('/screens/camera')}
                style={[fabStyles.actionButton, fabStyles.actionButtonPrimary]}
                activeOpacity={0.8}
                accessibilityLabel="レシート撮影"
              >
                <Text style={{ fontSize: 20 }}>📷</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setOpen((o) => !o)}
            style={fabStyles.fab}
            activeOpacity={0.8}
            accessibilityLabel={open ? '閉じる' : '記録を追加'}
          >
            <Text style={{ fontSize: 24 }}>{open ? '✕' : '➕'}</Text>
          </TouchableOpacity>

          {open && (
            <View style={[fabStyles.action, fabStyles.actionRight]}>
              <View style={fabStyles.actionLabel}>
                <Text style={fabStyles.actionLabelText}>手動入力</Text>
              </View>
              <TouchableOpacity
                onPress={() => go('/screens/manual-entry')}
                style={[fabStyles.actionButton, fabStyles.actionButtonSecondary]}
                activeOpacity={0.8}
                accessibilityLabel="手動入力"
              >
                <Text style={{ fontSize: 20 }}>✏️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

export default function TabsLayout() {
  // App Shortcuts（レシート撮影など）のタップ/起動をルーティングに反映
  useQuickActionRouting();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1B7F4F',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: TAB_BAR_HEIGHT,
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
        {/* 中央の追加ボタンの場所を確保するための空きスロット。
            実際のボタンは AddButtonOverlay がこの上に重ねて描く。
            画面としては使わないので、押しても遷移させない。 */}
        <Tabs.Screen
          name="add"
          options={{
            tabBarButton: () => <View style={fabStyles.slot} />,
          }}
          listeners={{
            tabPress: (e) => e.preventDefault(),
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

      <AddButtonOverlay />
    </View>
  );
}
