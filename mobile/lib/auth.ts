// ============================================================
// lib/auth.ts
// Supabase Auth + Google OAuth 認証ユーティリティ
// ============================================================

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { AuthError, AuthErrorCode } from './auth-errors';

// expo-auth-session がブラウザセッションを正しく閉じるために必要
WebBrowser.maybeCompleteAuthSession();

// ============================================================
// Supabase クライアント（Auth のみ用途）
// expo-secure-store をストレージとして使用し、セッション・PKCEコードを永続化する
// ============================================================
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// ============================================================
// リダイレクト URI の生成
// ============================================================
export const redirectUri = makeRedirectUri({
  scheme: 'rakubo',
  path: 'auth/callback',
});

// ============================================================
// Google Access Token の永続化
// provider_token は Supabase が再起動後に復元しないため SecureStore に保存する
// ============================================================
const GOOGLE_TOKEN_KEY = 'google_provider_token';
const GOOGLE_REFRESH_TOKEN_KEY = 'google_provider_refresh_token';

export async function saveGoogleAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, token);
}

export async function loadGoogleAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(GOOGLE_TOKEN_KEY);
}

export async function clearGoogleAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY);
}

export async function saveGoogleRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(GOOGLE_REFRESH_TOKEN_KEY, token);
}

export async function loadGoogleRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(GOOGLE_REFRESH_TOKEN_KEY);
}

export async function clearGoogleRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(GOOGLE_REFRESH_TOKEN_KEY);
}

// ============================================================
// Google OAuth でサインイン
// authorization code を受け取り、Supabase にセッションを作成する
// ============================================================
export async function signInWithGoogle(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw new AuthError(AuthErrorCode.CODE_EXCHANGE_FAILED, undefined, error.message, error);
  }
}

// ============================================================
// サインアウト（Google トークンも削除）
// ============================================================
export async function signOut(): Promise<void> {
  await clearGoogleAccessToken();
  await clearGoogleRefreshToken();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new AuthError(AuthErrorCode.SIGNOUT_FAILED, undefined, error.message, error);
  }
}

// ============================================================
// 現在のセッションを取得
// ============================================================
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new AuthError(AuthErrorCode.SESSION_GET_FAILED, undefined, error.message, error);
  }
  return data.session;
}

// ============================================================
// セッションから Google Access Token を取得
// provider_token は再起動後 null になるため SecureStore から補完する
// ============================================================
export function getGoogleAccessToken(session: Awaited<ReturnType<typeof getSession>>): string | null {
  if (!session) return null;
  return session.provider_token ?? null;
}
