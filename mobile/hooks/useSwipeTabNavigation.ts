// ============================================================
// hooks/useSwipeTabNavigation.ts
// タブ画面を左右にスワイプすると次/前のタブへ切り替わるジェスチャーと、
// 指に追従して画面を横に動かすアニメーションスタイルを提供する。
// 使う側は gesture を GestureDetector に、animatedStyle を画面全体を包む
// Animated.View に渡すこと。
//
// (tabs)/_layout.tsx のタブ順と TAB_ROUTES を一致させること。
//
// ただし _layout.tsx にある中央の "add" スロットは含めない。あれは画面では
// なく追加ボタンの置き場所を確保するための空きスロットなので、
// スワイプの行き先にはならない（意図的にタブ数と件数が一致しない）。
//
// アニメーションの作り: タブナビゲーターは一度に1画面しか描かないので、
// 「2画面を並べて動かす」ことはできない。代わりに、出ていく画面は指に
// 追従させ、遷移した先の画面を「指を離した位置の続き」から0へ滑り込ませて
// つないでいる。そのための受け渡しがモジュール変数 entryFrom。
// ============================================================

import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';

const TAB_ROUTES = ['/', '/history', '/shifts', '/planned-expenditures'] as const;

// 成立判定。距離か勢いのどちらかを満たせば遷移する。
const SWIPE_DISTANCE_RATIO = 0.25; // 画面幅に対する割合
const SWIPE_VELOCITY_THRESHOLD = 500;

const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

// 次にフォーカスされる画面が、どの位置から滑り込んでくるか（px）。
// 0 ならアニメーションなし（タップでの切り替えなど）。
let entryFrom = 0;

export function useSwipeTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const currentIndex = TAB_ROUTES.indexOf(pathname as (typeof TAB_ROUTES)[number]);
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);

  // フォーカスされるたびに位置を決め直す。スワイプで来たときだけ滑り込ませ、
  // タップで来たときは0に戻すだけ（前回のスワイプの残りを持ち越さない）。
  useFocusEffect(
    useCallback(() => {
      const from = entryFrom;
      entryFrom = 0;
      translateX.value = from;
      if (from !== 0) {
        translateX.value = withTiming(0, TIMING);
      }
    }, [translateX])
  );

  // entryFrom はJS側の変数なので、worklet内からではなくここで設定する。
  const navigate = (nextIndex: number, from: number) => {
    entryFrom = from;
    router.push(TAB_ROUTES[nextIndex] as never);
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-20, 20]) // 横方向にある程度動いたときだけ発火
    .failOffsetY([-15, 15]) // 縦方向の動きは通常のスクロールに譲る
    .onUpdate((e) => {
      if (currentIndex === -1) return;
      // 端のタブでは、行き先が無い方向には動かさない。
      const atStart = currentIndex === 0 && e.translationX > 0;
      const atEnd = currentIndex === TAB_ROUTES.length - 1 && e.translationX < 0;
      translateX.value = atStart || atEnd ? 0 : e.translationX;
    })
    .onEnd((e) => {
      if (currentIndex === -1) return;
      const committed =
        Math.abs(e.translationX) > width * SWIPE_DISTANCE_RATIO ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      const dir = e.translationX < 0 ? 1 : -1;
      const nextIndex = currentIndex + dir;

      if (committed && translateX.value !== 0 && nextIndex >= 0 && nextIndex < TAB_ROUTES.length) {
        // 新しい画面は「指を離した位置の続き」から入ってくる。
        translateX.value = 0; // この画面はすぐ隠れるので戻しておく
        runOnJS(navigate)(nextIndex, dir * width + e.translationX);
      } else {
        translateX.value = withTiming(0, TIMING);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { gesture, animatedStyle };
}
