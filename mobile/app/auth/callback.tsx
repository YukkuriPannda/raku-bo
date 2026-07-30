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
      //
      // フラグはここで消さない。同じURLに login.tsx と _layout.tsx の
      // ディープリンクハンドラも反応するため、消すと残りが誤判定する。
      if (!(await isOAuthFlowPending())) {
        console.warn('[AuthCallback] 進行中のログインがないため破棄しました');
        router.replace('/(auth)/login');
        return;
      }

      const { access_token, refresh_token, code } = params;

      // パラメータが無いのは想定外。ログインに戻す
      if (!code && !(access_token && refresh_token)) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const { error } = access_token && refresh_token
          ? await supabase.auth.setSession({ access_token, refresh_token })
          : await supabase.auth.exchangeCodeForSession(code!);

        if (!error) {
          await endOAuthFlow();
          console.log('[AuthCallback] セッション確立');
          return; // 遷移は onAuthStateChange に任せる
        }

        // 失敗しても、他のハンドラが先に処理を終えていればセッションはある。
        // PKCE の code は使い捨てなので、この経路は正常時にも起こりうる。
        // ここでログイン画面へ戻すとログインループになるため戻さない。
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await endOAuthFlow();
          console.warn('[AuthCallback] 他のハンドラが処理済み（セッションあり）');
          return;
        }

        console.error('[AuthCallback] セッションを確立できませんでした:', error.message);
        await endOAuthFlow();
        router.replace('/(auth)/login');
      } catch (err) {
        console.error('[AuthCallback] エラー:', err instanceof Error ? err.message : 'unknown');
        // 例外時も、セッションができているなら戻さない
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await endOAuthFlow();
          router.replace('/(auth)/login');
        }
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
