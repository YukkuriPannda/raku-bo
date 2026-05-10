import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import receipts from './routes/receipts';
import transactions from './routes/transactions';
import balance from './routes/balance';
import shifts from './routes/shifts';
import points from './routes/points';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORSミドルウェア（Expo（React Native）からのアクセスを許可）
app.use(
  '*',
  cors({
    origin: '*', // 本番では Expo のオリジンに絞ること
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
app.use('/receipts/*', authMiddleware);
app.use('/transactions/*', authMiddleware);
app.use('/balance/*', authMiddleware);
app.use('/shifts/*', authMiddleware);
app.use('/points/*', authMiddleware);

// ルート登録
app.route('/receipts', receipts);
app.route('/transactions', transactions);
app.route('/balance', balance);
app.route('/shifts', shifts);
app.route('/points', points);

export default app;
