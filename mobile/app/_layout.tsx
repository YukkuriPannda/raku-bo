// ============================================================
// app/_layout.tsx
// ルートレイアウト
// - フォント読み込み
// - Supabase セッションチェック → 認証状態でリダイレクト
// - NativeWind / GestureHandlerRootView でラップ
// ============================================================

import '../global.css';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { supabase, getGoogleAccessToken, saveGoogleAccessToken, loadGoogleAccessToken, clearGoogleAccessToken, saveGoogleRefreshToken, loadGoogleRefreshToken, clearGoogleRefreshToken } from '@/lib/auth';
import { AuthError, AuthErrorCode, formatAuthError } from '@/lib/auth-errors';
import { initDB } from '@/lib/db';
import { useAppStore } from '@/store';

// スプラッシュスクリーンを手動制御
SplashScreen.preventAutoHideAsync();

// URLから取り出した provider_token / provider_refresh_token を一時保持（setSession は受け取れないため）
let pendingGoogleToken = '';
let pendingGoogleRefreshToken = '';

// ============================================================
// 認証状態を監視して画面遷移を制御するフック
// ============================================================
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const setUser = useAppStore((s) => s.setUser);
  const fetchProfile = useAppStore((s) => s.fetchProfile);

  useEffect(() => {
    // 初回セッションチェック（既存セッションがある場合）
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // provider_token は再起動後 null になるため SecureStore から復元する
        const storedToken = await loadGoogleAccessToken();
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          googleAccessToken: getGoogleAccessToken(session) ?? storedToken ?? '',
        });
        fetchProfile();
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
      const providerRefreshToken = h.get('provider_refresh_token') ?? q.get('provider_refresh_token');

      if (providerToken) pendingGoogleToken = providerToken;
      if (providerRefreshToken) pendingGoogleRefreshToken = providerRefreshToken;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const authErr = new AuthError(AuthErrorCode.CODE_EXCHANGE_FAILED, undefined, error.message, error);
          console.error('[Layout] exchange error:', authErr.code, error.message);
          const { title, message } = formatAuthError(authErr);
          Alert.alert(title, message);
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          const authErr = new AuthError(AuthErrorCode.SET_SESSION_FAILED, undefined, error.message, error);
          console.error('[Layout] setSession error:', authErr.code, error.message);
          const { title, message } = formatAuthError(authErr);
          Alert.alert(title, message);
        }
      }
    };
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    // セッション変更を購読
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          // provider_token は setSession 後や再起動後に null になるため、
          // URL から取得した値 → SecureStore の既存値の順にフォールバックする。
          // ここで storedToken を経由しないと、有効なトークンが空文字で
          // 上書きされてしまう（getSession() 側のフォールバックとの競合）。
          const storedToken = await loadGoogleAccessToken();
          const googleAccessToken = session.provider_token || pendingGoogleToken || storedToken || '';
          pendingGoogleToken = '';
          if (googleAccessToken) {
            await saveGoogleAccessToken(googleAccessToken);
          }
          const storedRefreshToken = await loadGoogleRefreshToken();
          const googleRefreshToken = session.provider_refresh_token || pendingGoogleRefreshToken || storedRefreshToken || '';
          pendingGoogleRefreshToken = '';
          if (googleRefreshToken) {
            await saveGoogleRefreshToken(googleRefreshToken);
          }
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            googleAccessToken,
          });
          fetchProfile();
          router.replace('/(tabs)');
        } else {
          await clearGoogleAccessToken();
          await clearGoogleRefreshToken();
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
