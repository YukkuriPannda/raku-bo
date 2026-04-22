// ============================================================
// app/index.tsx
// エントリポイント
// 認証状態に応じてリダイレクトする
// 実際のリダイレクトは _layout.tsx の useAuthGuard で処理されるため、
// このファイルはローディング表示のみ担当する
// ============================================================

import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#22c55e" />
    </View>
  );
}
