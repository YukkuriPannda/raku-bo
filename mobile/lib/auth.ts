// ============================================================
// lib/auth.ts
// Supabase Auth + Google OAuth 認証ユーティリティ
// ============================================================

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createClient } from '@supabase/supabase-js';

// expo-auth-session がブラウザセッションを正しく閉じるために必要
WebBrowser.maybeCompleteAuthSession();

// ============================================================
// Supabase クライアント（Auth のみ用途）
// ============================================================
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================
// リダイレクト URI の生成
// ============================================================
export const redirectUri = makeRedirectUri({
  scheme: 'rakubo',
  path: 'auth/callback',
});

// ============================================================
// Google OAuth でサインイン
// authorization code を受け取り、Supabase にセッションを作成する
// ============================================================
export async function signInWithGoogle(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw new Error(`Google サインインエラー: ${error.message}`);
  }
}

// ============================================================
// サインアウト
// ============================================================
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`サインアウトエラー: ${error.message}`);
  }
}

// ============================================================
// 現在のセッションを取得
// ============================================================
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`セッション取得エラー: ${error.message}`);
  }
  return data.session;
}

// ============================================================
// セッションから Google Access Token を取得
// ============================================================
export function getGoogleAccessToken(session: Awaited<ReturnType<typeof getSession>>): string | null {
  if (!session) return null;
  // Supabase セッションの provider_token には Google の access token が入る
  return session.provider_token ?? null;
}
