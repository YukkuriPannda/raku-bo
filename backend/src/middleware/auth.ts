import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types';
import { AuthErrorCode } from '../types/error-codes';

/**
 * Supabase JWT 検証ミドルウェア。
 * Authorization: Bearer <token> ヘッダからトークンを取得し、
 * Supabase の /auth/v1/user エンドポイントでユーザーを検証する。
 * 検証成功時は c.set('userId', user.id) をセットして next() を呼ぶ。
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

    const user = (await response.json()) as { id: string };
    if (!user?.id) {
      return c.json({ error: '無効なトークンです', code: AuthErrorCode.TOKEN_INVALID }, 401);
    }

    c.set('userId', user.id);
    await next();
  },
);
