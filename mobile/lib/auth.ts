// ============================================================
// lib/auth.ts
// Supabase Auth + Google OAuth 認証ユーティリティ
// ============================================================

import { AppState } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { createClient } from '@supabase/supabase-js';
import { AuthError, AuthErrorCode } from './auth-errors';
import { getKVItem, setKVItem, removeKVItem } from './db';

// expo-auth-session がブラウザセッションを正しく閉じるために必要
WebBrowser.maybeCompleteAuthSession();

// ============================================================
// Supabase クライアント（Auth のみ用途）
//
// SecureStoreは1件あたり2048バイトまでという制限があり、Supabaseの
// セッション（JWT + ユーザー情報 + プロバイダ情報を含むJSON）はこれを
// 容易に超える。超えた場合SecureStoreは警告を出すだけで書き込みを続行
// するため、書き込みが壊れたセッションがリフレッシュトークンごと失われ、
// 「Invalid Refresh Token」で強制ログアウトになる不具合が実際に発生していた。
//
// そのため、セッション本体はサイズ上限のないexpo-sqlite（暗号化して保存）
// に置き、SecureStoreにはその復号鍵（数十バイト）だけを保存する。
// ============================================================
class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(256 / 8);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await getKVItem(key);
    if (!encrypted) return null;
    return this._decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await setKVItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await removeKVItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE を明示する。supabase-js の既定は 'implicit' で、その場合
      // コールバックURLのフラグメントに access_token / refresh_token /
      // provider_refresh_token が生で載る。カスタムスキーム（rakubo://）は
      // Android で他アプリも登録できるため、生トークンを URL に流さない
      // PKCE にしておく。code は1回しか使えず、交換には端末内に保存された
      // code_verifier が必要なので、URL を横取りされても交換できない。
      flowType: 'pkce',
    },
  }
);

// ============================================================
// トークンの自動リフレッシュ制御
// RNではバックグラウンド中にJSタイマーが止まるため、supabase-jsの
// プロアクティブなリフレッシュタイマーが機能しない。フォアグラウンド
// 復帰時に明示的に再開させないと、アクセストークン（デフォルト有効期限
// 1時間）が期限切れのまま放置され、リフレッシュトークンのローテーション
// と絡んで「1時間おきに再ログインを求められる」不具合につながる
// （Supabase公式のReact Native連携で推奨されている対応）。
// ============================================================
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// ============================================================
// リダイレクト URI の生成
// ============================================================
export const redirectUri = makeRedirectUri({
  scheme: 'rakubo',
  path: 'auth/callback',
});

// ============================================================
// ログイン進行中フラグ
//
// 認証コールバックのディープリンク（rakubo://auth/callback?...）は、
// 他アプリや Web ページからでも自由に投げ込める。中のトークンを無条件に
// setSession() へ渡すと、攻撃者が自分のセッションを送り込んで被害者の
// アプリを乗り換えさせられる（以後の入力が攻撃者のアカウントに入る）。
//
// そのため「このアプリ自身が開始したログインの応答か」を判定できるように、
// ログイン開始時にフラグを立てて SecureStore に永続化する。
// コールバック処理側はこのフラグが立っているときだけ処理する。
// 永続化するのは、OAuth 中にアプリが落とされてコールドスタートで
// 復帰する経路があるため（モジュール変数では失われる）。
// ============================================================
const OAUTH_PENDING_KEY = 'oauth_flow_pending_at';

/** このフラグが有効と見なす時間。放置された古いフラグを使い回させない */
const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;

/**
 * ログイン開始を記録する。
 *
 * 注意: このフラグの確認は「消費」してはいけない。
 * 1つのコールバックURLに対して3箇所（login.tsx / _layout.tsx の
 * ディープリンクハンドラ / app/auth/callback.tsx の画面）が反応するため、
 * 確認と同時に消すと最初に走った1つだけが処理でき、残りは
 * 「進行中ではない」と誤判定してログイン画面へ戻してしまう
 * （ログインループの原因になる）。
 * 消すのは endOAuthFlow() を呼ぶ側の責務とし、
 * セッション確立後・失敗後・キャンセル後にのみ消す。
 */
export async function beginOAuthFlow(): Promise<void> {
  await SecureStore.setItemAsync(OAUTH_PENDING_KEY, String(Date.now()));
}

/** 進行中フラグを消す（成功・失敗・キャンセルのいずれでも呼ぶ） */
export async function endOAuthFlow(): Promise<void> {
  await SecureStore.deleteItemAsync(OAUTH_PENDING_KEY);
}

/**
 * 自分が開始したログインが進行中か。
 * TTL を超えた古いフラグは無効として消す。
 */
export async function isOAuthFlowPending(): Promise<boolean> {
  const startedAt = await SecureStore.getItemAsync(OAUTH_PENDING_KEY);
  if (!startedAt) return false;

  const elapsed = Date.now() - Number(startedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > OAUTH_PENDING_TTL_MS) {
    await endOAuthFlow();
    return false;
  }
  return true;
}

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
  await endOAuthFlow();
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
