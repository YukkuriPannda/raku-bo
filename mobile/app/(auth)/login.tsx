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

import { supabase, saveGoogleAccessToken, saveGoogleRefreshToken } from '@/lib/auth';
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
        throw new AuthError(AuthErrorCode.OAUTH_URL_FAILED, undefined, error?.message);
      }

      console.log('[Login] REDIRECT_URI:', REDIRECT_URI);
      console.log('[Login] OAuth URL:', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
      console.log('[Login] result:', result.type, (result as any).url ?? '');

      if (result.type !== 'success' || !(result as any).url) {
        // ユーザーが自発的にブラウザを閉じた/キャンセルしたケース
        throw new AuthError(AuthErrorCode.OAUTH_CANCELLED, undefined, result.type);
      }

      const resultUrl: string = (result as any).url;
      const queryParams = new URLSearchParams(resultUrl.split('?')[1] ?? '');
      const hashParams = new URLSearchParams(resultUrl.split('#')[1] ?? '');
      const code = queryParams.get('code');
      const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token');

      if (code) {
        const { data: exchData, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchErr) throw new AuthError(AuthErrorCode.CODE_EXCHANGE_FAILED, undefined, exchErr.message, exchErr);
        const providerToken = exchData.session?.provider_token;
        if (providerToken) await saveGoogleAccessToken(providerToken);
        const providerRefreshToken = exchData.session?.provider_refresh_token;
        if (providerRefreshToken) await saveGoogleRefreshToken(providerRefreshToken);
      } else if (accessToken && refreshToken) {
        const { error: sessErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessErr) throw new AuthError(AuthErrorCode.SET_SESSION_FAILED, undefined, sessErr.message, sessErr);
        // setSession はGoogleのprovider_token/provider_refresh_tokenを返さないため、
        // コールバックURLに含まれていれば直接保存する
        const providerToken = hashParams.get('provider_token') ?? queryParams.get('provider_token');
        if (providerToken) await saveGoogleAccessToken(providerToken);
        const providerRefreshToken = hashParams.get('provider_refresh_token') ?? queryParams.get('provider_refresh_token');
        if (providerRefreshToken) await saveGoogleRefreshToken(providerRefreshToken);
      } else {
        // コールバックURLに code も access_token も含まれない想定外のケース
        throw new AuthError(AuthErrorCode.OAUTH_NO_PARAMS, undefined, resultUrl);
      }
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
