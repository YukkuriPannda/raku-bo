// ============================================================
// styles/tabs.styles.ts
// タブバー中央の追加ボタン（FAB）と、その展開UIのスタイル
//
// 寸法と色は元の右下FAB（styles/index.styles.ts にあったもの）を
// 引き継いでいる。変えたのは配置だけ:
//   - 画面右下 → タブバー中央
//   - 展開時に縦積み → FABの左右へ振り分け（ラベルはボタンの上）
// ============================================================

import { StyleSheet } from 'react-native';
import { colors, radius } from '@/constants/theme';

/** タブバーの高さ。app/(tabs)/_layout.tsx の tabBarStyle.height と一致させること */
export const TAB_BAR_HEIGHT = 84;

/** 中央のFABの直径 */
export const FAB_SIZE = 64;

/** 展開したときのサブボタンの直径 */
export const FAB_ACTION_SIZE = 48;

/** FABの中心をタブバー上端に置くための持ち上げ量 */
export const FAB_LIFT = FAB_SIZE / 2;

/**
 * FABをタブバー側へ沈める量。
 * 0 だと円の中心がちょうどタブバー上端に来る（上半分が飛び出す）。
 * 値を増やすとタブバーに深く埋まり、飛び出す量が減る。
 */
export const FAB_SINK = 8;

export const styles = StyleSheet.create({
  // タブバー内に確保する空きスロット（押せない）
  slot: {
    flex: 1,
  },

  // タブバーの上に重ねるオーバーレイ。
  // pointerEvents="box-none" で、ボタン以外のタップは下の画面へ通す
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // 展開中に画面全体を覆う背景（タップで閉じる）。
  // 半透明の黒でグレーアウトさせ、メニューが開いていることを示す。
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // FABの位置決めの基準。幅をFABと同じにして中央に置く。
  //
  // 以前は FAB と左右のサブボタンを justifyContent:'center' の横並びに
  // していたが、それだと展開したときに **FABが横にずれた**
  // （「レシート撮影」と「手動入力」でラベルの文字数が違うため左右の列幅が
  // 変わり、中央揃えの基準がずれる。実測で 540px → 569px）。
  // サブボタンをこのアンカーからの絶対配置にして、FABの位置を
  // 左右の内容から完全に切り離す。
  anchor: {
    width: FAB_SIZE,
    alignItems: 'center',
  },

  // サブボタン1つ分（上のラベル + アイコン）。
  //
  // bottom で下端をタブバーの上端に合わせる。これを入れないとボタンが
  // タブのアイコンに重なる。
  // FAB_SINK を足しているのは、FABを沈めた分だけアンカーの下端も
  // 下がるため。足さないとサブボタンも一緒に下がってタブバーに食い込む
  // （FAB_SINK=8dp のとき、余裕が28px→7pxまで詰まる）。
  action: {
    position: 'absolute',
    bottom: FAB_LIFT + FAB_SINK,
    width: 112,
    alignItems: 'center',
  },

  // FABの左隣・右隣に置く（8dp の隙間）
  actionLeft: {
    right: FAB_SIZE + 8,
  },

  actionRight: {
    left: FAB_SIZE + 8,
  },

  actionButton: {
    width: FAB_ACTION_SIZE,
    height: FAB_ACTION_SIZE,
    borderRadius: FAB_ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },

  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },

  actionButtonSecondary: {
    backgroundColor: colors.textSecondary,
  },

  // 長押し＋ドラッグ中、いま選択されている側を強調する。
  // transformでの拡大はレイアウトサイズを変えないため、ラベルの位置は
  // ずれない（見た目だけ大きくなる）。
  //
  // 枠線と影は付けない。反対側を actionButtonDimmed で薄くしているので
  // 拡大だけで十分に分かる。
  actionButtonHighlighted: {
    transform: [{ scale: 1.2 }],
  },

  // 選択されていない側は薄くして、どちらが選ばれているか分かりやすくする。
  actionButtonDimmed: {
    opacity: 0.4,
  },

  // ラベルはボタンの「上」に置く。
  // 下に置くとタブバーの高さに食い込み、履歴タブとシフトタブの
  // アイコンにピルが重なってしまう（実機相当のエミュレーターで確認）。
  // スケッチも上に置く形だった。
  actionLabel: {
    marginBottom: 6,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  actionLabelText: {
    color: colors.surface,
    fontSize: 11,
  },

  // 中央のFAB本体
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    // タブバーの白地から浮かせる縁取り
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
