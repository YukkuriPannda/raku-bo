// ============================================================
// hooks/useSwipeTabNavigation.ts
// タブ画面を左右にスワイプすると次/前のタブへ切り替わるジェスチャーを提供する。
// (tabs)/_layout.tsx のタブ順と TAB_ROUTES を一致させること。
//
// ただし _layout.tsx にある中央の "add" スロットは含めない。あれは画面では
// なく追加ボタンの置き場所を確保するための空きスロットなので、
// スワイプの行き先にはならない（意図的にタブ数と件数が一致しない）。
// ============================================================

import { Gesture } from 'react-native-gesture-handler';
import { useRouter, usePathname } from 'expo-router';

const TAB_ROUTES = ['/', '/history', '/shifts', '/planned-expenditures'] as const;

const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 200;

export function useSwipeTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const currentIndex = TAB_ROUTES.indexOf(pathname as (typeof TAB_ROUTES)[number]);

  return Gesture.Pan()
    .activeOffsetX([-20, 20]) // 横方向にある程度動いたときだけ発火
    .failOffsetY([-15, 15]) // 縦方向の動きは通常のスクロールに譲る
    .runOnJS(true)
    .onEnd((e) => {
      if (currentIndex === -1) return;

      if (e.translationX < -SWIPE_DISTANCE_THRESHOLD && e.velocityX < -SWIPE_VELOCITY_THRESHOLD) {
        if (currentIndex < TAB_ROUTES.length - 1) {
          router.push(TAB_ROUTES[currentIndex + 1] as never);
        }
      } else if (e.translationX > SWIPE_DISTANCE_THRESHOLD && e.velocityX > SWIPE_VELOCITY_THRESHOLD) {
        if (currentIndex > 0) {
          router.push(TAB_ROUTES[currentIndex - 1] as never);
        }
      }
    });
}
