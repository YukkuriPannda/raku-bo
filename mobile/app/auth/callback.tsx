import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    const handle = async () => {
      console.log('[AuthCallback] params:', JSON.stringify(params));
      const initialUrl = await Linking.getInitialURL();
      console.log('[AuthCallback] initialUrl:', initialUrl);

      const { data: { session: existing } } = await supabase.auth.getSession();
      console.log('[AuthCallback] existing session:', !!existing);
      if (existing) {
        router.replace('/(tabs)');
        return;
      }

      const { access_token, refresh_token, code } = params;
      try {
        if (access_token && refresh_token) {
          console.log('[AuthCallback] setSession...');
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[AuthCallback] setSession result:', error?.message ?? 'ok');
        } else if (code) {
          console.log('[AuthCallback] exchangeCodeForSession...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[AuthCallback] exchange result:', error?.message ?? 'ok');
        } else {
          console.log('[AuthCallback] no params, go to login');
          router.replace('/(auth)/login');
        }
      } catch (err) {
        console.error('[AuthCallback] エラー:', err);
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
