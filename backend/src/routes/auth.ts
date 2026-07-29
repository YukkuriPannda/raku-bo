import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { AuthErrorCode } from '../types/error-codes';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
}

/**
 * アクセストークンの持ち主（Google の sub）を Google に問い合わせる。
 * 判定できなければ null を返す。
 */
async function resolveTokenOwner(accessToken: string): Promise<string | null> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error('Google userinfo エラー:', response.status);
    return null;
  }

  const info = (await response.json()) as GoogleUserInfo;
  return info.sub ?? null;
}

/**
 * POST /auth/refresh-google-token
 * Authorization: Bearer {supabase_jwt}
 * Body: { refresh_token: string }
 *
 * Google リフレッシュトークンを使って新しいアクセストークンを取得する。
 * client_secret はサーバーサイドのみで保持するためバックエンド経由とする。
 *
 * セキュリティ上の要点:
 *   リフレッシュトークンは client_secret がなければ引き換えられない。つまり
 *   このエンドポイントは「トークンを持っているだけの相手」に引き換え能力を
 *   与えてしまう位置にある。渡されたトークンが呼び出し元本人のものかを
 *   確認しないと、他人のリフレッシュトークンを入手した攻撃者が自分の
 *   アカウントでログインしたまま被害者の Google アクセストークンを
 *   受け取れてしまう（confused deputy）。
 *
 *   そのため引き換え後に、得たアクセストークンの持ち主を Google に確認し、
 *   呼び出し元の Google sub と一致しない場合はトークンを返さずに拒否する。
 *
 *   なお本来の対策はリフレッシュトークンをクライアントから受け取らないこと
 *   （user_id に紐付けてサーバー側で保管する）である。ここでの照合は
 *   モバイル/Web 側の変更なしで悪用経路を閉じるための措置であり、
 *   保管方式への移行後はボディからの受け取り自体を廃止すべき。
 */
auth.post('/refresh-google-token', async (c) => {
  let body: { refresh_token?: string };
  try {
    body = await c.req.json<{ refresh_token?: string }>();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました', code: AuthErrorCode.REFRESH_TOKEN_MISSING }, 400);
  }

  const refreshToken = body.refresh_token;

  if (!refreshToken) {
    return c.json({ error: 'refresh_token が必要です', code: AuthErrorCode.REFRESH_TOKEN_MISSING }, 400);
  }

  // 呼び出し元の Google アカウントが分からなければ照合できないので引き換えない
  const callerGoogleSub = c.get('googleSub');
  if (!callerGoogleSub) {
    return c.json(
      {
        error: 'このアカウントには Google 連携がありません',
        code: AuthErrorCode.GOOGLE_IDENTITY_MISSING,
      },
      403,
    );
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

  // 引き換えたトークンが呼び出し元本人のものか照合する。
  // 一致しない場合、および持ち主を確認できない場合はトークンを返さない。
  const tokenOwnerSub = await resolveTokenOwner(data.access_token);

  if (!tokenOwnerSub) {
    return c.json(
      {
        error: 'トークンの持ち主を確認できませんでした',
        code: AuthErrorCode.GOOGLE_IDENTITY_UNVERIFIABLE,
      },
      502,
    );
  }

  if (tokenOwnerSub !== callerGoogleSub) {
    console.error(
      '他ユーザーのリフレッシュトークンによる引き換えを拒否しました: caller=%s owner=%s',
      callerGoogleSub,
      tokenOwnerSub,
    );
    return c.json(
      {
        error: 'このリフレッシュトークンはログイン中のアカウントのものではありません',
        code: AuthErrorCode.GOOGLE_IDENTITY_MISMATCH,
      },
      403,
    );
  }

  return c.json({ access_token: data.access_token });
});

export default auth;
