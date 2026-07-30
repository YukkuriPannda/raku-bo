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
import { AuthError, AuthErrorCode, parseAuthError } from './auth-errors';
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
// 認証コールバックの処理（唯一の入口）
//
// rakubo://auth/callback?code=... という1つのURLに対して、次の3箇所が
// ほぼ同時に反応する:
//   A. app/(auth)/login.tsx        openAuthSessionAsync の戻り
//   B. app/_layout.tsx handleUrl   Linking の url イベント
//   C. app/auth/callback.tsx       expo-router がこの画面へ遷移
//
// PKCE の code は使い捨てなので、3箇所がそれぞれ交換を試みると2箇所は
// 必ず失敗する。以前は各々が「ログイン進行中フラグ」を直接読み書きして
// 分岐していたため、それが交錯して「誰も交換していないのに全員が
// 『進行中ではない』と判断する」状態が起きていた（実機ログで確認）:
//
//   18.718 [AuthCallback] 受信パラメータ: code     ← C が code を受け取る
//   18.747 [Login] コールバック受信: dismiss       ← A は success ではなく dismiss
//   18.747 [Login] エラー: OAUTH_CANCELLED        ← A の finally がフラグを消す
//   18.761 [AuthCallback] 進行中のログインがないため破棄  ← C が誤判定してログインへ戻す
//   18.871 [Layout] 進行中のログインがないため無視        ← B も誤判定
//
// そこで、判定と交換はこの関数だけが行う。呼び出し側は結果を見て
// 画面遷移とエラー表示を決めるだけにする:
//   - 直列化: 同時に呼ばれても1件ずつ順に処理する
//   - 冪等:   同じ code は一度しか交換を試みない
//   - フラグ: ここでだけ読み、フローが決着したときにだけ消す
// ============================================================

/** コールバックURLから取り出した認証パラメータ */
export type OAuthCallbackInput = {
  code?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  providerToken?: string | null;
  providerRefreshToken?: string | null;
};

export type OAuthCallbackResult =
  /** この呼び出しがセッションを確立した */
  | { status: 'signed-in' }
  /** 既にセッションがある（他のハンドラが確立した、またはログイン済み） */
  | { status: 'already-done' }
  /** 自分が開始したログインの応答ではない（外部から投げ込まれたURL） */
  | { status: 'not-pending' }
  /** 認証パラメータが無い。他のハンドラが持っている可能性があるので何もしない */
  | { status: 'no-params' }
  /** 交換を試みて失敗した。この時点で code は使えなくなっている */
  | { status: 'failed'; error: AuthError };

/** 直列化用のチェーン。3箇所から同時に呼ばれても1件ずつ処理する */
let callbackQueue: Promise<unknown> = Promise.resolve();

/** 交換を試みた code。使い捨てなので二度目は試さない */
const attemptedCodes = new Set<string>();

/**
 * 認証コールバックを処理する。3箇所の呼び出し口はすべてこれを使う。
 * 同時に呼ばれても安全（順に処理され、勝った1つだけが実際に交換する）。
 */
export function handleOAuthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
  // 前の処理の成否にかかわらず次を実行する
  const run = callbackQueue.then(
    () => processOAuthCallback(input),
    () => processOAuthCallback(input),
  );
  // チェーン自体は例外で止めない
  callbackQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function processOAuthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
  // 1. 既にセッションがあるなら、外から来たトークンで差し替えない
  const { data: { session: existing } } = await supabase.auth.getSession();
  if (existing) {
    return { status: 'already-done' };
  }

  // 2. 自分が開始したログインの応答か。ここではまだフラグを消さない
  if (!(await isOAuthFlowPending())) {
    return { status: 'not-pending' };
  }

  const code = input.code ?? null;
  const accessToken = input.accessToken ?? null;
  const refreshToken = input.refreshToken ?? null;

  // 3. パラメータが無い場合はフラグを残したまま何もしない。
  //    別のハンドラが完全なURLを持っていることがあるため、
  //    ここでフラグを消すとその処理を妨害してしまう。
  if (!code && !(accessToken && refreshToken)) {
    return { status: 'no-params' };
  }

  // 4. 同じ code での二度目の交換は必ず失敗するので試さない
  if (code && attemptedCodes.has(code)) {
    return { status: 'already-done' };
  }

  // URL に provider_token が載っている場合は交換より先に保存する。
  // exchange / setSession は onAuthStateChange を即座に発火させるため、
  // 後で保存すると app/_layout.tsx 側が空の値を読んでしまう。
  if (input.providerToken) await saveGoogleAccessToken(input.providerToken);
  if (input.providerRefreshToken) await saveGoogleRefreshToken(input.providerRefreshToken);

  try {
    if (code) {
      attemptedCodes.add(code);
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        await endOAuthFlow();
        return {
          status: 'failed',
          error: new AuthError(AuthErrorCode.CODE_EXCHANGE_FAILED, undefined, error.message, error),
        };
      }
      // 交換で得られた値のほうが確実なので上書きする
      if (data.session?.provider_token) await saveGoogleAccessToken(data.session.provider_token);
      if (data.session?.provider_refresh_token) await saveGoogleRefreshToken(data.session.provider_refresh_token);
    } else {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken!,
        refresh_token: refreshToken!,
      });
      if (error) {
        await endOAuthFlow();
        return {
          status: 'failed',
          error: new AuthError(AuthErrorCode.SET_SESSION_FAILED, undefined, error.message, error),
        };
      }
      // setSession は provider_token を返さないため、上で保存した URL の値をそのまま使う
    }

    await endOAuthFlow();
    return { status: 'signed-in' };
  } catch (err) {
    await endOAuthFlow();
    return { status: 'failed', error: parseAuthError(err) };
  }
}

/**
 * コールバックURLから認証パラメータを取り出す。
 * トークンを含むため、戻り値の中身はログに出さないこと。
 */
export function parseOAuthCallbackUrl(url: string): OAuthCallbackInput {
  // フラグメントを先に切り離す。`?a=b#c=d` を単純に '?' で分割すると
  // クエリ側にフラグメントが混入する
  const [beforeHash, afterHash = ''] = url.split('#');
  const query = new URLSearchParams(beforeHash.split('?')[1] ?? '');
  const hash = new URLSearchParams(afterHash);
  const pick = (name: string) => hash.get(name) ?? query.get(name);

  return {
    code: query.get('code'),
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    providerToken: pick('provider_token'),
    providerRefreshToken: pick('provider_refresh_token'),
  };
}

/**
 * 進行中のログインが決着するのを待つ。
 *
 * Android では、コールバックのディープリンクが LAUNCH_SINGLE_TASK で
 * アプリを前面に戻すためカスタムタブが閉じられ、openAuthSessionAsync は
 * 'success' ではなく 'dismiss' を返す（実機ログで確認）。
 * つまり 'dismiss' は「ユーザーがキャンセルした」とは限らず、
 * B/C 側がコールバックを処理中の可能性がある。そこで少し待って確かめる。
 *
 * @returns セッションが確立できたら true
 */
export async function waitForOAuthConclusion(timeoutMs = 3000, intervalMs = 200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;

    // フラグが消えているなら、どこかで決着している（失敗確定）
    if (!(await isOAuthFlowPending())) return false;

    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
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
