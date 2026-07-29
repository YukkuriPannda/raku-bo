import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import receipts from './routes/receipts';
import transactions from './routes/transactions';
import balance from './routes/balance';
import shifts from './routes/shifts';
import profile from './routes/profile';
import plannedExpenditures from './routes/planned-expenditures';
import calendarEvents from './routes/calendar-events';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * ブラウザからのアクセスを許可するオリジン。
 *
 * - Web（Cloudflare Pages: raku-bo-web）の本番とプレビューデプロイ
 * - ローカル開発（docker-compose の web は 5173）
 *
 * モバイル（React Native）は Origin ヘッダを送らないため、この判定の対象外。
 * つまりここを絞ってもモバイルには影響しない。
 * 新しい配信元を追加するときはこの関数に足すこと。
 */
function resolveAllowedOrigin(origin: string): string | null {
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
    return origin;
  }
  if (origin === 'https://raku-bo-web.pages.dev') {
    return origin;
  }
  // Cloudflare Pages のプレビューデプロイ（<branch>.raku-bo-web.pages.dev）
  if (/^https:\/\/[a-z0-9-]+\.raku-bo-web\.pages\.dev$/.test(origin)) {
    return origin;
  }
  return null;
}

// CORSミドルウェア
app.use(
  '*',
  cors({
    origin: (origin) => resolveAllowedOrigin(origin),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Google-Access-Token',
    ],
  }),
);

// ヘルスチェック（認証不要）
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'raku-bo-backend' });
});

// モバイルOAuth コールバック中継ページ（Expo Go 開発用）
app.get('/auth/callback', (c) => {
  return c.html(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>認証中...</title></head>
<body>
<p>アプリに戻っています...</p>
<script>
  const hash = window.location.hash;
  const search = window.location.search;
  window.location.href = 'rakubo://auth/callback' + search + hash;
</script>
</body>
</html>`);
});

// 認証が必要なルートには authMiddleware を適用
app.use('/auth/refresh-google-token', authMiddleware);
app.use('/receipts/*', authMiddleware);
app.use('/transactions/*', authMiddleware);
app.use('/balance/*', authMiddleware);
app.use('/shifts/*', authMiddleware);
app.use('/profile/*', authMiddleware);
app.use('/planned-expenditures/*', authMiddleware);
app.use('/calendar-events/*', authMiddleware);

// ルート登録
app.route('/auth', authRoutes);
app.route('/receipts', receipts);
app.route('/transactions', transactions);
app.route('/balance', balance);
app.route('/shifts', shifts);
app.route('/profile', profile);
app.route('/planned-expenditures', plannedExpenditures);
app.route('/calendar-events', calendarEvents);

export default app;
