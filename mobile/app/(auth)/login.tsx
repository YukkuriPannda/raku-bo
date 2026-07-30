import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import {
  supabase,
  beginOAuthFlow,
  endOAuthFlow,
  handleOAuthCallback,
  parseOAuthCallbackUrl,
  waitForOAuthConclusion,
} from '@/lib/auth';
import { AuthError, AuthErrorCode, formatAuthError } from '@/lib/auth-errors';

WebBrowser.maybeCompleteAuthSession();

// Supabase は登録済みの http:// URL にしかリダイレクトしないため、
// Web アプリを中継してアプリへ転送する。
// app_redirect に現在の環境のコールバック URL を渡すことで正しいアプリが開く：
//   Expo Go:    exp://IP:PORT/--/auth/callback
//   Standalone: rakubo://auth/callback
const WEB_CALLBACK = 'https://raku-bo-web.pages.dev/auth/callback';
const appCallback = Linking.createURL('auth/callback');
const REDIRECT_URI = `${WEB_CALLBACK}?app_redirect=${encodeURIComponent(appCallback)}`;

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // 「このアプリ自身が開始したログイン」であることを記録する。
      // これが立っていないコールバックのディープリンクは
      // app/_layout.tsx 側で破棄される（外部からのセッション注入対策）。
      await beginOAuthFlow();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error || !data.url) {
        // ブラウザを開く前の失敗。進行中フラグを残す理由がないので片付ける
        await endOAuthFlow();
        throw new AuthError(AuthErrorCode.OAUTH_URL_FAILED, undefined, error?.message);
      }

      // 認証URL・コールバックURLはログに出さない。
      // implicit フローだと result.url のフラグメントに access_token /
      // refresh_token / provider_refresh_token が生で載るため、
      // そのまま出力すると logcat・バグレポート経由で漏れる。
      // PKCE でも code が載るので、URL 自体を出力しない方針にする。
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
      console.log('[Login] コールバック受信:', result.type);

      // 認証パラメータはこのハンドラだけのものではない。同じURLに
      // app/_layout.tsx と app/auth/callback.tsx も反応するため、
      // 実際の判定と交換は lib/auth.ts の handleOAuthCallback に任せる
      // （直列化・冪等・フラグ管理を1箇所に集約している）。
      if (result.type === 'success' && (result as any).url) {
        const outcome = await handleOAuthCallback(parseOAuthCallbackUrl((result as any).url));
        console.log('[Login] コールバック処理:', outcome.status);
        if (outcome.status === 'failed') {
          throw outcome.error;
        }
        return;
      }

      // ここに来たのは result.type が 'dismiss' / 'cancel' のとき。
      //
      // Android では rakubo:// のディープリンクが LAUNCH_SINGLE_TASK で
      // アプリを前面に戻すためカスタムタブが閉じられ、
      // openAuthSessionAsync は 'success' ではなく 'dismiss' を返す。
      // openAuthSessionAsync に渡す redirectUrl は https の中継URLで、
      // 実際の最終URLは rakubo:// なので 'success' にはならない。
      // つまりこの経路は正常なログインでも必ず通る。
      //
      // かつてここで無条件に endOAuthFlow() を呼んでいたため、
      // 処理中だった _layout.tsx / auth/callback.tsx が
      // 「進行中のログインがない」と誤判定してログイン画面へ戻し、
      // 誰も code を交換しないままループしていた。
      // そのため、決着を待ってから本当のキャンセルか判断する。
      const signedIn = await waitForOAuthConclusion();
      if (signedIn) {
        console.log('[Login] 他のハンドラがセッションを確立しました');
        return;
      }

      // セッションができず、フラグも残っている＝実際にキャンセルされた
      await endOAuthFlow();
      throw new AuthError(AuthErrorCode.OAUTH_CANCELLED, undefined, result.type);
    } catch (err) {
      const authErr = err instanceof AuthError ? err : new AuthError(AuthErrorCode.UNKNOWN, undefined, String(err));
      console.error('[Login] エラー:', authErr.code, authErr.detail ?? authErr.message);
      if (authErr.code !== AuthErrorCode.OAUTH_CANCELLED) {
        const { title, message } = formatAuthError(authErr);
        Alert.alert(title, message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <View className="mb-16 items-center">
        <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
          <Text className="text-4xl">💰</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-800">らく〜ぼ</Text>
        <Text className="text-base text-gray-500 mt-2">かんたん家計簿アプリ</Text>
      </View>

      <TouchableOpacity
        onPress={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex-row items-center justify-center bg-white border border-gray-300 rounded-xl py-4 px-6 shadow-sm active:opacity-70"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#22c55e" />
        ) : (
          <Text className="text-lg font-semibold text-gray-700">
            Google でログイン
          </Text>
        )}
      </TouchableOpacity>

      <Text className="text-xs text-gray-400 mt-8 text-center">
        ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
      </Text>
    </View>
  );
}
