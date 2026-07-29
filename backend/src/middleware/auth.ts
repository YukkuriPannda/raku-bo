import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types';
import { AuthErrorCode } from '../types/error-codes';

/** Supabase /auth/v1/user のレスポンスのうち、ここで参照する部分だけ */
interface SupabaseUser {
  id: string;
  identities?: Array<{ provider?: string; id?: string }>;
  user_metadata?: { sub?: string; provider_id?: string };
}

/**
 * Supabase ユーザーから Google の sub（OIDC subject）を取り出す。
 *
 * identities[] に provider='google' のエントリがあれば、その id が Google の sub。
 * 取れない場合は user_metadata の sub / provider_id にフォールバックする
 * （Google 単独連携のアカウントでは同じ値が入る）。
 * Google 連携がなければ null。
 */
function extractGoogleSub(user: SupabaseUser): string | null {
  const googleIdentity = user.identities?.find((i) => i.provider === 'google');
  return googleIdentity?.id ?? user.user_metadata?.sub ?? user.user_metadata?.provider_id ?? null;
}

/**
 * Supabase JWT 検証ミドルウェア。
 * Authorization: Bearer <token> ヘッダからトークンを取得し、
 * Supabase の /auth/v1/user エンドポイントでユーザーを検証する。
 * 検証成功時は userId と googleSub をセットして next() を呼ぶ。
 */
export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '認証トークンがありません', code: AuthErrorCode.NO_TOKEN }, 401);
    }

    const token = authHeader.slice(7); // "Bearer " の7文字を除く

    // Supabase の /auth/v1/user エンドポイントでトークンを検証
    const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: c.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!response.ok) {
      console.error('Supabase トークン検証エラー:', response.status, await response.text().catch(() => ''));
      return c.json(
        { error: '認証に失敗しました', code: AuthErrorCode.SUPABASE_VERIFY_FAILED, detail: `status ${response.status}` },
        401,
      );
    }

    const user = (await response.json()) as SupabaseUser;
    if (!user?.id) {
      return c.json({ error: '無効なトークンです', code: AuthErrorCode.TOKEN_INVALID }, 401);
    }

    c.set('userId', user.id);
    c.set('googleSub', extractGoogleSub(user));
    await next();
  },
);
