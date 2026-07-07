import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { AuthErrorCode } from '../types/error-codes';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * POST /auth/refresh-google-token
 * Authorization: Bearer {supabase_jwt}
 * Body: { refresh_token: string }
 *
 * Google リフレッシュトークンを使って新しいアクセストークンを取得する。
 * client_secret はサーバーサイドのみで保持するためバックエンド経由とする。
 */
auth.post('/refresh-google-token', async (c) => {
  const body = await c.req.json<{ refresh_token?: string }>();
  const refreshToken = body.refresh_token;

  if (!refreshToken) {
    return c.json({ error: 'refresh_token が必要です', code: AuthErrorCode.REFRESH_TOKEN_MISSING }, 400);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
    }),
  });

  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error('Google token refresh error:', data);
    return c.json(
      {
        error: 'Google トークンの更新に失敗しました',
        code: AuthErrorCode.GOOGLE_REFRESH_FAILED,
        detail: data.error_description ?? data.error,
      },
      401,
    );
  }

  return c.json({ access_token: data.access_token });
});

export default auth;
