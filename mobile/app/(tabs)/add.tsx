// ============================================================
// app/(tabs)/add.tsx
// タブバー中央の追加ボタン用のプレースホルダ
//
// この画面は表示されない。`app/(tabs)/_layout.tsx` が中央に
// スロットを1つ確保するために <Tabs.Screen name="add"> を置いており、
// expo-router は名前に対応する実ファイルが無いと
//   No route named "add" exists in nested children
// を起動ごとに警告する（screens/confirm で実際に起きていた）。
// そのためファイル自体は必要になる。
//
// スロットの中身は押せない空白で、タップは tabPress の preventDefault と
// 併せて無効化している。それでも直接 /add へ来られた場合に行き止まりに
// ならないよう、ホームへ送る。
// ============================================================

import { Redirect } from 'expo-router';

export default function AddPlaceholder() {
  return <Redirect href="/(tabs)" />;
}
