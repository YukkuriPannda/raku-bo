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
import * as Linking from 'expo-linking';
import { supabase, getGoogleAccessToken } from '@/lib/auth';
import { initDB } from '@/lib/db';
import { useAppStore } from '@/store';

// スプラッシュスクリーンを手動制御
SplashScreen.preventAutoHideAsync();

// URLから取り出した provider_token を一時保持（setSession は provider_token を受け取れないため）
let pendingGoogleToken = '';

// ============================================================
// 認証状態を監視して画面遷移を制御するフック
// ============================================================
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    // 初回セッションチェック（既存セッションがある場合）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          googleAccessToken: getGoogleAccessToken(session) ?? '',
        });
      }

      const inAuthCallback = segments[0] === 'auth';
      const inAuthGroup = segments[0] === '(auth)';
      if (!session && !inAuthGroup && !inAuthCallback) {
        router.replace('/(auth)/login');
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)');
      }
    });

    // exp:// ディープリンクを処理し、provider_token を保持してからセッションを設定
    const handleUrl = async (url: string) => {
      if (!url.includes('auth/callback')) return;
      const q = new URLSearchParams(url.split('?')[1] ?? '');
      const h = new URLSearchParams(url.split('#')[1] ?? '');
      const code = q.get('code');
      const accessToken = h.get('access_token') ?? q.get('access_token');
      const refreshToken = h.get('refresh_token') ?? q.get('refresh_token');
      const providerToken = h.get('provider_token') ?? q.get('provider_token');

      if (providerToken) pendingGoogleToken = providerToken;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('[Layout] exchange error:', error.message);
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    // セッション変更を購読
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          // provider_token は setSession 後に null になるため、URL から取得した値を優先
          const googleAccessToken = session.provider_token ?? pendingGoogleToken;
          pendingGoogleToken = '';
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            googleAccessToken,
          });
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      }
    );

    return () => {
      linkingSub.remove();
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
        {/* OAuth コールバック */}
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
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
        <Stack.Screen
          name="screens/manual-entry"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
