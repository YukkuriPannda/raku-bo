// ============================================================
// lib/auth-errors.ts
// 認証エラーの正規化ユーティリティ
// backend/src/types/error-codes.ts と同期を保つこと。
// ============================================================

import { isAuthError as isSupabaseAuthError } from '@supabase/supabase-js';
import { isAxiosError } from 'axios';

export const AuthErrorCode = {
  // --- バックエンド由来（backend/src/types/error-codes.ts と一致させる） ---
  NO_TOKEN: 'AUTH_NO_TOKEN',
  SUPABASE_VERIFY_FAILED: 'AUTH_SUPABASE_VERIFY_FAILED',
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
  GOOGLE_REFRESH_FAILED: 'AUTH_GOOGLE_REFRESH_FAILED',
  GOOGLE_TOKEN_MISSING: 'AUTH_GOOGLE_TOKEN_MISSING',
  GOOGLE_API_ERROR: 'AUTH_GOOGLE_API_ERROR',
  // --- モバイル側のみで正規化するもの ---
  OAUTH_URL_FAILED: 'AUTH_OAUTH_URL_FAILED',
  OAUTH_CANCELLED: 'AUTH_OAUTH_CANCELLED',
  OAUTH_NO_PARAMS: 'AUTH_OAUTH_NO_PARAMS',
  CODE_EXCHANGE_FAILED: 'AUTH_CODE_EXCHANGE_FAILED',
  SET_SESSION_FAILED: 'AUTH_SET_SESSION_FAILED',
  SESSION_GET_FAILED: 'AUTH_SESSION_GET_FAILED',
  SIGNOUT_FAILED: 'AUTH_SIGNOUT_FAILED',
  GOOGLE_REFRESH_TOKEN_MISSING: 'AUTH_GOOGLE_REFRESH_TOKEN_MISSING',
  NETWORK_ERROR: 'AUTH_NETWORK_ERROR',
  TIMEOUT: 'AUTH_TIMEOUT',
  UNKNOWN: 'AUTH_UNKNOWN',
} as const;

// バックエンドが将来コードを追加しても表示が壊れないよう string も許容する
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode] | (string & {});

const AUTH_ERROR_MESSAGES: Partial<Record<string, string>> = {
  [AuthErrorCode.NO_TOKEN]: '認証トークンがありません。再ログインしてください。',
  [AuthErrorCode.SUPABASE_VERIFY_FAILED]: 'セッションの有効期限が切れました。再ログインしてください。',
  [AuthErrorCode.TOKEN_INVALID]: '無効なセッションです。再ログインしてください。',
  [AuthErrorCode.REFRESH_TOKEN_MISSING]: 'Google連携のリフレッシュトークンがありません。再ログインしてください。',
  [AuthErrorCode.GOOGLE_REFRESH_FAILED]: 'Google連携の有効期限が切れました。再ログインしてください。',
  [AuthErrorCode.GOOGLE_TOKEN_MISSING]: 'Google連携情報が見つかりません。再ログインしてください。',
  [AuthErrorCode.GOOGLE_API_ERROR]: 'Googleカレンダーとの通信に失敗しました。',
  [AuthErrorCode.OAUTH_URL_FAILED]: 'ログインURLの取得に失敗しました。',
  [AuthErrorCode.OAUTH_CANCELLED]: 'ログインがキャンセルされました。',
  [AuthErrorCode.OAUTH_NO_PARAMS]: 'ログイン処理を完了できませんでした。もう一度お試しください。',
  [AuthErrorCode.CODE_EXCHANGE_FAILED]: 'ログイン処理に失敗しました。もう一度お試しください。',
  [AuthErrorCode.SET_SESSION_FAILED]: 'セッションの作成に失敗しました。もう一度お試しください。',
  [AuthErrorCode.SESSION_GET_FAILED]: 'セッションの取得に失敗しました。',
  [AuthErrorCode.SIGNOUT_FAILED]: 'サインアウトに失敗しました。',
  [AuthErrorCode.GOOGLE_REFRESH_TOKEN_MISSING]: 'Google連携が切れています。再ログインしてください。',
  [AuthErrorCode.NETWORK_ERROR]: 'ネットワークに接続できませんでした。通信環境をご確認ください。',
  [AuthErrorCode.TIMEOUT]: '通信がタイムアウトしました。もう一度お試しください。',
  [AuthErrorCode.UNKNOWN]: '不明なエラーが発生しました。',
};

