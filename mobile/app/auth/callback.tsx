import { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { handleOAuthCallback } from '@/lib/auth';
import { formatAuthError } from '@/lib/auth-errors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    provider_token?: string;
    provider_refresh_token?: string;
  }>();

  useEffect(() => {
    const handle = async () => {
      // params には access_token・refresh_token・provider_refresh_token が
      // 含まれるため中身をログに出さない。出力すると logcat や
      // バグレポート経由でセッションごと漏れる。
      console.log('[AuthCallback] 受信パラメータ:', Object.keys(params).join(',') || '(なし)');

      // 判定と交換は lib/auth.ts に集約している。同じURLに login.tsx と
      // _layout.tsx も反応するため、ここで進行中フラグを直接読み書きすると
      // 互いを妨害してログインループになる（実機ログで確認済み）。
      const outcome = await handleOAuthCallback({
        code: params.code,
        accessToken: params.access_token,
        refreshToken: params.refresh_token,
        providerToken: params.provider_token,
        providerRefreshToken: params.provider_refresh_token,
      });

      switch (outcome.status) {
        case 'signed-in':
          console.log('[AuthCallback] セッション確立');
          // 遷移は app/_layout.tsx の onAuthStateChange に任せる
          return;

        case 'already-done':
          // 他のハンドラが先に確立した、または既にログイン済み。
          // ここでログイン画面へ戻すとループになる
          console.log('[AuthCallback] 処理済み（セッションあり）');
          router.replace('/(tabs)');
          return;

        case 'not-pending':
          // このスキーム（rakubo://）は他アプリからも起動できる。
          // 自分が開始したログインの応答でなければセッションを作らない
          console.warn('[AuthCallback] 進行中のログインがないため破棄しました');
          router.replace('/(auth)/login');
          return;

        case 'no-params':
          console.warn('[AuthCallback] 認証パラメータがありません');
          router.replace('/(auth)/login');
          return;

        case 'failed': {
          console.error('[AuthCallback] セッションを確立できませんでした:', outcome.error.code);
          const { title, message } = formatAuthError(outcome.error);
          Alert.alert(title, message);
          router.replace('/(auth)/login');
          return;
        }
      }
    };
    handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#22c55e" />
    </View>
  );
}
