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
import * as QuickActions from 'expo-quick-actions';
import * as Notifications from 'expo-notifications';
import { supabase, getGoogleAccessToken, saveGoogleAccessToken, loadGoogleAccessToken, clearGoogleAccessToken, saveGoogleRefreshToken, loadGoogleRefreshToken, clearGoogleRefreshToken, handleOAuthCallback, parseOAuthCallbackUrl } from '@/lib/auth';
import { formatAuthError, describeError } from '@/lib/auth-errors';
import { initDB, clearCache } from '@/lib/db';
import { clearWidgetBudget, clearWidgetHeatmap } from '@/lib/widget-bridge';
import { clearReceiptQuickCaptureNotification } from '@/lib/notifications';
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

    // 認証コールバックのディープリンク（rakubo:// と exp:// の両方）を処理する。
    //
    // このハンドラは他アプリや Web ページからも起動できる（rakubo:// は
    // Android では誰でも登録できるカスタムスキーム）。URL 内のトークンを
    // 無条件に setSession() へ渡すと、攻撃者が自分のセッションを送り込んで
    // 被害者のアプリを乗り換えさせられ、以後の入力が攻撃者のアカウントへ
    // 保存される。その判定（ログイン済みでないか／自分が開始したログインか）と
    // 実際の交換は lib/auth.ts の handleOAuthCallback に集約している。
    // 同じURLに login.tsx と app/auth/callback.tsx も反応するため、
    // ここで個別に判定するとフラグの読み書きが交錯してログインループになる。
    const handleUrl = async (url: string) => {
      if (!url.includes('auth/callback')) return;

      const outcome = await handleOAuthCallback(parseOAuthCallbackUrl(url));

      switch (outcome.status) {
        case 'signed-in':
          // 遷移は下の onAuthStateChange が行う
          console.log('[Layout] セッション確立');
          return;

        case 'already-done':
          console.log('[Layout] 認証コールバックは処理済み（セッションあり）');
          return;

        case 'not-pending':
          console.warn('[Layout] 進行中のログインがないため認証ディープリンクを無視しました');
          return;

        case 'no-params':
          console.warn('[Layout] 認証パラメータがないため無視しました');
          return;

        case 'failed': {
          console.error('[Layout] コールバック処理に失敗:', outcome.error.code, outcome.error.detail ?? outcome.error.message);
          const { title, message } = formatAuthError(outcome.error);
          Alert.alert(title, message);
          return;
        }
      }
    };
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    // セッション変更を購読
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          // provider_token は setSession 後や再起動後に null になるため、
          // セッションの値 → SecureStore の既存値の順にフォールバックする。
          // ここで storedToken を経由しないと、有効なトークンが空文字で
          // 上書きされてしまう（getSession() 側のフォールバックとの競合）。
          // URL に載っていた provider_token は handleOAuthCallback が
          // 交換より先に SecureStore へ保存しているため、ここで読める。
          const storedToken = await loadGoogleAccessToken();
          const googleAccessToken = session.provider_token || storedToken || '';
          if (googleAccessToken) {
            await saveGoogleAccessToken(googleAccessToken);
          }
          const storedRefreshToken = await loadGoogleRefreshToken();
          const googleRefreshToken = session.provider_refresh_token || storedRefreshToken || '';
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
          // セッション失効による自動サインアウトもここを通る。
          // store.logout() とは別経路なので、端末に残る表示物の後片付けを
          // ここでも行う。消し忘れると次の3箇所に前のユーザーの家計情報が
          // 残り続ける:
          //   - SQLite のキャッシュ（別アカウントでオフライン時に表示される）
          //   - ホーム画面ウィジェット（残額・直近の店名。ロック解除不要で見える）
          //   - 常駐通知（ロック画面に残額が出たまま）
          await Promise.allSettled([
            clearCache(),
            clearReceiptQuickCaptureNotification(),
          ]).then((results) => {
            const failed = results.find((r) => r.status === 'rejected');
            if (failed?.status === 'rejected') {
              console.error('[Layout] サインアウト後の後片付けに失敗:', describeError(failed.reason));
            }
          });
          clearWidgetBudget();
          clearWidgetHeatmap();
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
  const router = useRouter();

  useAuthGuard();

  useEffect(() => {
    // 常駐通知（レシート撮影）タップ時の遷移
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (typeof screen === 'string') {
        router.push(screen as never);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    // DB 初期化（ローカルキャッシュ）
    initDB().catch((e) => console.error('[initDB]', e));
  }, []);

  useEffect(() => {
    // App Shortcuts（ホーム画面アイコン長押しメニュー等から登録）
    // OEMのロック画面ショートカット選択もこの仕組みを参照する端末がある
    QuickActions.setItems([
      {
        id: 'receipt-camera',
        title: 'レシート撮影',
        params: { href: '/screens/camera' },
      },
    ]).catch((e) => console.error('[QuickActions.setItems]', e));
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
        {/* screens/confirm は登録しない。app/screens/confirm.tsx が存在せず、
            expo-router が起動ごとに
            「No route named "screens/confirm" exists in nested children」
            を警告していた。撮影後の確認は screens/manual-entry が担っており、
            この画面への遷移はコード上どこにも無い（初期設計の名残） */}
        <Stack.Screen
          name="screens/manual-entry"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