/** 認証関連エラーを一意のコード付きで表す例外 */
export class AuthError extends Error {
  code: AuthErrorCode;
  detail?: string;
  cause?: unknown;

  constructor(code: AuthErrorCode, message?: string, detail?: string, cause?: unknown) {
    super(message ?? getAuthErrorMessage(code));
    this.name = 'AuthError';
    this.code = code;
    this.detail = detail;
    this.cause = cause;
  }
}

/** コードからユーザー向け日本語文言を得る */
export function getAuthErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES[AuthErrorCode.UNKNOWN]!;
}

/**
 * あらゆる例外を AuthError に正規化する唯一の入口。
 * 既に AuthError の場合はそのまま返し、二重ラップを防ぐ。
 */
export function parseAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) {
    return err;
  }

  if (isAxiosError(err)) {
    const responseCode = (err.response?.data as { code?: string } | undefined)?.code;
    const responseDetail = (err.response?.data as { detail?: string; error?: string } | undefined);
    if (responseCode) {
      return new AuthError(responseCode, undefined, responseDetail?.detail ?? responseDetail?.error, err);
    }
    if (err.code === 'ERR_NETWORK') {
      return new AuthError(AuthErrorCode.NETWORK_ERROR, undefined, err.message, err);
    }
    if (err.code === 'ECONNABORTED') {
      return new AuthError(AuthErrorCode.TIMEOUT, undefined, err.message, err);
    }
    if (err.response?.status === 401) {
      return new AuthError(AuthErrorCode.SUPABASE_VERIFY_FAILED, undefined, err.message, err);
    }
    return new AuthError(AuthErrorCode.UNKNOWN, undefined, err.message, err);
  }

  if (isSupabaseAuthError(err)) {
    const supabaseErr = err as { message: string; code?: string; status?: number };
    return new AuthError(
      AuthErrorCode.CODE_EXCHANGE_FAILED,
      undefined,
      supabaseErr.code ?? `status ${supabaseErr.status ?? '?'}: ${supabaseErr.message}`,
      err,
    );
  }

  if (err instanceof TypeError && /network/i.test(err.message)) {
    return new AuthError(AuthErrorCode.NETWORK_ERROR, undefined, err.message, err);
  }

  return new AuthError(AuthErrorCode.UNKNOWN, undefined, err instanceof Error ? err.message : String(err), err);
}

/**
 * 例外をログ出力用の安全な1行に変換する。
 *
 * axios のエラーオブジェクトを console にそのまま渡してはいけない。
 * AxiosError は `config` を自身のプロパティとして持ち、その中の
 * `headers.Authorization` に Supabase の JWT が入っている。
 * `util.inspect` 相当のシリアライズや `toJSON()` はこれを展開するため、
 * `console.error('...', error)` と書くとアクセストークンが logcat に出る
 * （実測で確認済み）。
 *
 * ログに出すのはコード・HTTPステータス・メッセージだけに限定する。
 */
export function describeError(err: unknown): string {
  const authErr = parseAuthError(err);
  const status = isAxiosError(err) ? err.response?.status : undefined;

  return [
    authErr.code,
    status !== undefined ? `status ${status}` : null,
    authErr.detail ?? authErr.message,
  ]
    .filter(Boolean)
    .join(' / ');
}

/** UI 表示用に「メッセージ + エラーコード」を組み立てる */
export function formatAuthError(err: unknown): { title: string; message: string } {
  const authErr = parseAuthError(err);
  return {
    title: 'エラー',
    message: `${getAuthErrorMessage(authErr.code)}\n（エラーコード: ${authErr.code}）`,
  };
}
