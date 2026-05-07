// ============================================================
// app/(auth)/_layout.tsx
// 認証グループのレイアウト
// ============================================================

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
