// ============================================================
// app/_layout.tsx
// ルートレイアウト
// - フォント読み込み
// - Supabase セッションチェック → 認証状態でリダイレクト
// - NativeWind / GestureHandlerRootView でラップ
// ============================================================

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { supabase, getGoogleAccessToken } from '@/lib/auth';
import { initDB } from '@/lib/db';
import { useAppStore } from '@/store';

// スプラッシュスクリーンを手動制御
SplashScreen.preventAutoHideAsync();

// ============================================================
// 認証状態を監視して画面遷移を制御するフック
// ============================================================
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    // 初回セッションチェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          googleAccessToken: getGoogleAccessToken(session) ?? '',
        });
      }

      // 現在のルートに基づいてリダイレクト判定
      const inAuthGroup = segments[0] === '(auth)';
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)');
      }
    });

    // セッション変更を購読
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            googleAccessToken: getGoogleAccessToken(session) ?? '',
          });
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ============================================================
// ルートレイアウトコンポーネント
// ============================================================
export default function RootLayout() {
  // Expo 標準フォント（必要に応じてカスタムフォントを追加）
  const [fontsLoaded] = useFonts({
    // TODO: カスタムフォントが必要な場合はここに追加
    // 'Noto-Sans-JP': require('../assets/fonts/NotoSansJP-Regular.ttf'),
  });

  useAuthGuard();

  useEffect(() => {
    // DB 初期化（ローカルキャッシュ）
    initDB().catch((e) => console.error('[initDB]', e));
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 認証グループ */}
        <Stack.Screen name="(auth)" />
        {/* タブグループ */}
        <Stack.Screen name="(tabs)" />
        {/* モーダル画面 */}
        <Stack.Screen
          name="screens/camera"
          options={{ presentation: 'modal', headerShown: true, title: 'レシートを撮影' }}
        />
        <Stack.Screen
          name="screens/confirm"
          options={{ presentation: 'modal', headerShown: true, title: '内容を確認' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
