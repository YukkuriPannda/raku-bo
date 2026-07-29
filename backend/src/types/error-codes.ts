/**
 * 認証関連のエラーコード定義。
 * mobile/lib/auth-errors.ts と同期を保つこと。
 */
export const AuthErrorCode = {
  NO_TOKEN: 'AUTH_NO_TOKEN',
  SUPABASE_VERIFY_FAILED: 'AUTH_SUPABASE_VERIFY_FAILED',
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
  GOOGLE_REFRESH_FAILED: 'AUTH_GOOGLE_REFRESH_FAILED',
  GOOGLE_TOKEN_MISSING: 'AUTH_GOOGLE_TOKEN_MISSING',
  GOOGLE_API_ERROR: 'AUTH_GOOGLE_API_ERROR',
  /** ログイン中のアカウントに Google 連携がない（= 引き換え対象を特定できない） */
  GOOGLE_IDENTITY_MISSING: 'AUTH_GOOGLE_IDENTITY_MISSING',
  /** 引き換えたトークンの持ち主が呼び出し元と一致しない（他人のトークン） */
  GOOGLE_IDENTITY_MISMATCH: 'AUTH_GOOGLE_IDENTITY_MISMATCH',
  /** 引き換えたトークンの持ち主を Google に確認できなかった */
  GOOGLE_IDENTITY_UNVERIFIABLE: 'AUTH_GOOGLE_IDENTITY_UNVERIFIABLE',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export interface ApiErrorBody {
  error: string;
  code: AuthErrorCode;
  detail?: string;
}
