import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSupabaseClient } from '../lib/supabase';

const transactions = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /transactions?month=2026-04
 * 当該月のトランザクション一覧を返す（type='cash' | 'point'）。
 * month パラメータ省略時は今月。
 */
transactions.get('/', async (c) => {
  const userId = c.get('userId');
  const monthParam = c.req.query('month');

  // month パラメータのパース（YYYY-MM 形式）
  let year: number;
  let month: number;

  if (monthParam) {
    const parts = monthParam.split('-');
    if (parts.length !== 2) {
      return c.json({ error: 'month パラメータは YYYY-MM 形式で指定してください' }, 400);
    }
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    // 省略時は今月
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }

  // 月初・月末の日付を生成
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .in('type', ['cash', 'point'])
      .gte('transacted_at', startDate)
      .lt('transacted_at', endDate)
      .order('transacted_at', { ascending: false });

    if (error) {
      console.error('トランザクション取得エラー:', error);
      return c.json({ error: 'データの取得に失敗しました' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

/**
 * POST /transactions
 * 確認画面からトランザクションを手動登録する。
 * Body: { type, amount, category, payment_method, store_name?, receipt_id?, receipt_url?, points_earned?, transacted_at }
 */
transactions.post('/', async (c) => {
  const userId = c.get('userId');
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'リクエストボディの解析に失敗しました' }, 400);
  }

  const { type, amount, category, payment_method, store_name, receipt_id, receipt_url, points_earned, transacted_at } = body;

  // バリデーション
  if (!type || !amount || !category || !transacted_at) {
    return c.json({ error: 'type, amount, category, transacted_at は必須です' }, 400);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type,
        amount,
        category,
        payment_method: payment_method ?? 'cash',
        store_name: store_name ?? null,
        receipt_id: receipt_id ?? null,
        receipt_url: receipt_url ?? null,
        points_earned: points_earned ?? 0,
        transacted_at,
      })
      .select()
      .single();

    if (error) {
      console.error('トランザクション作成エラー:', error);
      return c.json({ error: 'トランザクションの保存に失敗しました' }, 500);
    }

    return c.json(data, 201);
  } catch (error) {
    console.error('予期しないエラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default transactions;
