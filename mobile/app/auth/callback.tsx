import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, isOAuthFlowPending, endOAuthFlow } from '@/lib/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    const handle = async () => {
      // params / initialUrl には access_token・refresh_token・
      // provider_refresh_token が含まれるため中身をログに出さない。
      // 出力すると logcat やバグレポート経由でセッションごと漏れる。
      console.log('[AuthCallback] 受信パラメータ:', Object.keys(params).join(',') || '(なし)');

      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing) {
        router.replace('/(tabs)');
        return;
      }

      // 自分が開始したログインの応答でなければ処理しない。
      // このスキーム（rakubo://）は他アプリからも起動できるため、
      // 外部から送り込まれたトークンでセッションを作らせない。
      if (!(await isOAuthFlowPending())) {
        console.warn('[AuthCallback] 進行中のログインがないため破棄しました');
        router.replace('/(auth)/login');
        return;
      }
      await endOAuthFlow();

      const { access_token, refresh_token, code } = params;
      try {
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[AuthCallback] setSession:', error ? 'failed' : 'ok');
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[AuthCallback] exchange:', error ? 'failed' : 'ok');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (err) {
        console.error('[AuthCallback] エラー:', err instanceof Error ? err.message : 'unknown');
        router.replace('/(auth)/login');
      }
    };
    handle();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#22c55e" />
    </View>
  );
}
