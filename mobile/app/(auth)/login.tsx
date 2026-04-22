// ============================================================
// app/(auth)/login.tsx
// Google Sign-In ログイン画面
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

import { signInWithGoogle } from '@/lib/auth';

// expo-auth-session がブラウザを正しく閉じるために必要
WebBrowser.maybeCompleteAuthSession();

// ============================================================
// ログイン画面コンポーネント
// ============================================================
export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Google OAuth リクエストの設定
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    // TODO: iOS / Web 用のクライアント ID を追加する
    // iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly', // Google カレンダー読み取り
    ],
  });

  // Google ログインボタン押下
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await promptAsync();

      if (result.type === 'success') {
        // authorization code を Supabase に渡してセッション作成
        const code = result.params.code;
        if (code) {
          await signInWithGoogle(code);
          // 認証後は _layout.tsx の onAuthStateChange がリダイレクトを処理
        }
      } else if (result.type === 'cancel') {
        // ユーザーがキャンセルした場合は何もしない
      } else {
        Alert.alert('ログインエラー', 'Google ログインに失敗しました。');
      }
    } catch (error) {
      console.error('[Login] エラー:', error);
      Alert.alert('エラー', 'ログイン処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      {/* アプリロゴ・タイトル */}
      <View className="mb-16 items-center">
        {/* TODO: アイコン画像を assets/icon.png に配置する */}
        <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
          <Text className="text-4xl">💰</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-800">らく〜ぼ</Text>
        <Text className="text-base text-gray-500 mt-2">かんたん家計簿アプリ</Text>
      </View>

      {/* Google ログインボタン */}
      <TouchableOpacity
        onPress={handleGoogleLogin}
        disabled={!request || isLoading}
        className="w-full flex-row items-center justify-center bg-white border border-gray-300 rounded-xl py-4 px-6 shadow-sm active:opacity-70"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#22c55e" />
        ) : (
          <>
            {/* Google ロゴ（テキスト代替） */}
            <Text className="text-lg font-semibold text-gray-700 ml-3">
              Google でログイン
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* 利用規約等の注記 */}
      <Text className="text-xs text-gray-400 mt-8 text-center">
        ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
      </Text>
    </View>
  );
}
