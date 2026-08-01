import { useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View, Pressable, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import * as Haptics from 'expo-haptics';

import { styles as fabStyles, TAB_BAR_HEIGHT, FAB_LIFT, FAB_SINK, FAB_SIZE } from '@/styles/tabs.styles';

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
// 長押し中にFABの中心から左右どちらへ寄っているかを判定する際の
// 「どちらでもない」帯の半径。FABの半径と同じにして、FAB自体の上で
// 離したときは何も発火しないようにする。
const DEAD_ZONE_RADIUS = FAB_SIZE / 2;

function AddButtonOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 長押し→ドラッグ中、いまどちら側に寄っているか（強調表示に使う）。
  // null = デッドゾーン（FAB付近）にいて、まだどちらにも寄っていない。
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);

  // dragSide と同じ値を、Reactのstate更新を待たずに同期的に追っておくためのref。
  // onUpdateは指の移動のたびに何度も呼ばれるので、「前回とくらべて本当に
  // 切り替わったか」をこのrefで判定し、切り替わった瞬間だけ振動させる
  // （setDragSideの関数形は再レンダー回避のためのものであって、
  // 呼び出し側で「変化したかどうか」を読み取るのには使えないため、
  // 別途refで持つのが素直）。
  const dragSideRef = useRef<'left' | 'right' | null>(null);

  // FABの画面上での中心X座標（絶対座標）。onLayoutで一度測って保持する。
  // スタイル定数から逆算する方法もあるが、実測値を直接使うほうが
  // 将来スタイルが変わっても壊れにくい。
  const fabRef = useRef<View>(null);
  const fabCenterXRef = useRef<number | null>(null);
  const measureFabCenter = () => {
    fabRef.current?.measureInWindow((x, _y, width) => {
      fabCenterXRef.current = x + width / 2;
    });
  };

  // 離した（または現在の）絶対X座標から、どちらのサブボタンに近いかを判定する。
  // デッドゾーン内（FABの半径程度）は null＝「どちらでもない」。
  const resolveSide = (absoluteX: number): 'left' | 'right' | null => {
    const centerX = fabCenterXRef.current;
    if (centerX == null) return null;
    const dx = absoluteX - centerX;
    if (dx <= -DEAD_ZONE_RADIUS) return 'left';
    if (dx >= DEAD_ZONE_RADIUS) return 'right';
    return null;
  };

  const go = (path: '/screens/camera' | '/screens/manual-entry') => {
    setOpen(false);
    router.push(path);
  };

  // 長押し＋ドラッグでの選択ジェスチャー。
  // activateAfterLongPress により、素早いタップではこのPanは発火せず
  // （後述のTapGestureに譲る)、一定時間押し続けたときだけ有効化される。
  // 有効化後の指の移動はドラッグとして扱われ、離した座標の左右どちらに
  // 寄っているかで発火先を決める。
  const longPressDragGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .runOnJS(true)
    .onStart(() => {
      setOpen(true);
      setDragSide(null);
      dragSideRef.current = null;
    })
    .onUpdate((e) => {
      const next = resolveSide(e.absoluteX);
      if (dragSideRef.current !== next) {
        dragSideRef.current = next;
        setDragSide(next);
        // 選択side が実際に切り替わった瞬間だけ短い振動を鳴らす。
        // 「null→left/right」（選択が始まった）だけでなく、
        // 「left/right→null」（デッドゾーンに戻った＝選択が外れた）でも
        // 対称に鳴らす。外れたことに気づかないまま指を離すとキャンセル
        // 扱いになってしまうため、外れる瞬間にも触覚フィードバックが
        // あったほうが自然だと判断した。
        Haptics.selectionAsync();
      }
    })
    .onEnd((e) => {
      const side = resolveSide(e.absoluteX);
      if (side === 'left') {
        go('/screens/camera');
      } else if (side === 'right') {
        go('/screens/manual-entry');
      } else {
        // どちらにも寄っていない位置（FAB上や、ほとんど動かさなかった場合）で
        // 離したらキャンセル扱いにして閉じる。
        // 長押ししたまま「やめる」ができるようにするため。
        // 開いたまま使いたいときは長押しではなくタップする。
        setOpen(false);
      }
    })
    .onFinalize(() => {
      setDragSide(null);
      dragSideRef.current = null;
    });

  // 従来通りのタップでの開閉。長押しが発火しなかった場合はこちらが
  // 有効化される（Gesture.Raceで先に有効化した方が勝つ）。
  const tapToggleGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      setOpen((o) => !o);
    });

  const fabGesture = Gesture.Race(longPressDragGesture, tapToggleGesture);

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
        style={[fabStyles.overlay, { bottom: TAB_BAR_HEIGHT - FAB_LIFT - FAB_SINK }]}
      >
        <View pointerEvents="box-none" style={fabStyles.anchor}>
          {open && (
            <View
              style={[
                fabStyles.action,
                fabStyles.actionLeft,
                dragSide === 'right' && fabStyles.actionDimmedLeft,
              ]}
            >
              <View style={fabStyles.actionLabel}>
                <Text style={fabStyles.actionLabelText}>レシート撮影</Text>
              </View>
              <TouchableOpacity
                onPress={() => go('/screens/camera')}
                style={[
                  fabStyles.actionButton,
                  fabStyles.actionButtonPrimary,
                  dragSide === 'left' && fabStyles.actionButtonHighlighted,
                ]}
                activeOpacity={0.8}
                accessibilityLabel="レシート撮影"
              >
                <Text style={{ fontSize: 20 }}>📷</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FAB本体。タップでの開閉と、長押し＋ドラッグでの選択の
              両方をここに集約する（Gesture.Raceで排他的に解決）。
              TouchableOpacityは使わず、GestureDetectorのTapGestureに
              置き換えている（同じViewにRNのタッチレスポンダとRNGHの
              ネイティブジェスチャーを重ねると認識が競合するため）。 */}
          <GestureDetector gesture={fabGesture}>
            <View
              ref={fabRef}
              onLayout={measureFabCenter}
              style={fabStyles.fab}
              accessibilityRole="button"
              accessibilityLabel={open ? '閉じる' : '記録を追加'}
            >
              <Text style={{ fontSize: 24 }}>{open ? '✕' : '➕'}</Text>
            </View>
          </GestureDetector>

          {open && (
            <View
              style={[
                fabStyles.action,
                fabStyles.actionRight,
                dragSide === 'left' && fabStyles.actionDimmedRight,
              ]}
            >
              <View style={fabStyles.actionLabel}>
                <Text style={fabStyles.actionLabelText}>手動入力</Text>
              </View>
              <TouchableOpacity
                onPress={() => go('/screens/manual-entry')}
                style={[
                  fabStyles.actionButton,
                  fabStyles.actionButtonSecondary,
                  dragSide === 'right' && fabStyles.actionButtonHighlighted,
                ]}
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
