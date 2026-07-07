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
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export interface ApiErrorBody {
  error: string;
  code: AuthErrorCode;
  detail?: string;
}
